-- Social: Akhada leaderboard + friends + safety (decision D46, .claude/social.md).
-- Trust model: nobody writes a score. activity_days is maintained by triggers from synced workouts and
-- server-written gym visits (with caps and a 48 h backdating limit); boards and challenge progress are computed
-- from it by security-definer functions that check auth.uid(). Social data is opt-in: only users with a
-- social_profiles row (consent + 18+) appear anywhere.

-- ── helpers ──
create function public.safe_date(p text) returns date
language plpgsql immutable set search_path = '' as $$
begin
  if p is null or p !~ '^\d{4}-\d{2}-\d{2}$' then return null; end if;
  return p::date;
exception when others then return null;
end $$;

create function public.jnum(p jsonb) returns numeric
language sql immutable set search_path = '' as $$
  select case when jsonb_typeof(p) = 'number' then (p #>> '{}')::numeric end
$$;

create function public.ist_today() returns date
language sql stable set search_path = '' as $$ select (now() at time zone 'Asia/Kolkata')::date $$;

-- ── 1. Profiles (opt-in) ──
create table public.social_profiles (
  user_id      uuid primary key references auth.users on delete cascade,
  handle       text not null check (handle ~ '^[a-z0-9_]{3,20}$'),
  display_name text not null check (char_length(btrim(display_name)) between 1 and 40),
  avatar       text not null default 'flame' check (avatar ~ '^[a-z0-9-]{1,24}$'),
  listed       boolean not null default true,          -- on the global board + in search
  invite_token text not null default replace(gen_random_uuid()::text, '-', ''),
  consent_at   timestamptz not null default now(),
  adult_at     timestamptz not null default now(),     -- confirmed 18+ (DPDP: no tracking of children)
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create unique index social_profiles_handle on public.social_profiles (handle);
create unique index social_profiles_invite on public.social_profiles (invite_token);
alter table public.social_profiles enable row level security;
create policy "read own" on public.social_profiles for select using (user_id = (select auth.uid()));
create trigger touch before update on public.social_profiles for each row execute function public.touch_updated_at();

-- words that can't appear in a handle / display name / challenge title. Text is normalised first: leetspeak
-- (0→o, 1→i, 3→e, 4→a, 5→s, 7→t, 8→b, @→a, $→s), letters only, repeated letters collapsed ("gaandu" → "gandu"),
-- so terms are stored the same way. Deliberately left out because they collide with real names / words:
-- shit (Shital), nazi (Nazia, Nazir), gand (Gandhi), chod (Chodankar), lauda (laudable), rape (grape), dick, jhat (jhatka).
create table public.social_banned_terms (term text primary key);
alter table public.social_banned_terms enable row level security; -- no policies: server only
insert into public.social_banned_terms (term) values
  ('fuck'), ('bulshit'), ('shithead'), ('bitch'), ('bastard'), ('cunt'), ('pusy'), ('whore'), ('slut'), ('niger'), ('niga'),
  ('fagot'), ('retard'), ('porn'), ('hitler'),
  ('chutiya'), ('chutia'), ('chotiya'), ('chotia'), ('chutiye'), ('madarchod'), ('maderchod'), ('madarchot'), ('behenchod'),
  ('bhenchod'), ('benchod'), ('bhosdi'), ('bhosda'), ('bsdk'), ('gandu'), ('lavda'), ('lawda'), ('lodu'), ('randi'), ('harami');

create function public.social_norm(p text) returns text
language sql immutable set search_path = '' as $$
  select regexp_replace(regexp_replace(translate(lower(coalesce(p, '')), '0134578@$!|', 'oieastbasil'), '[^a-z]', '', 'g'), '(.)\1+', '\1', 'g')
$$;

create function public.social_text_ok(p text) returns boolean
language sql stable security definer set search_path = '' as $$
  select not exists (select 1 from public.social_banned_terms t where public.social_norm(p) like '%' || public.social_norm(t.term) || '%')
$$;

create function public.social_handle_state(p_handle text, p_self uuid) returns text
language plpgsql stable security definer set search_path = '' as $$
declare h text := lower(btrim(coalesce(p_handle, '')));
begin
  if h !~ '^[a-z0-9_]{3,20}$' then return 'invalid'; end if;
  if h in ('admin', 'administrator', 'prana', 'akhada', 'support', 'help', 'official', 'moderator', 'mod', 'staff', 'team',
           'root', 'system', 'null', 'undefined', 'api', 'me', 'you', 'everyone', 'anonymous', 'guest', 'owner')
     or h like 'prana%' then return 'reserved'; end if;
  if not public.social_text_ok(h) then return 'blocked'; end if;
  if exists (select 1 from public.social_profiles where handle = h and user_id is distinct from p_self) then return 'taken'; end if;
  return 'ok';
end $$;

-- ── 2. Activity days (the only input to boards + active-day challenges) ──
-- One row per user per local day. Written only by triggers. A day is "active" with a counted gym visit (≥ 20 min)
-- or a plausible logged workout (≥ 15 active minutes or ≥ 6 working sets). Effort = share of a standard training
-- day (12 working sets or 30 active minutes; a visit alone = 50), capped at 100. Defaults, documented in social.md.
create table public.activity_days (
  user_id    uuid not null references auth.users on delete cascade,
  day        date not null,
  sets       integer not null default 0,
  minutes    integer not null default 0,
  visited    boolean not null default false,
  verified   boolean not null default false,
  active     boolean not null default false,
  effort     smallint not null default 0,
  flagged    integer not null default 0,     -- entries ignored as implausible
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);
alter table public.activity_days enable row level security;
create policy "read own" on public.activity_days for select using (user_id = (select auth.uid()));
create index workouts_user_date on public.workouts (user_id, (data ->> 'date'));
create index gym_visits_user_started on public.gym_visits (user_id, started_at);

create function public.activity_refresh(p_user uuid, p_day date) returns void
language plpgsql security definer set search_path = '' as $$
declare
  -- logs synced more than 48 h after the day ended don't count (server insert time, not the phone's clock)
  v_cut timestamptz := ((p_day + 3)::timestamp at time zone 'Asia/Kolkata');
  v_sets integer := 0; v_min numeric := 0; v_flag integer := 0;
  v_visited boolean; v_verified boolean; v_active boolean; v_effort integer;
  w record; s jsonb; reps numeric; kg numeric; secs numeric; rest numeric; m numeric;
begin
  if p_user is null or p_day is null then return; end if;
  for w in
    select data from public.workouts
     where user_id = p_user and deleted_at is null and data ->> 'date' = p_day::text and created_at <= v_cut
  loop
    if w.data ->> 'kind' = 'lift' then
      rest := least(greatest(coalesce(public.jnum(w.data -> 'restSec'), 90), 0), 300);
      for s in select value from jsonb_array_elements(case when jsonb_typeof(w.data -> 'sets') = 'array' then w.data -> 'sets' else '[]'::jsonb end) loop
        reps := public.jnum(s -> 'reps'); kg := coalesce(public.jnum(s -> 'kg'), 0); secs := public.jnum(s -> 'secs');
        if kg between 0 and 500 and ((secs is not null and secs between 1 and 900) or (secs is null and reps between 1 and 100)) then
          v_sets := v_sets + 1;
          v_min := v_min + (coalesce(secs, reps * 3) + rest) / 60.0; -- recomputed here, never the phone's minutes
        else
          v_flag := v_flag + 1;
        end if;
      end loop;
    elsif w.data ->> 'kind' = 'cardio' then
      m := public.jnum(w.data -> 'minutes');
      if m is not null and m between 0 and 300 then v_min := v_min + m; else v_flag := v_flag + 1; end if;
    end if;
  end loop;
  v_sets := least(v_sets, 40);
  v_min := least(v_min, 240);

  select coalesce(bool_or(true), false), coalesce(bool_or(start_verification = 'verified'), false)
    into v_visited, v_verified
    from public.gym_visits
   where user_id = p_user and deleted_at is null and ended_at is not null
     and ended_at - started_at >= interval '20 minutes'
     and (started_at at time zone 'Asia/Kolkata')::date = p_day
     and created_at <= v_cut;

  v_active := v_visited or v_min >= 15 or v_sets >= 6;
  v_effort := case when not v_active then 0
    else least(100, greatest(round(v_sets * 100 / 12.0), round(v_min * 100 / 30.0), case when v_visited then 50 else 0 end))::integer end;

  if v_sets = 0 and v_min = 0 and not v_visited and v_flag = 0 then
    delete from public.activity_days where user_id = p_user and day = p_day;
  else
    insert into public.activity_days as a (user_id, day, sets, minutes, visited, verified, active, effort, flagged, updated_at)
    values (p_user, p_day, v_sets, round(v_min)::integer, v_visited, v_verified, v_active, v_effort, v_flag, now())
    on conflict (user_id, day) do update set
      sets = excluded.sets, minutes = excluded.minutes, visited = excluded.visited, verified = excluded.verified,
      active = excluded.active, effort = excluded.effort, flagged = excluded.flagged, updated_at = now();
  end if;
end $$;

create function public.activity_on_workout() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform public.activity_refresh(old.user_id, public.safe_date(old.data ->> 'date'));
  end if;
  if tg_op = 'INSERT' or (tg_op = 'UPDATE' and new.data ->> 'date' is distinct from old.data ->> 'date') then
    perform public.activity_refresh(new.user_id, public.safe_date(new.data ->> 'date'));
  end if;
  return null;
end $$;
create trigger activity after insert or update or delete on public.workouts for each row execute function public.activity_on_workout();

create function public.activity_on_visit() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    perform public.activity_refresh(old.user_id, (old.started_at at time zone 'Asia/Kolkata')::date);
  end if;
  perform public.activity_refresh(new.user_id, (new.started_at at time zone 'Asia/Kolkata')::date);
  return null;
end $$;
create trigger activity after insert or update on public.gym_visits for each row execute function public.activity_on_visit();

-- backfill everything logged so far
do $$
declare r record;
begin
  for r in
    select distinct user_id, public.safe_date(data ->> 'date') as day from public.workouts where deleted_at is null
    union
    select distinct user_id, (started_at at time zone 'Asia/Kolkata')::date from public.gym_visits
  loop
    perform public.activity_refresh(r.user_id, r.day);
  end loop;
end $$;

-- ── 3. Friends, blocks, reports, inbox ──
create table public.friendships (
  user_low     uuid not null references public.social_profiles on delete cascade,
  user_high    uuid not null references public.social_profiles on delete cascade,
  requested_by uuid not null,
  status       text not null check (status in ('pending', 'accepted')),
  created_at   timestamptz not null default now(),
  accepted_at  timestamptz,
  primary key (user_low, user_high),
  check (user_low < user_high)
);
create index friendships_high on public.friendships (user_high);
alter table public.friendships enable row level security;
create policy "read own" on public.friendships for select using ((select auth.uid()) in (user_low, user_high));

create table public.social_blocks (
  blocker    uuid not null references auth.users on delete cascade,
  blocked    uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked),
  check (blocker <> blocked)
);
create index social_blocks_blocked on public.social_blocks (blocked);
alter table public.social_blocks enable row level security;
create policy "read own" on public.social_blocks for select using (blocker = (select auth.uid()));

