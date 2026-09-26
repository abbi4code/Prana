-- Akhada, part 2 (decisions D48 duels, D49 results + kudos/nudges; .claude/social.md).
-- - Duels: 1v1 with a friend, 7 days from the day after it's accepted; score = effort on your best 6 days (max 600).
-- - Results settle once they can't change any more: logs may arrive up to 48 h after a day (activity_refresh), so a
--   challenge or duel ending on day E is final from E + 3 (IST). Settling freezes every member's result, notifies
--   them and feeds the Akhada badges. It runs lazily from social_sync() (called when the app opens); no cron.
-- - Kudos ("Shabaash!") on a friend's active day; nudges for friends inactive 3 days (opt-out, once per 3 days).

-- ── notifications: more kinds + a payload ──
alter table public.social_notifications drop constraint social_notifications_kind_check;
alter table public.social_notifications add constraint social_notifications_kind_check check (kind in (
  'friend_request', 'friend_accepted', 'challenge_invite', 'challenge_joined', 'challenge_result',
  'duel_invite', 'duel_accepted', 'duel_result', 'kudos', 'nudge'));
alter table public.social_notifications add column payload jsonb;
alter table public.social_notifications add column duel_id uuid;

alter table public.social_profiles add column allow_nudges boolean not null default true;

-- ── frozen challenge results ──
alter table public.challenges add column settled_at timestamptz;
alter table public.challenge_members add column final_value numeric;
alter table public.challenge_members add column final_done boolean;
alter table public.challenge_members add column final_place integer;

-- the day results can't change any more
create function public.final_from(p_end date) returns date
language sql immutable set search_path = '' as $$ select p_end + 3 $$;

-- ── duels ──
create table public.duels (
  id             uuid primary key default gen_random_uuid(),
  challenger     uuid not null references public.social_profiles on delete cascade,
  opponent       uuid not null references public.social_profiles on delete cascade,
  status         text not null default 'pending' check (status in ('pending', 'active', 'declined', 'expired', 'cancelled', 'settled')),
  created_at     timestamptz not null default now(),
  responded_at   timestamptz,
  starts_on      date,
  ends_on        date,
  challenger_score integer,
  opponent_score integer,
  winner         uuid,
  settled_at     timestamptz,
  check (challenger <> opponent),
  check ((status in ('active', 'settled')) = (starts_on is not null))
);
-- one open duel per pair
create unique index duels_one_open on public.duels (least(challenger, opponent), greatest(challenger, opponent)) where status in ('pending', 'active');
create index duels_challenger on public.duels (challenger);
create index duels_opponent on public.duels (opponent);
alter table public.duels enable row level security; -- read through functions only
alter table public.social_notifications add constraint social_notifications_duel_fk foreign key (duel_id) references public.duels on delete cascade;

-- effort per day in a range (0 when not active) and the score: best 6 days
create function public.duel_days(p_user uuid, p_from date, p_to date) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(coalesce(a.effort, 0) order by g), '[]'::jsonb)
    from generate_series(p_from, p_to, interval '1 day') g
    left join public.activity_days a on a.user_id = p_user and a.day = g::date and a.active
$$;

create function public.duel_score(p_user uuid, p_from date, p_to date) returns integer
language sql stable security definer set search_path = '' as $$
  select coalesce(sum(effort), 0)::integer from (
    select effort from public.activity_days
     where user_id = p_user and active and day between p_from and least(p_to, public.ist_today())
     order by effort desc limit 6) s
$$;

create function public.duel_verified(p_user uuid, p_from date, p_to date) returns integer
language sql stable security definer set search_path = '' as $$
  select count(*)::integer from public.activity_days where user_id = p_user and active and verified and day between p_from and p_to
$$;

