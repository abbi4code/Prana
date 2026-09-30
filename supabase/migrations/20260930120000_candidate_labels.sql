-- Label readings on food candidates (decision D54 phase 4, .claude/food-requests.md).
-- For a food whose numbers come from an official label (MFR_LABEL), a vision model copies the label image into fixed
-- fields and the review card shows the image beside the numbers with a ✓ / ≠ per value. The reading lives with the
-- candidate: { image (https URL, or an uploaded photo as a data URL, shown only in the admin panel), reading, per100,
-- model, read_at, read_by }. The owner ticks "matches the label" on Approve (checked by the server).

alter table public.food_candidates add column label jsonb check (label is null or jsonb_typeof(label) = 'object');

-- the review list, now with each candidate's label reading (same as 20260930110000 otherwise)
create or replace function public.admin_food_review(p_status text default 'pending') returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'candidates', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', c.id, 'foodId', c.food_id, 'data', c.data, 'source', c.source, 'warnings', to_jsonb(c.warnings),
               'model', c.model, 'status', c.status, 'reason', c.reason, 'createdAt', c.created_at,
               'decidedAt', c.decided_at, 'decidedBy', c.decided_by, 'label', c.label,
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
revoke all on function public.admin_food_review(text) from public, anon, authenticated;
grant execute on function public.admin_food_review(text) to service_role;