create table public.social_reports (
  id           bigint generated always as identity primary key,
  reporter     uuid references auth.users on delete set null,
  target       uuid not null references auth.users on delete cascade,
  reason       text not null check (reason in ('name', 'cheating', 'harassment', 'spam', 'other')),
  note         text check (char_length(note) <= 500),
  challenge_id uuid,
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz
);
create index social_reports_target on public.social_reports (target) where resolved_at is null;
alter table public.social_reports enable row level security; -- no policies: reviewed by the owner in the dashboard

create table public.social_notifications (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references public.social_profiles on delete cascade,
  kind         text not null check (kind in ('friend_request', 'friend_accepted', 'challenge_invite', 'challenge_joined')),
  actor        uuid references public.social_profiles on delete cascade,
  challenge_id uuid,
  created_at   timestamptz not null default now(),
  read_at      timestamptz
);
create index social_notifications_user on public.social_notifications (user_id, created_at desc);
alter table public.social_notifications enable row level security;
create policy "read own" on public.social_notifications for select using (user_id = (select auth.uid()));

-- the caller, who must have joined (consent + 18+)
create function public.social_me_id() returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare v uuid := auth.uid();
begin
  if v is null then raise exception 'not_signed_in' using errcode = '28000'; end if;
  if not exists (select 1 from public.social_profiles where user_id = v) then raise exception 'no_profile' using errcode = 'P0002'; end if;
  return v;
