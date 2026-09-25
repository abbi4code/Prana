-- Gym check-in phase 4 (D30): forgotten visits are closed lazily (on the next API call, no cron), and the
-- user can correct the guessed end of an auto-closed visit.

-- a correction of an auto-closed visit's end is a new fact, so it gets its own event type
alter table public.gym_events drop constraint gym_events_type_check;
alter table public.gym_events add constraint gym_events_type_check
  check (type in ('check_in', 'check_out', 'auto_close', 'check_in_attempt_failed', 'end_corrected'));

-- Closes the user's visit if it has been open longer than p_after_minutes. End time = the last exercise logged
-- during the visit (workouts.data.visitId), else started_at + p_default_minutes; never later than the cut-off.
-- Returns { visit } (the closed visit) or { visit: null }.
create function public.gym_auto_close(p_user uuid, p_after_minutes integer, p_default_minutes integer)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v      public.gym_visits;
  v_last timestamptz;
  v_cap  timestamptz;
  v_end  timestamptz;
begin
  select * into v from public.gym_visits
   where user_id = p_user and ended_at is null and started_at < now() - make_interval(mins => p_after_minutes)
   for update;
  if not found then return jsonb_build_object('visit', null); end if;

  v_cap := v.started_at + make_interval(mins => p_after_minutes);
  select max(to_timestamp(((w.data ->> 'createdAt')::bigint) / 1000.0)) into v_last
    from public.workouts w
   where w.user_id = p_user and w.deleted_at is null and w.data ->> 'visitId' = v.id::text;
  v_end := case
    when v_last is not null and v_last > v.started_at then least(v_last, v_cap)
    else least(v.started_at + make_interval(mins => p_default_minutes), v_cap)
  end;

  update public.gym_visits
     set ended_at = v_end, status = 'auto_closed', end_verification = 'not_checked'
   where id = v.id
  returning * into v;
  insert into public.gym_events (user_id, gym_id, visit_id, type, occurred_at, verification, source)
  values (p_user, v.gym_id, v.id, 'auto_close', v_end, 'not_checked', v.source);
  return jsonb_build_object('visit', to_jsonb(v));
end $$;

-- The user fixes the guessed end of an AUTO-CLOSED visit (real check-outs aren't editable).
-- Allowed: after the start, within p_max_minutes of it, and not in the future.
create function public.gym_set_end(p_user uuid, p_id uuid, p_ended_at timestamptz, p_max_minutes integer)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v public.gym_visits;
begin
  select * into v from public.gym_visits where id = p_id and user_id = p_user for update;
  if not found then raise exception 'visit_not_found' using errcode = 'P0002'; end if;
  if v.status <> 'auto_closed' then raise exception 'not_editable' using errcode = '22023'; end if;
  if p_ended_at <= v.started_at or p_ended_at > v.started_at + make_interval(mins => p_max_minutes) or p_ended_at > now() then
    raise exception 'bad_time' using errcode = '22023';
  end if;
  update public.gym_visits set ended_at = p_ended_at where id = v.id returning * into v;
  insert into public.gym_events (user_id, gym_id, visit_id, type, occurred_at, verification, source)
  values (p_user, v.gym_id, v.id, 'end_corrected', p_ended_at, 'not_checked', v.source);
  return jsonb_build_object('visit', to_jsonb(v));
end $$;

revoke all on function public.gym_auto_close(uuid, integer, integer) from public, anon, authenticated;
revoke all on function public.gym_set_end(uuid, uuid, timestamptz, integer) from public, anon, authenticated;
grant execute on function public.gym_auto_close(uuid, integer, integer) to service_role;
grant execute on function public.gym_set_end(uuid, uuid, timestamptz, integer) to service_role;
