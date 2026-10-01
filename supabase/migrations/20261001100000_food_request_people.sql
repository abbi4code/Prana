-- Who asked for a missing food (D54, admin Requests tab): one row per person behind a request, with how they asked
-- (Request it / search / AI / made their own) and when. Read only through the admin API (service role); the route
-- writes an admin_audit row each time it's opened (D51: looking at members' data always leaves a trace).

create function public.admin_food_request_people(p_id bigint) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(x order by (x ->> 'asked')::boolean desc, x ->> 'lastAt' desc), '[]'::jsonb)
    from (
      select jsonb_build_object(
               'user', u.user_id,
               'email', au.email,
               'name', coalesce(au.raw_user_meta_data ->> 'full_name', au.raw_user_meta_data ->> 'name'),
               'avatar', au.raw_user_meta_data ->> 'avatar_url',
               'handle', sp.handle,
               'asked', bool_or(u.via = 'request'),
               'times', sum(u.times),
               'firstAt', min(u.created_at),
               'lastAt', max(u.last_at),
               'signals', jsonb_agg(jsonb_build_object('via', u.via, 'times', u.times, 'firstAt', u.created_at, 'lastAt', u.last_at) order by u.created_at)
             ) as x
        from public.food_request_users u
        left join auth.users au on au.id = u.user_id
        left join public.social_profiles sp on sp.user_id = u.user_id
       where u.request_id = p_id
       group by u.user_id, au.email, au.raw_user_meta_data, sp.handle
    ) s
$$;

revoke all on function public.admin_food_request_people(bigint) from public, anon, authenticated;
grant execute on function public.admin_food_request_people(bigint) to service_role;