end $$;

create function public.social_blocked(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.social_blocks where (blocker = a and blocked = b) or (blocker = b and blocked = a))
$$;

-- hidden from public places (global board, open challenges) after 3 different people report cheating / name / harassment
create function public.social_hidden(p uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select (select count(distinct reporter) from public.social_reports
           where target = p and resolved_at is null and reason in ('name', 'cheating', 'harassment')
             and created_at > now() - interval '60 days') >= 3
$$;

create function public.social_is_friend(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.friendships where user_low = least(a, b) and user_high = greatest(a, b) and status = 'accepted')
$$;

create function public.social_rate(p_bucket text, p_per_minute integer, p_per_day integer) returns void
language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  select * into r from public.consume_api_rate(auth.uid(), p_bucket, p_per_minute, p_per_day);
  if not r.allowed then raise exception 'rate_limited:%', r.retry_after_s using errcode = 'P0001'; end if;
end $$;

create function public.social_card(p uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('handle', handle, 'name', display_name, 'avatar', avatar) from public.social_profiles where user_id = p
$$;

create function public.social_notify(p_user uuid, p_kind text, p_actor uuid, p_challenge uuid default null) returns void
language sql security definer set search_path = '' as $$
  insert into public.social_notifications (user_id, kind, actor, challenge_id) values (p_user, p_kind, p_actor, p_challenge)
$$;

-- ── 4. Streak (same rules as lib/streaks.ts runStreak: rest days skip, today never breaks, a freeze every 7 hits, max 2) ──
create function public.social_streak(p_user uuid, p_today date) returns integer
language plpgsql stable security definer set search_path = '' as $$
declare
  v_rest integer[];
  v_first date;
  cur integer := 0; freezes integer := 0;
  r record;
begin
  select coalesce(array(select jsonb_array_elements_text(g.fitness -> 'restDays')::integer), array[0])
    into v_rest from public.user_goals g where g.user_id = p_user;
  v_rest := coalesce(v_rest, array[0]);
  select min(day) into v_first from public.activity_days where user_id = p_user and active and day <= p_today and day > p_today - 400;
  if v_first is null then return 0; end if;
  for r in
    select g::date as d, coalesce(a.active, false) as hit
      from generate_series(v_first, p_today, interval '1 day') g
      left join public.activity_days a on a.user_id = p_user and a.day = g::date
     order by 1
  loop
    if r.hit then
      cur := cur + 1;
      if cur % 7 = 0 and freezes < 2 then freezes := freezes + 1; end if;
    elsif extract(dow from r.d)::integer = any(v_rest) or r.d = p_today then
      null; -- a chosen rest day, or today still in progress
    elsif cur > 0 and freezes > 0 then
      freezes := freezes - 1;
    else
      cur := 0;
    end if;
  end loop;
  return cur;
end $$;

-- ── 5. Profile functions ──
create function public.social_join(p_handle text, p_name text, p_avatar text, p_listed boolean, p_adult boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v uuid := auth.uid();
  h text := lower(btrim(coalesce(p_handle, '')));
  n text := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
  st text;
begin
  if v is null then raise exception 'not_signed_in' using errcode = '28000'; end if;
  if p_adult is not true then raise exception 'adult_required' using errcode = '22023'; end if;
  perform public.social_rate('social_profile', 20, 200);
  st := public.social_handle_state(h, v);
  if st <> 'ok' then raise exception 'handle_%', st using errcode = '22023'; end if;
  if char_length(n) not between 1 and 40 or not public.social_text_ok(n) then raise exception 'bad_name' using errcode = '22023'; end if;
  begin
    insert into public.social_profiles as p (user_id, handle, display_name, avatar, listed)
    values (v, h, n, coalesce(nullif(p_avatar, ''), 'flame'), coalesce(p_listed, true))
    on conflict (user_id) do update set handle = excluded.handle, display_name = excluded.display_name,
      avatar = excluded.avatar, listed = excluded.listed;
  exception when unique_violation then
    raise exception 'handle_taken' using errcode = '22023';
  end;
  return public.social_me();
end $$;

create function public.social_check_handle(p_handle text) returns text
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not_signed_in' using errcode = '28000'; end if;
  perform public.social_rate('social_check', 60, 2000);
  return public.social_handle_state(p_handle, auth.uid());
end $$;

-- leaving deletes the profile and, through the foreign keys, friendships, memberships, disputes and the inbox
create function public.social_leave() returns void
language sql security definer set search_path = '' as $$
  delete from public.social_profiles where user_id = auth.uid()
$$;

create function public.social_me() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v uuid := auth.uid(); p public.social_profiles;
begin
  if v is null then return null; end if;
  select * into p from public.social_profiles where user_id = v;
  if not found then return null; end if;
  return jsonb_build_object(
    'handle', p.handle, 'name', p.display_name, 'avatar', p.avatar, 'listed', p.listed, 'inviteToken', p.invite_token,
    'since', p.created_at,
    'unread', (select count(*) from public.social_notifications where user_id = v and read_at is null),
    'requests', (select count(*) from public.friendships where v in (user_low, user_high) and status = 'pending' and requested_by <> v));
end $$;

create function public.social_reset_invite() returns text
language sql security definer set search_path = '' as $$
  update public.social_profiles set invite_token = replace(gen_random_uuid()::text, '-', '') where user_id = auth.uid() returning invite_token
$$;

-- ── 6. Friends ──
create function public.social_uid(p_handle text) returns uuid
language sql stable security definer set search_path = '' as $$
  select user_id from public.social_profiles where handle = lower(btrim(p_handle))
$$;

create function public.social_friend_add(p_handle text) returns text
language plpgsql security definer set search_path = '' as $$
declare me uuid := public.social_me_id(); t uuid; f public.friendships;
begin
  perform public.social_rate('social_friend', 20, 200);
  t := public.social_uid(p_handle);
  if t is null or t = me or public.social_blocked(me, t) then raise exception 'not_found' using errcode = 'P0002'; end if;
  select * into f from public.friendships where user_low = least(me, t) and user_high = greatest(me, t);
  if found then
    if f.status = 'accepted' then return 'friends'; end if;
    if f.requested_by = me then return 'pending'; end if;
    update public.friendships set status = 'accepted', accepted_at = now() where user_low = f.user_low and user_high = f.user_high;
    perform public.social_notify(t, 'friend_accepted', me);
    return 'friends';
  end if;
  insert into public.friendships (user_low, user_high, requested_by, status) values (least(me, t), greatest(me, t), me, 'pending');
  perform public.social_notify(t, 'friend_request', me);
  return 'pending';
end $$;

create function public.social_friend_respond(p_handle text, p_accept boolean) returns text
language plpgsql security definer set search_path = '' as $$
declare me uuid := public.social_me_id(); t uuid := public.social_uid(p_handle);
begin
  if t is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  if p_accept then
    update public.friendships set status = 'accepted', accepted_at = now()
     where user_low = least(me, t) and user_high = greatest(me, t) and status = 'pending' and requested_by = t;
    if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
    perform public.social_notify(t, 'friend_accepted', me);
    return 'friends';
  end if;
  delete from public.friendships where user_low = least(me, t) and user_high = greatest(me, t) and status = 'pending';
  return 'none';
end $$;

-- unfriend, or cancel a request
create function public.social_friend_remove(p_handle text) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := public.social_me_id(); t uuid := public.social_uid(p_handle);
begin
  delete from public.friendships where user_low = least(me, t) and user_high = greatest(me, t);
end $$;

-- an invite link is the inviter's consent: tapping it makes you friends at once
create function public.social_accept_invite(p_token text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := public.social_me_id(); t uuid;
begin
  perform public.social_rate('social_friend', 20, 200);
  select user_id into t from public.social_profiles where invite_token = p_token;
  if t is null or public.social_blocked(me, t) then raise exception 'not_found' using errcode = 'P0002'; end if;
  if t = me then raise exception 'self' using errcode = '22023'; end if;
  insert into public.friendships as f (user_low, user_high, requested_by, status, accepted_at)
  values (least(me, t), greatest(me, t), t, 'accepted', now())
  on conflict (user_low, user_high) do update set status = 'accepted', accepted_at = coalesce(f.accepted_at, now());
  perform public.social_notify(t, 'friend_accepted', me);
  return public.social_card(t);
end $$;

-- week stats for a person card / friends list
create function public.social_week(p uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'active', least(count(*) filter (where active), 6),
    'verified', count(*) filter (where active and verified),
    'streak', public.social_streak(p, public.ist_today()))
  from public.activity_days where user_id = p and day between date_trunc('week', public.ist_today())::date and public.ist_today()
$$;

create function public.social_friends() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare me uuid := public.social_me_id();
begin
  return jsonb_build_object(
    'friends', coalesce((
      select jsonb_agg(public.social_card(o.id) || public.social_week(o.id) order by sp.display_name)
        from (select case when user_low = me then user_high else user_low end as id from public.friendships
               where me in (user_low, user_high) and status = 'accepted') o
        join public.social_profiles sp on sp.user_id = o.id), '[]'::jsonb),
    'incoming', coalesce((
      select jsonb_agg(public.social_card(requested_by) || jsonb_build_object('at', created_at) order by created_at desc)
        from public.friendships where me in (user_low, user_high) and status = 'pending' and requested_by <> me), '[]'::jsonb),
    'outgoing', coalesce((
      select jsonb_agg(public.social_card(case when user_low = me then user_high else user_low end) order by created_at desc)
        from public.friendships where me in (user_low, user_high) and status = 'pending' and requested_by = me), '[]'::jsonb));
end $$;

create function public.social_relation(me uuid, t uuid) returns text
language sql stable security definer set search_path = '' as $$
  select case
    when me = t then 'me'
    when exists (select 1 from public.social_blocks where blocker = me and blocked = t) then 'blocked'
    else coalesce((select case when status = 'accepted' then 'friend' when requested_by = me then 'outgoing' else 'incoming' end
                     from public.friendships where user_low = least(me, t) and user_high = greatest(me, t)), 'none')
  end
$$;

create function public.social_search(p_q text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := public.social_me_id(); q text := lower(btrim(coalesce(p_q, '')));
begin
  if char_length(q) < 2 then return '[]'::jsonb; end if;
  perform public.social_rate('social_search', 30, 600);
  q := replace(replace(replace(ltrim(q, '@'), '\', ''), '%', ''), '_', '\_');
  return coalesce((
    select jsonb_agg(public.social_card(sp.user_id) || jsonb_build_object('relation', public.social_relation(me, sp.user_id)))
      from (select * from public.social_profiles sp
             where sp.user_id <> me and (sp.listed or public.social_is_friend(me, sp.user_id))
               and not public.social_blocked(me, sp.user_id)
               and (sp.handle like q || '%' or lower(sp.display_name) like '%' || q || '%')
             order by (sp.handle like q || '%') desc, sp.handle limit 20) sp), '[]'::jsonb);
end $$;

-- a person's card: yourself, friends, and listed people (not across a block)
create function public.social_person(p_handle text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare me uuid := public.social_me_id(); t uuid := public.social_uid(p_handle); rel text; sp public.social_profiles;
begin
  if t is null or (t <> me and public.social_blocked(t, me)) then raise exception 'not_found' using errcode = 'P0002'; end if;
  rel := public.social_relation(me, t);
  select * into sp from public.social_profiles where user_id = t;
  if not sp.listed and rel not in ('me', 'friend', 'incoming', 'outgoing') then raise exception 'not_found' using errcode = 'P0002'; end if;
  return public.social_card(t) || public.social_week(t) || jsonb_build_object(
    'relation', rel, 'since', sp.created_at,
    'month', (select jsonb_build_object('active', least(count(*) filter (where active), 26), 'verified', count(*) filter (where active and verified))
                from public.activity_days where user_id = t and day between date_trunc('month', public.ist_today())::date and public.ist_today()));
end $$;

-- ── 7. Safety ──
create function public.social_block(p_handle text) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := public.social_me_id(); t uuid := public.social_uid(p_handle);
begin
  if t is null or t = me then raise exception 'not_found' using errcode = 'P0002'; end if;
  insert into public.social_blocks (blocker, blocked) values (me, t) on conflict do nothing;
  delete from public.friendships where user_low = least(me, t) and user_high = greatest(me, t);
  delete from public.social_notifications where (user_id = me and actor = t) or (user_id = t and actor = me);
end $$;

create function public.social_unblock(p_handle text) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := public.social_me_id();
begin
  delete from public.social_blocks where blocker = me and blocked = public.social_uid(p_handle);
end $$;

create function public.social_blocked_list() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(public.social_card(blocked) order by created_at desc), '[]'::jsonb)
    from public.social_blocks where blocker = public.social_me_id() and exists (select 1 from public.social_profiles where user_id = blocked)
$$;

create function public.social_report(p_handle text, p_reason text, p_note text default null, p_challenge uuid default null) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := public.social_me_id(); t uuid := public.social_uid(p_handle);
begin
  if t is null or t = me then raise exception 'not_found' using errcode = 'P0002'; end if;
  perform public.social_rate('social_report', 5, 30);
  insert into public.social_reports (reporter, target, reason, note, challenge_id)
  values (me, t, p_reason, nullif(left(btrim(coalesce(p_note, '')), 500), ''), p_challenge);
end $$;

-- ── 8. Inbox ──
create function public.social_inbox() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(x order by (x ->> 'at') desc), '[]'::jsonb) from (
    select jsonb_build_object('id', n.id, 'kind', n.kind, 'at', n.created_at, 'read', n.read_at is not null,
                              'actor', public.social_card(n.actor), 'challenge', n.challenge_id) as x
      from public.social_notifications n
     where n.user_id = public.social_me_id()
     order by n.created_at desc limit 50) s
$$;

create function public.social_mark_read() returns void
language sql security definer set search_path = '' as $$
  update public.social_notifications set read_at = now() where user_id = auth.uid() and read_at is null
$$;

-- ── 9. Leaderboard ──
-- scope: 'friends' (you + accepted friends) | 'global' (listed, trusted, not hidden)
-- period: 'week' | 'last_week' | 'month' | 'last_month' (IST). Rank = active days (capped) → effort on those days → verified days;
-- ties share a rank. Global returns the top 10 + 5 around you; friends returns everyone.
create function public.social_board(p_scope text, p_period text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.social_me_id();
  today date := public.ist_today();
  v_from date; v_to date; v_cap integer;
  v_rows jsonb; v_me jsonb; v_total integer; v_trusted boolean;
begin
  if p_scope not in ('friends', 'global') or p_period not in ('week', 'last_week', 'month', 'last_month') then
    raise exception 'bad_request' using errcode = '22023';
  end if;
  perform public.social_rate('social_board', 60, 3000);
  if p_period like '%week' then
    v_from := date_trunc('week', today)::date - case when p_period = 'last_week' then 7 else 0 end;
    v_to := least(v_from + 6, today); v_cap := 6;
  else
    v_from := (date_trunc('month', today) - case when p_period = 'last_month' then interval '1 month' else interval '0' end)::date;
    v_to := least((v_from + interval '1 month' - interval '1 day')::date, today); v_cap := 26;
  end if;
  -- new accounts join the global board after 14 days or 3 verified gym days (keeps throwaway accounts off it)
  v_trusted := exists (select 1 from public.social_profiles where user_id = me and created_at <= now() - interval '14 days')
            or (select count(*) from public.activity_days where user_id = me and verified) >= 3;

  create temporary table if not exists pg_temp.board (user_id uuid primary key, active integer, effort integer, verified integer, rk integer) on commit drop;
  truncate pg_temp.board;
  insert into pg_temp.board (user_id, active, effort, verified)
  select m.id,
         coalesce(count(*) filter (where d.rn <= v_cap), 0),
         coalesce(sum(d.effort) filter (where d.rn <= v_cap), 0),
         coalesce(count(*) filter (where d.rn <= v_cap and d.verified), 0)
    from (
      select me as id
      union
      select case when f.user_low = me then f.user_high else f.user_low end from public.friendships f
       where p_scope = 'friends' and me in (f.user_low, f.user_high) and f.status = 'accepted'
      union
      select sp.user_id from public.social_profiles sp
       where p_scope = 'global' and sp.listed and not public.social_hidden(sp.user_id)
         and (sp.created_at <= now() - interval '14 days'
              or (select count(*) from public.activity_days a where a.user_id = sp.user_id and a.verified) >= 3)
    ) m
    left join (
      select a.user_id, a.effort, a.verified,
             row_number() over (partition by a.user_id order by a.effort desc, a.verified desc, a.day) as rn
        from public.activity_days a
       where a.active and a.day between v_from and v_to
    ) d on d.user_id = m.id
   where m.id = me or not public.social_blocked(me, m.id)
   group by m.id;
  -- only people who trained are ranked; you always get a row
  update pg_temp.board b set rk = r.rk from (
    select user_id, rank() over (order by active desc, effort desc, verified desc)::integer as rk from pg_temp.board
     where active > 0 and (p_scope = 'friends' or user_id <> me or v_trusted)
  ) r where r.user_id = b.user_id;
  select count(*) into v_total from pg_temp.board where rk is not null;

  select coalesce(jsonb_agg(public.social_card(b.user_id) || jsonb_build_object(
           'rank', b.rk, 'active', b.active, 'effort', b.effort, 'verified', b.verified,
           'streak', public.social_streak(b.user_id, today), 'me', b.user_id = me,
           'friend', public.social_is_friend(me, b.user_id))
         order by b.rk nulls last, (b.user_id = me) desc, b.effort desc), '[]'::jsonb)
    into v_rows
    from pg_temp.board b
   where p_scope = 'friends'
      or b.rk <= 10
      or b.user_id = me
      or abs(b.rk - coalesce((select rk from pg_temp.board where user_id = me), 1000000)) <= 5;

  select jsonb_build_object('rank', rk, 'active', active, 'effort', effort, 'verified', verified) into v_me from pg_temp.board where user_id = me;
  return jsonb_build_object('from', v_from, 'to', v_to, 'cap', v_cap, 'scope', p_scope, 'period', p_period,
    'total', v_total, 'me', v_me, 'trusted', v_trusted, 'rows', v_rows);
end $$;

-- ── 10. Permissions: nothing is callable by anon; internal helpers by nobody but their owner ──
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and (p.proname like 'social\_%' or p.proname like 'activity\_%'
                                      or p.proname in ('safe_date', 'jnum', 'ist_today'))
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
    if f.proname in ('social_join', 'social_check_handle', 'social_leave', 'social_me', 'social_reset_invite',
                     'social_friend_add', 'social_friend_respond', 'social_friend_remove', 'social_accept_invite',
                     'social_friends', 'social_search', 'social_person', 'social_block', 'social_unblock',
                     'social_blocked_list', 'social_report', 'social_inbox', 'social_mark_read', 'social_board') then
      execute format('grant execute on function %s to authenticated', f.sig);
    end if;
  end loop;
end $$;
