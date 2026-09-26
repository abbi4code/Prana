-- Challenges (decision D47, .claude/social.md). Progress is never written by users: it's computed on read from
-- activity_days (days, minutes) and from synced workouts (lift), with the same 48 h backdating limit.
-- Lift rules (owner's pick): a real logged set of 1..max_reps reps at ≥ the target; ✓ verified when logged during
-- a GPS-verified gym visit; > 500 kg ignored; > 15 % over your best of the previous 120 days is flagged ("big jump");
-- an unverified set can be disputed, and a majority of the other members disputing it cancels it.

create table public.challenges (
  id            uuid primary key default gen_random_uuid(),
  creator       uuid references public.social_profiles on delete set null,
  title         text not null check (char_length(btrim(title)) between 3 and 60),
  kind          text not null check (kind in ('lift', 'days', 'minutes', 'team_minutes')),
  exercise      text check (exercise ~ '^[a-z0-9-]{2,80}$'),   -- lift: exercise id from the app's catalog
  exercise_name text check (char_length(exercise_name) <= 80),
  target        numeric not null check (target > 0),              -- kg | days | minutes | team minutes
  max_reps      integer not null default 5 check (max_reps between 1 and 5),
  verified_only boolean not null default false,
  audience      text not null check (audience in ('invite', 'open')),
  join_code     text not null default replace(gen_random_uuid()::text, '-', ''),
  starts_on     date not null,
  ends_on       date not null,
  max_members   integer not null default 20 check (max_members between 2 and 200),
  created_at    timestamptz not null default now(),
  cancelled_at  timestamptz,
  check (ends_on >= starts_on and ends_on - starts_on <= 60),
  check ((kind = 'lift') = (exercise is not null)),
  check (kind <> 'lift' or target <= 500),
  check (kind <> 'days' or target <= ends_on - starts_on + 1)
);
create index challenges_open on public.challenges (ends_on) where audience = 'open' and cancelled_at is null;
alter table public.challenges enable row level security; -- read through functions only

create table public.challenge_members (
  challenge_id uuid not null references public.challenges on delete cascade,
  user_id      uuid not null references public.social_profiles on delete cascade,
  status       text not null check (status in ('invited', 'joined', 'declined', 'left')),
  invited_by   uuid references public.social_profiles on delete set null,
  created_at   timestamptz not null default now(),
  joined_at    timestamptz,
  primary key (challenge_id, user_id)
);
create index challenge_members_user on public.challenge_members (user_id);
alter table public.challenge_members enable row level security;

create table public.challenge_disputes (
  challenge_id uuid not null references public.challenges on delete cascade,
  target       uuid not null references public.social_profiles on delete cascade,
  reporter     uuid not null references public.social_profiles on delete cascade,
  workout_id   text not null,
  reason       text check (char_length(reason) <= 200),
  created_at   timestamptz not null default now(),
  primary key (challenge_id, target, reporter, workout_id),
  check (target <> reporter)
);
alter table public.challenge_disputes enable row level security;

alter table public.social_notifications add constraint social_notifications_challenge_fk
  foreign key (challenge_id) references public.challenges on delete cascade;

-- ── progress ──
-- best lift set of a member in the window: { kg, reps, date, workoutId, verified, flagged, disputed, counts }
create function public.challenge_best_lift(c public.challenges, p_user uuid, p_members integer) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  r record; prev numeric; disputes integer; best jsonb := null; v_to date := least(c.ends_on, public.ist_today());
begin
  for r in
    select w.id, public.safe_date(w.data ->> 'date') as d, public.jnum(s -> 'kg') as kg, public.jnum(s -> 'reps') as reps,
           exists (select 1 from public.gym_visits v where v.user_id = p_user and v.id::text = w.data ->> 'visitId'
                    and v.start_verification = 'verified') as verified
      from public.workouts w, jsonb_array_elements(case when jsonb_typeof(w.data -> 'sets') = 'array' then w.data -> 'sets' else '[]'::jsonb end) s
     where w.user_id = p_user and w.deleted_at is null and w.data ->> 'refId' = c.exercise
       and public.safe_date(w.data ->> 'date') between c.starts_on and v_to
       and w.created_at <= ((public.safe_date(w.data ->> 'date') + 3)::timestamp at time zone 'Asia/Kolkata')
       and public.jnum(s -> 'secs') is null
       and public.jnum(s -> 'reps') between 1 and c.max_reps
       and public.jnum(s -> 'kg') between 0.5 and 500
     order by public.jnum(s -> 'kg') desc, verified desc, public.safe_date(w.data ->> 'date')
  loop
    if c.verified_only and not r.verified then continue; end if;
    select count(*) into disputes from public.challenge_disputes
     where challenge_id = c.id and target = p_user and workout_id = r.id;
    -- a majority of the other members disputing an unverified set cancels it
    if not r.verified and disputes > 0 and disputes * 2 >= greatest(p_members - 1, 1) then continue; end if;
    -- best of the previous 120 days (1–10 reps), to flag big jumps
    select max(public.jnum(s2 -> 'kg')) into prev
      from public.workouts w2, jsonb_array_elements(case when jsonb_typeof(w2.data -> 'sets') = 'array' then w2.data -> 'sets' else '[]'::jsonb end) s2
     where w2.user_id = p_user and w2.deleted_at is null and w2.data ->> 'refId' = c.exercise
       and public.safe_date(w2.data ->> 'date') between r.d - 120 and r.d - 1
       and public.jnum(s2 -> 'reps') between 1 and 10 and public.jnum(s2 -> 'kg') <= 500;
    best := jsonb_build_object('kg', r.kg, 'reps', r.reps, 'date', r.d, 'workoutId', r.id, 'verified', r.verified,
                               'flagged', prev is not null and r.kg > prev * 1.15, 'disputes', disputes);
    exit;
  end loop;
  return best;
end $$;

create function public.challenge_progress(c public.challenges, p_user uuid, p_members integer) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_to date := least(c.ends_on, public.ist_today()); v numeric; b jsonb;
begin
  if c.kind = 'lift' then
    b := public.challenge_best_lift(c, p_user, p_members);
    return jsonb_build_object('value', coalesce((b ->> 'kg')::numeric, 0), 'done', coalesce((b ->> 'kg')::numeric, 0) >= c.target, 'lift', b);
  elsif c.kind = 'days' then
    select count(*) into v from public.activity_days
     where user_id = p_user and active and (verified or not c.verified_only) and day between c.starts_on and v_to;
  else -- minutes, team_minutes: at most 120 a day count, so one marathon day can't decide it
    select coalesce(sum(least(minutes, 120)), 0) into v from public.activity_days
     where user_id = p_user and active and day between c.starts_on and v_to;
  end if;
  return jsonb_build_object('value', v, 'done', c.kind <> 'team_minutes' and v >= c.target);
end $$;

create function public.challenge_state(c public.challenges) returns text
language sql stable set search_path = '' as $$
  select case when c.cancelled_at is not null then 'cancelled'
              when public.ist_today() < c.starts_on then 'upcoming'
              when public.ist_today() > c.ends_on then 'ended'
              else 'live' end
$$;

-- one challenge as a card; p_full adds every member with progress, ranked
create function public.challenge_json(c public.challenges, me uuid, p_full boolean) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  n integer; my text; mem jsonb := null; mine jsonb := null; team numeric := null;
begin
  select count(*) into n from public.challenge_members where challenge_id = c.id and status = 'joined';
  select status into my from public.challenge_members where challenge_id = c.id and user_id = me;
  if my = 'joined' then mine := public.challenge_progress(c, me, n); end if;
  if p_full then
    select jsonb_agg(x order by (x -> 'progress' ->> 'done')::boolean desc, (x -> 'progress' ->> 'value')::numeric desc,
                     x -> 'progress' -> 'lift' ->> 'date', x ->> 'name')
      into mem
      from (select public.social_card(m.user_id) || jsonb_build_object(
                     'me', m.user_id = me, 'creator', m.user_id = c.creator,
                     'progress', public.challenge_progress(c, m.user_id, n)) as x
              from public.challenge_members m
             where m.challenge_id = c.id and m.status = 'joined' and (m.user_id = me or not public.social_blocked(me, m.user_id))) s;
    if c.kind = 'team_minutes' then
      select coalesce(sum((e -> 'progress' ->> 'value')::numeric), 0) into team from jsonb_array_elements(mem) e;
    end if;
  end if;
  return jsonb_build_object(
    'id', c.id, 'title', c.title, 'kind', c.kind, 'exercise', c.exercise, 'exerciseName', c.exercise_name,
    'target', c.target, 'maxReps', c.max_reps, 'verifiedOnly', c.verified_only, 'audience', c.audience,
    'startsOn', c.starts_on, 'endsOn', c.ends_on, 'maxMembers', c.max_members, 'state', public.challenge_state(c),
    'creator', public.social_card(c.creator), 'isCreator', c.creator = me, 'members', n, 'myStatus', my,
    'mine', mine, 'team', team,
    'joinCode', case when my = 'joined' or c.creator = me then c.join_code end
  ) || case when p_full then jsonb_build_object('list', coalesce(mem, '[]'::jsonb)) else '{}'::jsonb end;
end $$;

-- ── actions ──
create function public.challenge_create(
  p_title text, p_kind text, p_target numeric, p_exercise text, p_exercise_name text, p_max_reps integer,
  p_verified_only boolean, p_audience text, p_starts_on date, p_days integer, p_invite text[]
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.social_me_id(); c public.challenges; t uuid; h text; today date := public.ist_today();
begin
  perform public.social_rate('challenge_create', 5, 20);
  if not public.social_text_ok(p_title) then raise exception 'bad_title' using errcode = '22023'; end if;
  if p_starts_on is null or p_starts_on < today or p_starts_on > today + 30 then raise exception 'bad_start' using errcode = '22023'; end if;
  if p_days is null or p_days not between 1 and 60 then raise exception 'bad_length' using errcode = '22023'; end if;
  if p_kind = 'minutes' and p_target > 120 * p_days then raise exception 'bad_target' using errcode = '22023'; end if;
  insert into public.challenges (creator, title, kind, exercise, exercise_name, target, max_reps, verified_only, audience, starts_on, ends_on)
  values (me, btrim(p_title), p_kind, case when p_kind = 'lift' then p_exercise end, case when p_kind = 'lift' then left(p_exercise_name, 80) end,
          p_target, coalesce(p_max_reps, 5), coalesce(p_verified_only, false), p_audience, p_starts_on, p_starts_on + p_days - 1)
  returning * into c;
  insert into public.challenge_members (challenge_id, user_id, status, joined_at) values (c.id, me, 'joined', now());
  -- invites: friends only (anyone else joins with the link)
  foreach h in array coalesce(p_invite, '{}') loop
    t := public.social_uid(h);
    if t is not null and t <> me and public.social_is_friend(me, t) then
      insert into public.challenge_members (challenge_id, user_id, status, invited_by) values (c.id, t, 'invited', me) on conflict do nothing;
      perform public.social_notify(t, 'challenge_invite', me, c.id);
    end if;
  end loop;
  return public.challenge_json(c, me, true);
exception when check_violation then
  raise exception 'bad_challenge' using errcode = '22023';
end $$;

create function public.challenge_invite(p_id uuid, p_invite text[]) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := public.social_me_id(); c public.challenges; t uuid; h text;
begin
  select * into c from public.challenges where id = p_id;
  if not found or not exists (select 1 from public.challenge_members where challenge_id = p_id and user_id = me and status = 'joined') then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if public.challenge_state(c) in ('ended', 'cancelled') then raise exception 'closed' using errcode = '22023'; end if;
  foreach h in array coalesce(p_invite, '{}') loop
    t := public.social_uid(h);
    if t is not null and t <> me and public.social_is_friend(me, t) then
      insert into public.challenge_members (challenge_id, user_id, status, invited_by) values (p_id, t, 'invited', me)
      on conflict (challenge_id, user_id) do update set status = 'invited', invited_by = me
        where public.challenge_members.status in ('declined', 'left');
      if found then perform public.social_notify(t, 'challenge_invite', me, p_id); end if;
    end if;
  end loop;
end $$;

-- join: open challenges, an invite you received, or the link code
create function public.challenge_join(p_id uuid, p_code text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := public.social_me_id(); c public.challenges; n integer; mine text;
begin
  perform public.social_rate('challenge_join', 20, 200);
  select * into c from public.challenges where id = p_id;
  if not found or (c.creator is not null and public.social_blocked(me, c.creator)) then raise exception 'not_found' using errcode = 'P0002'; end if;
  select status into mine from public.challenge_members where challenge_id = p_id and user_id = me;
  if mine = 'joined' then return public.challenge_json(c, me, true); end if;
  -- null-safe: a missing code or no membership must never let someone in (NULL would skip the check)
  if not (c.audience = 'open' or coalesce(mine = 'invited', false) or coalesce(p_code = c.join_code, false)) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if public.challenge_state(c) in ('ended', 'cancelled') then raise exception 'closed' using errcode = '22023'; end if;
  select count(*) into n from public.challenge_members where challenge_id = p_id and status = 'joined';
  if n >= c.max_members then raise exception 'full' using errcode = '22023'; end if;
  insert into public.challenge_members (challenge_id, user_id, status, joined_at) values (p_id, me, 'joined', now())
  on conflict (challenge_id, user_id) do update set status = 'joined', joined_at = now();
  if c.creator is not null and c.creator <> me then perform public.social_notify(c.creator, 'challenge_joined', me, p_id); end if;
  return public.challenge_json(c, me, true);
end $$;

create function public.challenge_decline(p_id uuid) returns void
language sql security definer set search_path = '' as $$
  update public.challenge_members set status = 'declined' where challenge_id = p_id and user_id = public.social_me_id() and status = 'invited'
$$;

create function public.challenge_leave(p_id uuid) returns void
language sql security definer set search_path = '' as $$
  update public.challenge_members set status = 'left' where challenge_id = p_id and user_id = public.social_me_id() and status = 'joined'
$$;

-- the creator can call it off before it starts
create function public.challenge_cancel(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := public.social_me_id();
begin
  update public.challenges set cancelled_at = now()
   where id = p_id and creator = me and cancelled_at is null and public.ist_today() < starts_on;
  if not found then raise exception 'not_allowed' using errcode = '22023'; end if;
end $$;

create function public.challenge_dispute(p_id uuid, p_handle text, p_workout text, p_reason text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := public.social_me_id(); t uuid := public.social_uid(p_handle);
begin
  perform public.social_rate('challenge_dispute', 10, 50);
  if t is null or t = me
     or not exists (select 1 from public.challenge_members where challenge_id = p_id and user_id = me and status = 'joined')
     or not exists (select 1 from public.challenge_members where challenge_id = p_id and user_id = t and status = 'joined') then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  insert into public.challenge_disputes (challenge_id, target, reporter, workout_id, reason)
  values (p_id, t, me, p_workout, nullif(left(btrim(coalesce(p_reason, '')), 200), '')) on conflict do nothing;
end $$;

-- ── reads ──
create function public.challenge_get(p_id uuid, p_code text default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare me uuid := public.social_me_id(); c public.challenges;
begin
  select * into c from public.challenges where id = p_id;
  if not found or (c.creator is not null and c.creator <> me and public.social_blocked(me, c.creator))
     or not (c.audience = 'open' or coalesce(p_code = c.join_code, false)
             or exists (select 1 from public.challenge_members where challenge_id = p_id and user_id = me)) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  return public.challenge_json(c, me, true);
end $$;

-- yours (invited / joined, newest first) + open ones you could join
create function public.challenge_list() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare me uuid := public.social_me_id();
begin
  return jsonb_build_object(
    'mine', coalesce((
      select jsonb_agg(public.challenge_json(c, me, false) order by c.ends_on < public.ist_today(), c.starts_on desc)
        from public.challenges c join public.challenge_members m on m.challenge_id = c.id
       where m.user_id = me and m.status in ('invited', 'joined') and c.cancelled_at is null
         and c.ends_on >= public.ist_today() - 60), '[]'::jsonb),
    'open', coalesce((
      select jsonb_agg(x) from (
        select public.challenge_json(c, me, false) as x
          from public.challenges c
         where c.audience = 'open' and c.cancelled_at is null and c.ends_on >= public.ist_today()
           and not exists (select 1 from public.challenge_members m where m.challenge_id = c.id and m.user_id = me and m.status = 'joined')
           and (c.creator is null or (not public.social_blocked(me, c.creator) and not public.social_hidden(c.creator)))
         order by (select count(*) from public.challenge_members m where m.challenge_id = c.id and m.status = 'joined') desc, c.starts_on
         limit 30) s), '[]'::jsonb));
end $$;

-- ── permissions ──
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname like 'challenge\_%'
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
    if f.proname in ('challenge_create', 'challenge_invite', 'challenge_join', 'challenge_decline', 'challenge_leave',
                     'challenge_cancel', 'challenge_dispute', 'challenge_get', 'challenge_list') then
      execute format('grant execute on function %s to authenticated', f.sig);
    end if;
  end loop;
end $$;
