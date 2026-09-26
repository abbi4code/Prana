-- Gym place search (D30 addendum, .claude/gym-checkin.md "Place search"). Additive only.
-- Searching goes through our server route (/api/places/search): the provider key stays on the server, results are
-- cached for everyone, and each user is rate limited. place_cache + api_rate are SERVER-ONLY (RLS on, no policies).

-- 1. Where a gym's pin came from, when it was picked from search: { provider, id, label, lat, lng }.
--    The pin the user confirms (lat/lng columns) is what verification uses; this is a reference + the area label
--    shown on the card ("HSR Layout, Bengaluru"). Null when the pin was placed by hand or by current location.
alter table public.user_gyms add column place jsonb
  check (place is null or (jsonb_typeof(place) = 'object' and pg_column_size(place) <= 2048));

-- 2. Shared cache of provider answers. No user id. The key includes the provider, the kind of search, the
--    normalized text and a rounded map position, so it's shared by everyone searching the same thing nearby.
create table public.place_cache (
  key         text primary key,                 -- sha256(provider | kind | query | rounded position)
  provider    text not null,
  kind        text not null check (kind in ('search', 'nearby')),
  query       text not null check (char_length(query) <= 200),
  result      jsonb not null,                   -- validated Place[]
  hits        integer not null default 0,
  created_at  timestamptz not null default now(),
  last_hit_at timestamptz not null default now()
);
create index place_cache_last_hit on public.place_cache (last_hit_at); -- for pruning cold entries
alter table public.place_cache enable row level security;

create function public.bump_place_cache(p_key text) returns void
language sql security definer set search_path = '' as $$
  update public.place_cache set hits = hits + 1, last_hit_at = now() where key = p_key;
$$;

-- 3. Per-user rate limiting for any server route, one counter per (user, bucket, IST day). Same atomic design as
--    consume_parse_quota / consume_gym_rate; new routes should use this instead of adding another table.
create table public.api_rate (
  user_id      uuid not null references auth.users on delete cascade,
  bucket       text not null check (char_length(bucket) between 1 and 40),
  day          date not null,
  day_count    integer not null default 0,
  minute_start timestamptz not null,
  minute_count integer not null default 0,
  primary key (user_id, bucket, day)
);
alter table public.api_rate enable row level security;

create function public.consume_api_rate(p_user uuid, p_bucket text, p_per_minute integer, p_per_day integer)
returns table (allowed boolean, retry_after_s integer)
language plpgsql security definer set search_path = '' as $$
declare
  v_now    timestamptz := now();
  v_day    date := (v_now at time zone 'Asia/Kolkata')::date;
  v_minute timestamptz := date_trunc('minute', v_now);
  r        public.api_rate;
begin
  insert into public.api_rate as u (user_id, bucket, day, day_count, minute_start, minute_count)
  values (p_user, p_bucket, v_day, 1, v_minute, 1)
  on conflict (user_id, bucket, day) do update set
    minute_count = case when u.minute_start = v_minute then u.minute_count + 1 else 1 end,
    minute_start = v_minute,
    day_count    = u.day_count + 1
  returning * into r;

  allowed := r.day_count <= p_per_day and r.minute_count <= p_per_minute;
  retry_after_s := case
    when r.day_count > p_per_day then  -- until IST midnight
      ceil(extract(epoch from ((v_day + 1)::timestamp at time zone 'Asia/Kolkata') - v_now))::integer
    when r.minute_count > p_per_minute then
      ceil(extract(epoch from (v_minute + interval '1 minute') - v_now))::integer
    else 0 end;
  return next;
end $$;

revoke all on function public.consume_api_rate(uuid, text, integer, integer) from public, anon, authenticated;
revoke all on function public.bump_place_cache(text) from public, anon, authenticated;
grant execute on function public.consume_api_rate(uuid, text, integer, integer) to service_role;
grant execute on function public.bump_place_cache(text) to service_role;
