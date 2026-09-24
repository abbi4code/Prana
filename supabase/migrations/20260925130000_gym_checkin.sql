-- Gym check-in, phase 1 (decision D30, .claude/gym-checkin.md).
-- user_gyms is user-owned and synced like other data. gym_visits / gym_events are written ONLY by the server
-- (API routes with the service role, through the functions below): users can read their rows but never write
-- them, so a check-in's verdict and timestamps can't be forged from the browser.

-- 1. The user's gym (the app allows one for now; the table allows more later).
create table public.user_gyms (
  id          text primary key,                 -- uuid generated on the device
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  name        text not null check (char_length(name) between 1 and 80),
  lat         double precision check (lat between -90 and 90),      -- null until a location is saved (phase 3)
  lng         double precision check (lng between -180 and 180),
  radius_m    integer not null default 150 check (radius_m between 100 and 300),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  check ((lat is null) = (lng is null))
);
create index user_gyms_user_updated on public.user_gyms (user_id, updated_at);
alter table public.user_gyms enable row level security;
create policy "own rows" on public.user_gyms for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create trigger touch before update on public.user_gyms for each row execute function public.touch_updated_at();

-- 2. Visits: derived state ("was at the gym from X to Y"). Duration = ended_at - started_at, never stored.
create table public.gym_visits (
  id                  uuid primary key default gen_random_uuid(),  -- offline/guest uploads bring their own id (idempotent retries)
  user_id             uuid not null references auth.users on delete cascade,
  gym_id              text references public.user_gyms on delete set null,
  started_at          timestamptz not null default now(),
  ended_at            timestamptz,
  status              text not null default 'active' check (status in ('active', 'completed', 'auto_closed')),
  start_verification  text not null default 'not_checked'
                        check (start_verification in ('verified', 'outside_radius', 'low_accuracy', 'permission_denied', 'unavailable', 'not_checked')),
  start_distance_m    integer,
  start_accuracy_m    integer,
  end_verification    text check (end_verification in ('verified', 'outside_radius', 'low_accuracy', 'permission_denied', 'unavailable', 'not_checked')),
  end_distance_m      integer,
  end_accuracy_m      integer,
  -- web_manual: server clock. web_offline: saved on the device while offline (or as a guest), phone's clock.
  source              text not null default 'web_manual' check (source in ('web_manual', 'web_offline', 'native_geofence')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz,
  check (ended_at is null or ended_at >= started_at),
  check ((status = 'active') = (ended_at is null))
);
-- one active visit per user, enforced by the database
create unique index gym_visits_one_active on public.gym_visits (user_id) where ended_at is null;
create index gym_visits_user_updated on public.gym_visits (user_id, updated_at);
alter table public.gym_visits enable row level security;
create policy "read own" on public.gym_visits for select using (user_id = (select auth.uid()));
create trigger touch before update on public.gym_visits for each row execute function public.touch_updated_at();

-- 3. Events: append-only raw truth (native geofence ENTER/EXIT will land here later; visits can be rebuilt).
create table public.gym_events (
  id            bigint generated always as identity primary key,
  user_id       uuid not null references auth.users on delete cascade,
  gym_id        text references public.user_gyms on delete set null,
  visit_id      uuid references public.gym_visits on delete set null,
  type          text not null check (type in ('check_in', 'check_out', 'auto_close', 'check_in_attempt_failed')),
  occurred_at   timestamptz not null default now(),
  verification  text check (verification in ('verified', 'outside_radius', 'low_accuracy', 'permission_denied', 'unavailable', 'not_checked')),
  distance_m    integer,
  accuracy_m    integer,
  source        text not null check (source in ('web_manual', 'web_offline', 'native_geofence')),
  created_at    timestamptz not null default now()
);
create index gym_events_user on public.gym_events (user_id, occurred_at);
alter table public.gym_events enable row level security;
create policy "read own" on public.gym_events for select using (user_id = (select auth.uid()));

-- append-only: rows are never changed (deletes only happen when the account itself is deleted)
create function public.gym_events_append_only() returns trigger language plpgsql as $$
begin
  raise exception 'gym_events is append-only';
end $$;
create trigger append_only before update on public.gym_events for each row execute function public.gym_events_append_only();

-- 4. Check-in: idempotent. Returns { visit, created }.
--    p_id / p_started_at are only for offline uploads (the device's id and clock); otherwise the server's.
create function public.gym_check_in(
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
  if p_gym is not null and not exists (
    select 1 from public.user_gyms g where g.id = p_gym and g.user_id = p_user and g.deleted_at is null
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

-- 5. Check-out: closes the active visit. No active visit (double tap) → { visit: null, closed: false }.
create function public.gym_check_out(
  p_user uuid, p_verification text, p_distance integer, p_accuracy integer, p_source text, p_ended_at timestamptz default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v public.gym_visits;
  v_end timestamptz;
begin
  if p_ended_at is not null and (p_ended_at > now() + interval '2 minutes' or p_ended_at < now() - interval '24 hours') then
    raise exception 'bad_time' using errcode = '22023';
  end if;
  select * into v from public.gym_visits where user_id = p_user and ended_at is null for update;
  if not found then return jsonb_build_object('visit', null, 'closed', false); end if;

  v_end := greatest(coalesce(p_ended_at, now()), v.started_at);
  update public.gym_visits
     set ended_at = v_end, status = 'completed',
         end_verification = p_verification, end_distance_m = p_distance, end_accuracy_m = p_accuracy
   where id = v.id
  returning * into v;

  insert into public.gym_events (user_id, gym_id, visit_id, type, occurred_at, verification, distance_m, accuracy_m, source)
  values (p_user, v.gym_id, v.id, 'check_out', v_end, p_verification, p_distance, p_accuracy, p_source);
  return jsonb_build_object('visit', to_jsonb(v), 'closed', true);
end $$;

-- 6. A whole visit that started and ended while offline (or as a guest): stored completed, not_checked.
create function public.gym_record_visit(p_user uuid, p_gym text, p_id uuid, p_started_at timestamptz, p_ended_at timestamptz)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v public.gym_visits;
begin
  if p_started_at > p_ended_at or p_ended_at > now() + interval '2 minutes' or p_started_at < now() - interval '30 days' then
    raise exception 'bad_time' using errcode = '22023';
  end if;
  if p_gym is not null and not exists (
    select 1 from public.user_gyms g where g.id = p_gym and g.user_id = p_user and g.deleted_at is null
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

-- 7. Per-user rate limit for gym calls (same design as consume_parse_quota, separate counters).
create table public.gym_rate (
  user_id      uuid not null references auth.users on delete cascade,
  day          date not null,
  day_count    integer not null default 0,
  minute_start timestamptz not null,
  minute_count integer not null default 0,
  primary key (user_id, day)
);
alter table public.gym_rate enable row level security; -- no policies: server only

create function public.consume_gym_rate(p_user uuid, p_per_minute integer, p_per_day integer)
returns table (allowed boolean, retry_after_s integer)
language plpgsql security definer set search_path = '' as $$
declare
  v_now    timestamptz := now();
  v_day    date := (v_now at time zone 'Asia/Kolkata')::date;
  v_minute timestamptz := date_trunc('minute', v_now);
  r        public.gym_rate;
begin
  insert into public.gym_rate as u (user_id, day, day_count, minute_start, minute_count)
  values (p_user, v_day, 1, v_minute, 1)
  on conflict (user_id, day) do update set
    minute_count = case when u.minute_start = v_minute then u.minute_count + 1 else 1 end,
    minute_start = v_minute,
    day_count    = u.day_count + 1
  returning * into r;
  allowed := r.day_count <= p_per_day and r.minute_count <= p_per_minute;
  retry_after_s := case
    when r.day_count > p_per_day then ceil(extract(epoch from ((v_day + 1)::timestamp at time zone 'Asia/Kolkata') - v_now))::integer
    when r.minute_count > p_per_minute then ceil(extract(epoch from (v_minute + interval '1 minute') - v_now))::integer
    else 0 end;
  return next;
end $$;

revoke all on function public.gym_check_in(uuid, text, text, integer, integer, text, uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.gym_check_out(uuid, text, integer, integer, text, timestamptz) from public, anon, authenticated;
revoke all on function public.gym_record_visit(uuid, text, uuid, timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.consume_gym_rate(uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.gym_check_in(uuid, text, text, integer, integer, text, uuid, timestamptz) to service_role;
grant execute on function public.gym_check_out(uuid, text, integer, integer, text, timestamptz) to service_role;
grant execute on function public.gym_record_visit(uuid, text, uuid, timestamptz, timestamptz) to service_role;
grant execute on function public.consume_gym_rate(uuid, integer, integer) to service_role;
