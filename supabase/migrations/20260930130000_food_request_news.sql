-- "Your food is in Prana now" (decision D54 phase 5, .claude/food-requests.md).
-- People who tapped "Request it" or had to make the food themselves hear when it's added (a shared food approved →
-- request 'found') or turns out to be another name for an existing food (request 'alias'). Silent signals (a search
-- that found nothing, an AI miss) don't: nobody was promised anything. Each piece of news shows once:
-- food_request_users.notified_at (added in 20260930100000) is set when the person dismisses or acts on it.

-- the signed-in user's unseen news, newest first (60 days; `custom` = they made their own version, offer to swap)
create function public.food_request_news() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(x order by x ->> 'at' desc), '[]'::jsonb)
    from (
      select jsonb_build_object('id', r.id, 'name', r.name, 'foodId', r.food_id, 'status', r.status,
                                'custom', bool_or(u.via = 'custom'), 'at', r.updated_at) as x
        from public.food_request_users u
        join public.food_requests r on r.id = u.request_id
       where u.user_id = auth.uid()
         and u.via in ('request', 'custom')
         and u.notified_at is null
         and r.status in ('found', 'alias') and r.food_id is not null
         and r.updated_at > now() - interval '60 days'
       group by r.id) t
$$;

-- mark news seen (dismissed, logged or swapped); returns how many signals it closed
create function public.food_request_seen(p_ids bigint[]) returns integer
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  if auth.uid() is null then raise exception 'not_signed_in' using errcode = '28000'; end if;
  update public.food_request_users
     set notified_at = now()
   where user_id = auth.uid() and request_id = any (coalesce(p_ids, '{}')) and notified_at is null;
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function public.food_request_news() from public, anon;
revoke all on function public.food_request_seen(bigint[]) from public, anon;
grant execute on function public.food_request_news() to authenticated;
grant execute on function public.food_request_seen(bigint[]) to authenticated;
