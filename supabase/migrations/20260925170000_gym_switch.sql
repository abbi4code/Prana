-- Switching gyms (D30 addendum, .claude/gym-checkin.md "Editing and switching the gym").
-- Switching retires the old gym with a soft delete (deleted_at), so its past visits keep pointing at it.
-- A visit saved on the phone (offline / as a guest) at the old gym may only reach the server after the switch.
-- It happened while that gym was yours, so offline uploads may reference your own retired gym. A LIVE check-in
-- still needs a current (not deleted) gym. Only the gym check changes; everything else is as in
-- 20260925130000_gym_checkin.sql. create or replace keeps the existing grants (service_role only).

create or replace function public.gym_check_in(
  p_user uuid, p_gym text, p_verification text, p_distance integer, p_accuracy integer,
  p_source text, p_id uuid default null, p_started_at timestamptz default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v public.gym_visits;
begin
  if p_started_at is not null and (p_started_at > now() + interval '2 minutes' or p_started_at < now() - interval '24 hours') then
    raise exception 'bad_time' using errcode = '22023';
  end if;
  -- p_id is set only for offline uploads: those may point at a gym retired since
  if p_gym is not null and not exists (
    select 1 from public.user_gyms g where g.id = p_gym and g.user_id = p_user and (g.deleted_at is null or p_id is not null)
  ) then
    raise exception 'gym_not_found' using errcode = 'P0002';
  end if;

  -- retried upload of the same offline visit
  if p_id is not null then
    select * into v from public.gym_visits where id = p_id and user_id = p_user;
    if found then return jsonb_build_object('visit', to_jsonb(v), 'created', false); end if;
  end if;
  -- already checked in (double tap, second device): return that visit
  select * into v from public.gym_visits where user_id = p_user and ended_at is null;
  if found then return jsonb_build_object('visit', to_jsonb(v), 'created', false); end if;

  insert into public.gym_visits (id, user_id, gym_id, started_at, start_verification, start_distance_m, start_accuracy_m, source)
  values (coalesce(p_id, gen_random_uuid()), p_user, p_gym, coalesce(p_started_at, now()), p_verification, p_distance, p_accuracy, p_source)
  on conflict (user_id) where ended_at is null do nothing
  returning * into v;
  if v.id is null then -- lost a race with a parallel check-in
    select * into v from public.gym_visits where user_id = p_user and ended_at is null;
    return jsonb_build_object('visit', to_jsonb(v), 'created', false);
  end if;

  insert into public.gym_events (user_id, gym_id, visit_id, type, occurred_at, verification, distance_m, accuracy_m, source)
  values (p_user, p_gym, v.id, 'check_in', v.started_at, p_verification, p_distance, p_accuracy, p_source);
  return jsonb_build_object('visit', to_jsonb(v), 'created', true);
end $$;

-- always an offline upload: your own gym, retired or not
create or replace function public.gym_record_visit(p_user uuid, p_gym text, p_id uuid, p_started_at timestamptz, p_ended_at timestamptz)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v public.gym_visits;
begin
  if p_started_at > p_ended_at or p_ended_at > now() + interval '2 minutes' or p_started_at < now() - interval '30 days' then
    raise exception 'bad_time' using errcode = '22023';
  end if;
  if p_gym is not null and not exists (
    select 1 from public.user_gyms g where g.id = p_gym and g.user_id = p_user
  ) then
    raise exception 'gym_not_found' using errcode = 'P0002';
  end if;
  select * into v from public.gym_visits where id = p_id and user_id = p_user;
  if found then return jsonb_build_object('visit', to_jsonb(v), 'created', false); end if;

  insert into public.gym_visits (id, user_id, gym_id, started_at, ended_at, status, start_verification, end_verification, source)
  values (p_id, p_user, p_gym, p_started_at, p_ended_at, 'completed', 'not_checked', 'not_checked', 'web_offline')
  returning * into v;
  insert into public.gym_events (user_id, gym_id, visit_id, type, occurred_at, verification, source) values
    (p_user, p_gym, v.id, 'check_in', p_started_at, 'not_checked', 'web_offline'),
    (p_user, p_gym, v.id, 'check_out', p_ended_at, 'not_checked', 'web_offline');
  return jsonb_build_object('visit', to_jsonb(v), 'created', true);
end $$;