create function public.duel_json(d public.duels, me uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  them uuid := case when d.challenger = me then d.opponent else d.challenger end;
  today date := public.ist_today();
  st text; mine integer; theirs integer; res text := null;
begin
  st := case
    when d.status = 'pending' and d.created_at < now() - interval '48 hours' then 'expired'
    when d.status in ('pending', 'declined', 'expired', 'cancelled') then d.status
    when d.status = 'settled' then 'final'
    when today < d.starts_on then 'upcoming'
    when today <= d.ends_on then 'live'
    else 'ended' end;
  if d.status = 'settled' then
    mine := case when d.challenger = me then d.challenger_score else d.opponent_score end;
    theirs := case when d.challenger = me then d.opponent_score else d.challenger_score end;
    res := case when d.winner is null then 'draw' when d.winner = me then 'won' else 'lost' end;
  elsif d.starts_on is not null then
    mine := public.duel_score(me, d.starts_on, d.ends_on);
    theirs := public.duel_score(them, d.starts_on, d.ends_on);
  end if;
  return jsonb_build_object(
    'id', d.id, 'state', st, 'mine', public.social_card(me), 'them', public.social_card(them),
    'challenger', d.challenger = me, 'createdAt', d.created_at, 'startsOn', d.starts_on, 'endsOn', d.ends_on,
    'finalOn', case when d.ends_on is not null then public.final_from(d.ends_on) end,
    'myScore', mine, 'theirScore', theirs, 'result', res,
    'myDays', case when d.starts_on is not null then public.duel_days(me, d.starts_on, d.ends_on) end,
    'theirDays', case when d.starts_on is not null then public.duel_days(them, d.starts_on, d.ends_on) end);
end $$;

create function public.duel_create(p_handle text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := public.social_me_id(); t uuid := public.social_uid(p_handle); d public.duels;
begin
  perform public.social_rate('duel_create', 5, 20);
  if t is null or t = me or not public.social_is_friend(me, t) or public.social_blocked(me, t) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if (select count(*) from public.duels where me in (challenger, opponent) and status in ('pending', 'active')
        and not (status = 'pending' and created_at < now() - interval '48 hours')) >= 5 then
    raise exception 'too_many' using errcode = '22023';
  end if;
  -- a stale invite between the two is closed first
  update public.duels set status = 'expired'
   where least(challenger, opponent) = least(me, t) and greatest(challenger, opponent) = greatest(me, t)
     and status = 'pending' and created_at < now() - interval '48 hours';
  begin
    insert into public.duels (challenger, opponent) values (me, t) returning * into d;
  exception when unique_violation then
    raise exception 'duel_exists' using errcode = '22023';
  end;
  insert into public.social_notifications (user_id, kind, actor, duel_id) values (t, 'duel_invite', me, d.id);
  return public.duel_json(d, me);
end $$;

create function public.duel_respond(p_id uuid, p_accept boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := public.social_me_id(); d public.duels; today date := public.ist_today();
begin
  select * into d from public.duels where id = p_id and opponent = me and status = 'pending' for update;
  if not found or d.created_at < now() - interval '48 hours' then raise exception 'not_found' using errcode = 'P0002'; end if;
  if p_accept then
    update public.duels set status = 'active', responded_at = now(), starts_on = today + 1, ends_on = today + 7
     where id = p_id returning * into d;
    insert into public.social_notifications (user_id, kind, actor, duel_id) values (d.challenger, 'duel_accepted', me, d.id);
  else
    update public.duels set status = 'declined', responded_at = now() where id = p_id returning * into d;
  end if;
  return public.duel_json(d, me);
end $$;

create function public.duel_cancel(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.duels set status = 'cancelled' where id = p_id and challenger = public.social_me_id() and status = 'pending';
  if not found then raise exception 'not_allowed' using errcode = '22023'; end if;
end $$;

create function public.duel_get(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare me uuid := public.social_me_id(); d public.duels;
begin
  select * into d from public.duels where id = p_id and me in (challenger, opponent);
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  return public.duel_json(d, me);
end $$;

-- open duels + the last 60 days, newest first
create function public.duel_list() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(public.duel_json(d, public.social_me_id()) order by d.created_at desc), '[]'::jsonb)
    from public.duels d
   where public.social_me_id() in (d.challenger, d.opponent)
     and (d.status in ('pending', 'active') or d.created_at > now() - interval '60 days')
     and d.status not in ('cancelled')
$$;

-- ── settling (lazy) ──
create function public.duel_settle(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare d public.duels; a integer; b integer; va integer; vb integer; w uuid;
begin
  select * into d from public.duels where id = p_id and status = 'active' for update skip locked;
  if not found or public.ist_today() < public.final_from(d.ends_on) then return; end if;
  a := public.duel_score(d.challenger, d.starts_on, d.ends_on);
  b := public.duel_score(d.opponent, d.starts_on, d.ends_on);
  w := case when a > b then d.challenger when b > a then d.opponent else null end;
  if w is null then -- tie: more GPS-verified gym days wins; still equal = draw
    va := public.duel_verified(d.challenger, d.starts_on, d.ends_on);
    vb := public.duel_verified(d.opponent, d.starts_on, d.ends_on);
    w := case when va > vb then d.challenger when vb > va then d.opponent else null end;
  end if;
  update public.duels set status = 'settled', challenger_score = a, opponent_score = b, winner = w, settled_at = now() where id = p_id;
  insert into public.social_notifications (user_id, kind, actor, duel_id, payload) values
    (d.challenger, 'duel_result', d.opponent, d.id, jsonb_build_object('result', case when w is null then 'draw' when w = d.challenger then 'won' else 'lost' end, 'mine', a, 'theirs', b)),
    (d.opponent, 'duel_result', d.challenger, d.id, jsonb_build_object('result', case when w is null then 'draw' when w = d.opponent then 'won' else 'lost' end, 'mine', b, 'theirs', a));
end $$;

create function public.challenge_settle(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare c public.challenges; n integer; team numeric := 0; r record; place integer := 0; i integer := 0; prev_done boolean; prev_val numeric;
begin
  select * into c from public.challenges where id = p_id and settled_at is null and cancelled_at is null for update skip locked;
  if not found or public.ist_today() < public.final_from(c.ends_on) then return; end if;
  select count(*) into n from public.challenge_members where challenge_id = p_id and status = 'joined';
  create temporary table if not exists pg_temp.res (user_id uuid, value numeric, done boolean) on commit drop;
  truncate pg_temp.res;
  insert into pg_temp.res
  select m.user_id, (p ->> 'value')::numeric, (p ->> 'done')::boolean
    from public.challenge_members m, lateral public.challenge_progress(c, m.user_id, n) p
   where m.challenge_id = p_id and m.status = 'joined';
  if c.kind = 'team_minutes' then
    select coalesce(sum(value), 0) into team from pg_temp.res;
    update pg_temp.res set done = team >= c.target; -- a team goal is everyone's win or no one's
  end if;
  -- places: done first, then the higher value; equal = shared place
  for r in select * from pg_temp.res order by done desc, value desc loop
    i := i + 1;
    if prev_done is distinct from r.done or prev_val is distinct from r.value then place := i; end if;
    prev_done := r.done; prev_val := r.value;
    update public.challenge_members set final_value = r.value, final_done = r.done, final_place = place
     where challenge_id = p_id and user_id = r.user_id;
  end loop;
  update public.challenges set settled_at = now() where id = p_id;
  insert into public.social_notifications (user_id, kind, challenge_id, payload)
  select m.user_id, 'challenge_result', p_id,
         jsonb_build_object('title', c.title, 'place', m.final_place, 'done', m.final_done, 'value', m.final_value, 'members', n)
    from public.challenge_members m where m.challenge_id = p_id and m.status = 'joined';
end $$;

-- ── kudos + nudges ──
create table public.social_kudos (
  from_user  uuid not null references public.social_profiles on delete cascade,
  to_user    uuid not null references public.social_profiles on delete cascade,
  day        date not null,
  created_at timestamptz not null default now(),
  primary key (from_user, to_user, day),
  check (from_user <> to_user)
);
create index social_kudos_to on public.social_kudos (to_user, day);
alter table public.social_kudos enable row level security;

create table public.social_nudges (
  from_user uuid not null references public.social_profiles on delete cascade,
  to_user   uuid not null references public.social_profiles on delete cascade,
  last_at   timestamptz not null default now(),
  primary key (from_user, to_user)
);
alter table public.social_nudges enable row level security;

-- the friend's latest active day within the last 2 days (a Shabaash is for a day that happened, not a streak)
create function public.social_kudos_day(p uuid) returns date
language sql stable security definer set search_path = '' as $$
  select max(day) from public.activity_days where user_id = p and active and day between public.ist_today() - 1 and public.ist_today()
$$;

create function public.social_can_nudge(me uuid, t uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select (select allow_nudges from public.social_profiles where user_id = t)
     and not exists (select 1 from public.activity_days where user_id = t and active and day between public.ist_today() - 2 and public.ist_today())
     and not exists (select 1 from public.social_nudges where from_user = me and to_user = t and last_at > now() - interval '72 hours')
$$;

create function public.social_kudos(p_handle text) returns text
language plpgsql security definer set search_path = '' as $$
declare me uuid := public.social_me_id(); t uuid := public.social_uid(p_handle); d date;
begin
  perform public.social_rate('social_kudos', 30, 300);
  if t is null or not public.social_is_friend(me, t) then raise exception 'not_found' using errcode = 'P0002'; end if;
  d := public.social_kudos_day(t);
  if d is null then raise exception 'not_active' using errcode = '22023'; end if;
  insert into public.social_kudos (from_user, to_user, day) values (me, t, d) on conflict do nothing;
  if found then
    insert into public.social_notifications (user_id, kind, actor, payload) values (t, 'kudos', me, jsonb_build_object('day', d));
    return 'sent';
  end if;
  return 'already';
end $$;

create function public.social_nudge(p_handle text) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := public.social_me_id(); t uuid := public.social_uid(p_handle);
begin
  perform public.social_rate('social_nudge', 10, 30);
  if t is null or not public.social_is_friend(me, t) then raise exception 'not_found' using errcode = 'P0002'; end if;
  if not public.social_can_nudge(me, t) then raise exception 'not_allowed' using errcode = '22023'; end if;
  insert into public.social_nudges as n (from_user, to_user) values (me, t) on conflict (from_user, to_user) do update set last_at = now();
  insert into public.social_notifications (user_id, kind, actor) values (t, 'nudge', me);
end $$;

create function public.social_set_nudges(p_on boolean) returns void
language sql security definer set search_path = '' as $$
  update public.social_profiles set allow_nudges = coalesce(p_on, true) where user_id = auth.uid()
$$;

-- ── friends list: + today / kudos / nudge ──
create or replace function public.social_friends() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare me uuid := public.social_me_id();
begin
  return jsonb_build_object(
    'friends', coalesce((
      select jsonb_agg(public.social_card(o.id) || public.social_week(o.id) || jsonb_build_object(
               'kudosDay', public.social_kudos_day(o.id),
               'kudosSent', exists (select 1 from public.social_kudos k where k.from_user = me and k.to_user = o.id and k.day = public.social_kudos_day(o.id)),
               'canNudge', public.social_can_nudge(me, o.id))
             order by sp.display_name)
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

-- ── me: + nudges setting, kudos today ──
create or replace function public.social_me() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v uuid := auth.uid(); p public.social_profiles;
begin
  if v is null then return null; end if;
  select * into p from public.social_profiles where user_id = v;
  if not found then return null; end if;
  return jsonb_build_object(
    'handle', p.handle, 'name', p.display_name, 'avatar', p.avatar, 'listed', p.listed, 'inviteToken', p.invite_token,
    'since', p.created_at, 'allowNudges', p.allow_nudges,
    'unread', (select count(*) from public.social_notifications where user_id = v and read_at is null),
    'requests', (select count(*) from public.friendships where v in (user_low, user_high) and status = 'pending' and requested_by <> v),
    'kudosToday', (select count(*) from public.social_kudos where to_user = v and day = public.ist_today()),
    'duelInvites', (select count(*) from public.duels where opponent = v and status = 'pending' and created_at > now() - interval '48 hours'));
end $$;

-- called when the app opens: settle what's final, then the profile + counts
create function public.social_sync() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v uuid := auth.uid(); r record;
begin
  if v is null or not exists (select 1 from public.social_profiles where user_id = v) then return public.social_me(); end if;
  perform public.social_rate('social_sync', 20, 500);
  update public.duels set status = 'expired' where v in (challenger, opponent) and status = 'pending' and created_at < now() - interval '48 hours';
  for r in select id from public.duels where v in (challenger, opponent) and status = 'active' and public.ist_today() >= public.final_from(ends_on) loop
    perform public.duel_settle(r.id);
  end loop;
  for r in select c.id from public.challenges c join public.challenge_members m on m.challenge_id = c.id
            where m.user_id = v and m.status = 'joined' and c.settled_at is null and c.cancelled_at is null
              and public.ist_today() >= public.final_from(c.ends_on) loop
    perform public.challenge_settle(r.id);
  end loop;
  return public.social_me();
end $$;

-- Akhada badges (lib/badges.ts): one date per win / finish / duel win / day you got a Shabaash, oldest first
create function public.social_trophies() returns jsonb
language sql stable security definer set search_path = '' as $$
  with me as (select public.social_me_id() as id)
  select jsonb_build_object(
    'wins', coalesce((select jsonb_agg(c.ends_on order by c.ends_on) from public.challenges c join public.challenge_members m on m.challenge_id = c.id, me
                       where m.user_id = me.id and c.settled_at is not null and m.final_done and m.final_place = 1 and c.kind <> 'team_minutes'
                         and (select count(*) from public.challenge_members x where x.challenge_id = c.id and x.status = 'joined') >= 2), '[]'::jsonb),
    'finishes', coalesce((select jsonb_agg(c.ends_on order by c.ends_on) from public.challenges c join public.challenge_members m on m.challenge_id = c.id, me
                           where m.user_id = me.id and c.settled_at is not null and m.final_done), '[]'::jsonb),
    'duels', coalesce((select jsonb_agg(d.ends_on order by d.ends_on) from public.duels d, me where d.status = 'settled' and d.winner = me.id), '[]'::jsonb),
    'kudos', coalesce((select jsonb_agg(day order by day) from (select distinct k.day from public.social_kudos k, me where k.to_user = me.id) s), '[]'::jsonb))
$$;

-- ── inbox: + challenge / duel context and payload ──
create or replace function public.social_inbox() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(x order by (x ->> 'at') desc), '[]'::jsonb) from (
    select jsonb_build_object('id', n.id, 'kind', n.kind, 'at', n.created_at, 'read', n.read_at is not null,
                              'actor', public.social_card(n.actor), 'challenge', n.challenge_id, 'duel', n.duel_id,
                              'title', (select title from public.challenges where id = n.challenge_id), 'payload', n.payload) as x
      from public.social_notifications n
     where n.user_id = public.social_me_id()
     order by n.created_at desc limit 50) s
$$;

-- ── challenges: show frozen results once settled ──
create or replace function public.challenge_progress(c public.challenges, p_user uuid, p_members integer) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_to date := least(c.ends_on, public.ist_today()); v numeric; b jsonb; f record;
begin
  if c.settled_at is not null then
    select final_value, final_done, final_place into f from public.challenge_members where challenge_id = c.id and user_id = p_user;
    if f.final_value is not null then
      b := case when c.kind = 'lift' then public.challenge_best_lift(c, p_user, p_members) end;
      return jsonb_build_object('value', f.final_value, 'done', f.final_done, 'place', f.final_place, 'final', true, 'lift', b);
    end if;
  end if;
  if c.kind = 'lift' then
    b := public.challenge_best_lift(c, p_user, p_members);
    return jsonb_build_object('value', coalesce((b ->> 'kg')::numeric, 0), 'done', coalesce((b ->> 'kg')::numeric, 0) >= c.target, 'lift', b);
  elsif c.kind = 'days' then
    select count(*) into v from public.activity_days
     where user_id = p_user and active and (verified or not c.verified_only) and day between c.starts_on and v_to;
  else
    select coalesce(sum(least(minutes, 120)), 0) into v from public.activity_days
     where user_id = p_user and active and day between c.starts_on and v_to;
  end if;
  return jsonb_build_object('value', v, 'done', c.kind <> 'team_minutes' and v >= c.target);
end $$;

-- challenge_state is unchanged ('ended' after the last day, so joining and inviting stay closed); settled results show
-- through challenge_progress (`final`, `place`).

-- ── permissions ──
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and (p.proname like 'duel\_%' or p.proname like 'social\_%' or p.proname like 'challenge\_%' or p.proname = 'final_from')
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
    if f.proname in ('social_join', 'social_check_handle', 'social_leave', 'social_me', 'social_reset_invite',
                     'social_friend_add', 'social_friend_respond', 'social_friend_remove', 'social_accept_invite',
                     'social_friends', 'social_search', 'social_person', 'social_block', 'social_unblock',
                     'social_blocked_list', 'social_report', 'social_inbox', 'social_mark_read', 'social_board',
                     'social_sync', 'social_trophies', 'social_kudos', 'social_nudge', 'social_set_nudges',
                     'challenge_create', 'challenge_invite', 'challenge_join', 'challenge_decline', 'challenge_leave',
                     'challenge_cancel', 'challenge_dispute', 'challenge_get', 'challenge_list',
                     'duel_create', 'duel_respond', 'duel_cancel', 'duel_get', 'duel_list') then
      execute format('grant execute on function %s to authenticated', f.sig);
    end if;
  end loop;
end $$;
