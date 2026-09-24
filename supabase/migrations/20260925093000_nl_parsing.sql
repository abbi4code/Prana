-- Natural-language logging, Phase 2 (nl-logging.md, Part 3). Additive only.
-- parse_cache + parse_usage are SERVER-ONLY: RLS on, no policies, so anon/authenticated clients can't
-- read or write them; the Next.js route uses the service role (SUPABASE_SECRET_KEY).

-- 1. Shared cache of LLM parses. Stores no user id. Key includes prompt version + model, so changing
--    either invalidates old entries automatically.
create table public.parse_cache (
  key             text primary key,                 -- sha256(prompt_version | model | normalized_text)
  normalized_text text not null check (char_length(normalized_text) <= 500),
  model           text not null,
  prompt_version  text not null,
  result          jsonb not null,                   -- validated { meal, items[] }; never nutrition numbers
  hits            integer not null default 0,
  created_at      timestamptz not null default now(),
  last_hit_at     timestamptz not null default now()
);
create index parse_cache_last_hit on public.parse_cache (last_hit_at); -- for pruning cold entries
alter table public.parse_cache enable row level security;

create function public.bump_parse_cache(p_key text) returns void
language sql security definer set search_path = '' as $$
  update public.parse_cache set hits = hits + 1, last_hit_at = now() where key = p_key;
$$;

-- 2. Per-user rate limiting: one row per user per IST day; a single atomic upsert counts the request
--    in both windows (per minute, per day). Rejected requests are counted too, so hammering doesn't help.
create table public.parse_usage (
  user_id      uuid not null references auth.users on delete cascade,
  day          date not null,
  day_count    integer not null default 0,
  minute_start timestamptz not null,
  minute_count integer not null default 0,
  primary key (user_id, day)
);
alter table public.parse_usage enable row level security;

create function public.consume_parse_quota(p_user uuid, p_per_minute integer, p_per_day integer)
returns table (allowed boolean, retry_after_s integer, used_today integer)
language plpgsql security definer set search_path = '' as $$
declare
  v_now    timestamptz := now();
  v_day    date := (v_now at time zone 'Asia/Kolkata')::date;
  v_minute timestamptz := date_trunc('minute', v_now);
  r        public.parse_usage;
begin
  insert into public.parse_usage as u (user_id, day, day_count, minute_start, minute_count)
  values (p_user, v_day, 1, v_minute, 1)
  on conflict (user_id, day) do update set
    minute_count = case when u.minute_start = v_minute then u.minute_count + 1 else 1 end,
    minute_start = v_minute,
    day_count    = u.day_count + 1
  returning * into r;

  allowed    := r.day_count <= p_per_day and r.minute_count <= p_per_minute;
  used_today := r.day_count;
  retry_after_s := case
    when r.day_count > p_per_day then  -- until IST midnight
      ceil(extract(epoch from ((v_day + 1)::timestamp at time zone 'Asia/Kolkata') - v_now))::integer
    when r.minute_count > p_per_minute then
      ceil(extract(epoch from (v_minute + interval '1 minute') - v_now))::integer
    else 0 end;
  return next;
end $$;

revoke all on function public.consume_parse_quota(uuid, integer, integer) from public, anon, authenticated;
revoke all on function public.bump_parse_cache(text) from public, anon, authenticated;
grant execute on function public.consume_parse_quota(uuid, integer, integer) to service_role;
grant execute on function public.bump_parse_cache(text) to service_role;

-- 3. What users changed on the confirm card (original parse vs confirmed). Written by the signed-in
--    client; used later to improve data/aliases.json and defaults.
create table public.parse_corrections (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  raw_input  text not null check (char_length(raw_input) <= 500),
  parsed     jsonb not null,
  confirmed  jsonb not null,
  created_at timestamptz not null default now()
);
create index parse_corrections_created on public.parse_corrections (created_at);
alter table public.parse_corrections enable row level security;
create policy "insert own" on public.parse_corrections for insert with check (user_id = (select auth.uid()));
create policy "read own" on public.parse_corrections for select using (user_id = (select auth.uid()));
