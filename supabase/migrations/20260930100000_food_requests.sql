-- Missing-food requests (decision D54 phase 1, .claude/food-requests.md).
-- What people look for and can't find: a "Request it" tap, a search closed with no result, an AI-logging item with no
-- match, a custom food they had to create. Signed-in users only; the food name is the only thing stored about the
-- search. Both tables have RLS on and no policies: the app writes through food_request_add() (security definer,
-- rate limited), the admin panel reads and triages through admin_* functions only the service role can call.

create table public.food_requests (
  id         bigint generated always as identity primary key,
  -- lower case, punctuation → space, spaces collapsed: one row per food name however it's typed
  name_norm  text not null unique check (char_length(name_norm) between 2 and 60),
  name       text not null check (char_length(name) between 2 and 60),       -- first spelling seen, for display
  status     text not null default 'new' check (status in ('new', 'alias', 'researching', 'found', 'not_found', 'junk')),
  reason     text check (char_length(reason) <= 300),
  food_id    text check (char_length(food_id) <= 80),                        -- the food it turned out to be (alias / found)
  first_seen timestamptz not null default now(),
  last_seen  timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index food_requests_last_seen on public.food_requests (last_seen desc);

-- who asked, and how: one row per (request, user, signal); `times` counts repeats
create table public.food_request_users (
  request_id  bigint not null references public.food_requests on delete cascade,
  user_id     uuid not null references auth.users on delete cascade,
  via         text not null check (via in ('request', 'search', 'ai', 'custom')),
  times       integer not null default 1,
  created_at  timestamptz not null default now(),
  last_at     timestamptz not null default now(),
  notified_at timestamptz,                                                    -- phase 5: "X is in Prana now"
  primary key (request_id, user_id, via)
);
create index food_request_users_user on public.food_request_users (user_id);

alter table public.food_requests enable row level security;
alter table public.food_request_users enable row level security;
revoke all on table public.food_requests, public.food_request_users from anon, authenticated;

create trigger touch before update on public.food_requests
  for each row execute function public.touch_updated_at();

-- the one key every spelling of a name maps to: ASCII punctuation and the danda (। ॥) become spaces. Not
-- [[:punct:]]: depending on the locale it also matches the virama (्) and splits conjuncts (भुर्जी → भुर जी).
create function public.food_request_key(p text) returns text
language sql immutable set search_path = '' as $$
  select btrim(regexp_replace(regexp_replace(lower(coalesce(p, '')), '[!-/:-@[-`{-~।॥]+', ' ', 'g'), '\s+', ' ', 'g'))
$$;

-- ── the app: record one signal ──
-- Returns how many people have asked for this food and whether it's been added, for the "Request it" row.
create function public.food_request_add(p_name text, p_via text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_name text := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
  v_key  text := public.food_request_key(p_name);
  v_rate record;
  v_req  public.food_requests;
begin
  if v_user is null then raise exception 'not_signed_in' using errcode = '28000'; end if;
  if p_via is null or p_via not in ('request', 'search', 'ai', 'custom') then raise exception 'bad_request'; end if;
  -- 2..60 characters with at least one letter (any script): not digits or punctuation alone
  if char_length(v_name) not between 2 and 60 or char_length(v_key) < 2 or v_key !~ '[^[:digit:][:space:]]' then
    raise exception 'bad_name';
  end if;

  select * into v_rate from public.consume_api_rate(v_user, 'food_request', 20, 150);
  if not v_rate.allowed then raise exception 'rate_limited:%', v_rate.retry_after_s using errcode = 'P0001'; end if;

  insert into public.food_requests as r (name_norm, name) values (v_key, v_name)
  on conflict (name_norm) do update set last_seen = now()
  returning * into v_req;

  insert into public.food_request_users as u (request_id, user_id, via) values (v_req.id, v_user, p_via)
  on conflict (request_id, user_id, via) do update set times = u.times + 1, last_at = now();

  return jsonb_build_object(
    'people', (select count(distinct user_id) from public.food_request_users where request_id = v_req.id),
    'status', case when v_req.status = 'found' then 'found' else 'waiting' end);
end $$;

revoke all on function public.food_request_key(text) from public, anon, authenticated;
revoke all on function public.food_request_add(text, text) from public, anon;
grant execute on function public.food_request_add(text, text) to authenticated;

-- ── the admin panel ──
-- Requests with activity in the window, most wanted first: explicit requests weigh most, then how many people.
-- p_filter: open (new + researching) · done (alias, found, not found) · junk · all
create function public.admin_food_requests(p_days integer, p_filter text default 'open') returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_from timestamptz := (public.admin_from(p_days)::timestamp at time zone 'Asia/Kolkata');
  v_rows jsonb;
  v_counts jsonb;
begin
  with per as (
    select u.request_id,
           count(distinct u.user_id) as people,
           count(distinct u.user_id) filter (where u.via = 'request') as asked,
           count(distinct u.user_id) filter (where u.via = 'search') as searched,
           count(distinct u.user_id) filter (where u.via = 'ai') as ai,
           count(distinct u.user_id) filter (where u.via = 'custom') as custom,
           sum(u.times) as times
      from public.food_request_users u group by u.request_id),
  rows as (
    select r.*, coalesce(p.people, 0) as people, coalesce(p.asked, 0) as asked, coalesce(p.searched, 0) as searched,
           coalesce(p.ai, 0) as ai, coalesce(p.custom, 0) as custom, coalesce(p.times, 0) as times
      from public.food_requests r left join per p on p.request_id = r.id
     where r.last_seen >= v_from
       and case coalesce(p_filter, 'open')
             when 'open' then r.status in ('new', 'researching')
             when 'done' then r.status in ('alias', 'found', 'not_found')
             when 'junk' then r.status = 'junk'
             else true end)
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', x.id, 'name', x.name, 'status', x.status, 'reason', x.reason, 'foodId', x.food_id,
           'firstSeen', x.first_seen, 'lastSeen', x.last_seen, 'people', x.people, 'asked', x.asked,
           'searched', x.searched, 'ai', x.ai, 'custom', x.custom, 'times', x.times)
         order by x.asked desc, x.people desc, x.last_seen desc), '[]'::jsonb)
    into v_rows
    from (select * from rows order by asked desc, people desc, last_seen desc limit 300) x;

  select jsonb_build_object(
           'open', count(*) filter (where status in ('new', 'researching')),
           'done', count(*) filter (where status in ('alias', 'found', 'not_found')),
           'junk', count(*) filter (where status = 'junk'),
           'people', (select count(distinct u.user_id) from public.food_request_users u
                        join public.food_requests r2 on r2.id = u.request_id
                       where r2.last_seen >= v_from and r2.status in ('new', 'researching')))
    into v_counts
    from public.food_requests where last_seen >= v_from;

  return jsonb_build_object('counts', v_counts, 'rows', v_rows);
end $$;

-- Triage one request: alias (it's an existing food under another name), not_found, junk, or back to new.
-- found / researching are set by the research steps (phases 2–3), not by hand.
create function public.admin_food_request_set(p_id bigint, p_status text, p_food_id text default null, p_reason text default null)
returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if p_status not in ('new', 'alias', 'not_found', 'junk') then raise exception 'bad_request'; end if;
  if p_status = 'alias' and coalesce(btrim(p_food_id), '') = '' then raise exception 'bad_request'; end if;
  update public.food_requests
     set status = p_status,
         food_id = case when p_status = 'alias' then btrim(p_food_id) when p_status = 'new' then null else food_id end,
         reason = nullif(btrim(coalesce(p_reason, '')), '')
   where id = p_id;
  return found;
end $$;

-- triage is logged like every other admin action (D51)
alter table public.admin_audit drop constraint admin_audit_action_check;
alter table public.admin_audit add constraint admin_audit_action_check
  check (action in ('view_user', 'export_user', 'resolve_report', 'food_request'));

-- only the server (service role) can call admin_* (same loop as the admin migration, re-run for the new ones)
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname like 'admin\_%'
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
    execute format('grant execute on function %s to service_role', f.sig);
  end loop;
end $$;
