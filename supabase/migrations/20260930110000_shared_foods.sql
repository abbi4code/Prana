-- Shared foods (decision D54 phase 2, .claude/food-requests.md).
-- Foods added after the app was built: a candidate (from research, phase 3) is checked by the owner in the admin
-- panel; Approve copies it into shared_foods, and every device (guests too) downloads it through catalog_updates()
-- and merges it into search next to the built-in catalog. Names the admin marked "Same as" (an alias of an existing
-- food) ship the same way. Both tables: RLS on, no policies; only the service role writes, everyone reads through
-- catalog_updates().

-- ── candidates: a food waiting for the owner's check ──
create table public.food_candidates (
  id         bigint generated always as identity primary key,
  request_id bigint references public.food_requests on delete set null,
  food_id    text not null check (food_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(food_id) <= 80),
  -- the food exactly as the app uses it (lib/types.ts Food): per 100 g, units, default unit, source id, confidence
  data       jsonb not null check (jsonb_typeof(data) = 'object' and data ->> 'id' = food_id),
  -- where the numbers come from: { id: INDB|IFCT2017|USDA|DERIVED|MFR_LABEL, ref, url, image_url?, row_name? }
  source     jsonb not null default '{}'::jsonb,
  warnings   text[] not null default '{}',                     -- the checker's notes, shown on the review card
  research   jsonb,                                            -- the AI's raw reply (phase 3), for the record
  model      text,
  status     text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reason     text check (char_length(reason) <= 300),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by text
);
create index food_candidates_status on public.food_candidates (status, created_at desc);

-- ── shared foods: approved, live for everyone ──
create table public.shared_foods (
  id           text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(id) <= 80),
  data         jsonb not null check (jsonb_typeof(data) = 'object' and data ->> 'id' = id),
  candidate_id bigint references public.food_candidates on delete set null,
  request_id   bigint references public.food_requests on delete set null,
  approved_by  text,
  approved_at  timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz                                     -- retracted: devices drop it; old logs keep their snapshot
);
create index shared_foods_updated on public.shared_foods (updated_at);

alter table public.food_candidates enable row level security;
alter table public.shared_foods enable row level security;
revoke all on table public.food_candidates, public.shared_foods from anon, authenticated;

create trigger touch before update on public.shared_foods
  for each row execute function public.touch_updated_at();

-- ── every device: what changed since the last check ──
-- foods: rows updated after p_since (retracted ones too, so devices drop them); aliases: the full list (small).
-- `at` = the newest updated_at returned, the next p_since.
create function public.catalog_updates(p_since timestamptz default null) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'foods', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'data', s.data, 'deleted', s.deleted_at is not null) order by s.updated_at)
                         from public.shared_foods s where p_since is null or s.updated_at > p_since), '[]'::jsonb),
    'aliases', coalesce((select jsonb_agg(jsonb_build_object('name', lower(r.name), 'foodId', r.food_id))
                           from (select name, food_id from public.food_requests
                                  where status in ('alias', 'found') and food_id is not null
                                  order by updated_at desc limit 2000) r), '[]'::jsonb),
    'at', (select max(updated_at) from public.shared_foods where p_since is null or updated_at > p_since))
$$;
revoke all on function public.catalog_updates(timestamptz) from public;
grant execute on function public.catalog_updates(timestamptz) to anon, authenticated;

-- ── the admin panel ──
-- candidates waiting (or decided), with the request behind each; plus every shared food (live and retracted)
create function public.admin_food_review(p_status text default 'pending') returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'candidates', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', c.id, 'foodId', c.food_id, 'data', c.data, 'source', c.source, 'warnings', to_jsonb(c.warnings),
               'model', c.model, 'status', c.status, 'reason', c.reason, 'createdAt', c.created_at,
               'decidedAt', c.decided_at, 'decidedBy', c.decided_by,
               'live', exists (select 1 from public.shared_foods s where s.id = c.food_id and s.deleted_at is null),
               'request', case when r.id is null then null else jsonb_build_object(
                 'id', r.id, 'name', r.name,
                 'people', (select count(distinct u.user_id) from public.food_request_users u where u.request_id = r.id)) end)
             order by c.created_at desc)
        from public.food_candidates c left join public.food_requests r on r.id = c.request_id
       where c.status = coalesce(p_status, 'pending')), '[]'::jsonb),
    'shared', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', s.id, 'data', s.data, 'approvedBy', s.approved_by, 'approvedAt', s.approved_at,
               'retracted', s.deleted_at is not null, 'requestName', r.name)
             order by s.deleted_at nulls first, s.approved_at desc)
        from public.shared_foods s left join public.food_requests r on r.id = s.request_id), '[]'::jsonb))
$$;

-- Approve: the candidate becomes (or updates) the shared food, its request is marked found. Reject: kept with a reason.
-- Returns 'approved' | 'rejected' | 'not_found' | 'decided' (already approved / rejected).
create function public.admin_food_candidate_decide(p_id bigint, p_decision text, p_by text, p_reason text default null)
returns text
language plpgsql security definer set search_path = '' as $$
declare c public.food_candidates;
begin
  if p_decision not in ('approve', 'reject') then raise exception 'bad_request'; end if;
  select * into c from public.food_candidates where id = p_id for update;
  if not found then return 'not_found'; end if;
  if c.status <> 'pending' then return 'decided'; end if;

  if p_decision = 'reject' then
    update public.food_candidates
       set status = 'rejected', reason = nullif(btrim(coalesce(p_reason, '')), ''), decided_at = now(), decided_by = p_by
     where id = p_id;
    return 'rejected';
  end if;

  insert into public.shared_foods as s (id, data, candidate_id, request_id, approved_by)
  values (c.food_id, c.data, c.id, c.request_id, p_by)
  on conflict (id) do update
    set data = excluded.data, candidate_id = excluded.candidate_id, request_id = coalesce(excluded.request_id, s.request_id),
        approved_by = excluded.approved_by, approved_at = now(), deleted_at = null;
  update public.food_candidates set status = 'approved', decided_at = now(), decided_by = p_by where id = p_id;
  if c.request_id is not null then
    update public.food_requests set status = 'found', food_id = c.food_id where id = c.request_id;
  end if;
  return 'approved';
end $$;

-- Retract a shared food (devices drop it on their next check) or bring it back.
create function public.admin_shared_food_set(p_id text, p_live boolean) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  update public.shared_foods
     set deleted_at = case when p_live then null else coalesce(deleted_at, now()) end
   where id = p_id;
  return found;
end $$;

alter table public.admin_audit drop constraint admin_audit_action_check;
alter table public.admin_audit add constraint admin_audit_action_check
  check (action in ('view_user', 'export_user', 'resolve_report', 'food_request', 'food_candidate', 'shared_food'));

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
