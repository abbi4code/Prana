-- Admin panel (decision D51, .claude/admin.md).
-- Who is an admin is decided by the server (ADMIN_EMAILS env, Google sign-in only), never by the browser. The panel
-- reads through the service role: every function below is revoked from public/anon/authenticated and granted only to
-- service_role, and admin_audit has RLS on with no policies. A user's own token can reach none of it.
-- Day keys match the app: food/workout days are the device's local day (IST for Indian users); signups, visits and
-- "today" use Asia/Kolkata. Users without a user_goals row are judged against the app's default goal (2000 kcal).

-- ── 1. Access log: every time an admin opens or exports a user's data, or acts on a report ──
create table public.admin_audit (
  id          bigint generated always as identity primary key,
  admin_id    uuid,
  admin_email text not null,
  action      text not null check (action in ('view_user', 'export_user', 'resolve_report')),
  target_user uuid,                                   -- no FK: the log outlives a deleted account's data
  detail      jsonb,
  created_at  timestamptz not null default now()
);
create index admin_audit_created on public.admin_audit (created_at desc);
alter table public.admin_audit enable row level security;
revoke all on table public.admin_audit from anon, authenticated;

-- ── 2. Helpers ──
-- first day of a window of p_days (7..365) ending today (IST)
create function public.admin_from(p_days integer) returns date
language sql stable set search_path = '' as $$
  select public.ist_today() - (least(greatest(coalesce(p_days, 30), 7), 365) - 1)
$$;

-- every (user, day) with anything logged: a food entry, a workout, or a gym visit
create function public.admin_act() returns table (user_id uuid, day date)
language sql stable security definer set search_path = '' as $$
  select l.user_id, l.logged_on from public.food_logs l where l.deleted_at is null
  union
  select w.user_id, public.safe_date(w.data ->> 'date') from public.workouts w
   where w.deleted_at is null and public.safe_date(w.data ->> 'date') is not null
  union
  select v.user_id, (v.started_at at time zone 'Asia/Kolkata')::date from public.gym_visits v where v.deleted_at is null
$$;

-- ── 3. Overview: growth, activity, retention, when people log ──
create function public.admin_growth(p_days integer) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_t date := public.ist_today();
  v_f date := public.admin_from(p_days);
  v_len integer := v_t - v_f + 1;
  v_pf date := v_f - v_len;               -- previous window, for "vs last period"
  v_kpi jsonb; v_series jsonb; v_ret jsonb; v_hours jsonb; v_sources jsonb;
begin
  select jsonb_build_object(
      'dau', count(distinct a.user_id) filter (where a.day = v_t),
      'wau', count(distinct a.user_id) filter (where a.day > v_t - 7 and a.day <= v_t),
      'mau', count(distinct a.user_id) filter (where a.day > v_t - 30 and a.day <= v_t),
      'active', count(distinct a.user_id) filter (where a.day between v_f and v_t),
      'activePrev', count(distinct a.user_id) filter (where a.day between v_pf and v_f - 1))
    into v_kpi
    from public.admin_act() a;

  v_kpi := v_kpi || jsonb_build_object(
    'users', (select count(*) from auth.users),
    'new', (select count(*) from auth.users where (created_at at time zone 'Asia/Kolkata')::date between v_f and v_t),
    'newPrev', (select count(*) from auth.users where (created_at at time zone 'Asia/Kolkata')::date between v_pf and v_f - 1),
    'signedIn7', (select count(*) from auth.users where last_sign_in_at > now() - interval '7 days'),
    'foodLogs', (select count(*) from public.food_logs where deleted_at is null and logged_on between v_f and v_t),
    'foodLogsPrev', (select count(*) from public.food_logs where deleted_at is null and logged_on between v_pf and v_f - 1),
    'workouts', (select count(*) from public.workouts where deleted_at is null and public.safe_date(data ->> 'date') between v_f and v_t),
    'workoutsPrev', (select count(*) from public.workouts where deleted_at is null and public.safe_date(data ->> 'date') between v_pf and v_f - 1),
    'foodLogsAll', (select count(*) from public.food_logs where deleted_at is null),
    'workoutsAll', (select count(*) from public.workouts where deleted_at is null),
    'visitsAll', (select count(*) from public.gym_visits where deleted_at is null and ended_at is not null and ended_at - started_at >= interval '20 minutes'));

  select coalesce(jsonb_agg(jsonb_build_object(
      'day', d.day, 'signups', coalesce(s.n, 0), 'active', coalesce(a.n, 0),
      'foodUsers', coalesce(fo.nu, 0), 'foodLogs', coalesce(fo.n, 0),
      'workoutUsers', coalesce(w.nu, 0), 'workouts', coalesce(w.n, 0)) order by d.day), '[]'::jsonb)
    into v_series
    from (select g::date as day from generate_series(v_f::timestamp, v_t::timestamp, interval '1 day') g) d
    left join (select (created_at at time zone 'Asia/Kolkata')::date as day, count(*) as n from auth.users group by 1) s on s.day = d.day
    left join (select x.day, count(distinct x.user_id) as n from public.admin_act() x where x.day between v_f and v_t group by 1) a on a.day = d.day
    left join (select logged_on as day, count(*) as n, count(distinct user_id) as nu from public.food_logs
                where deleted_at is null and logged_on between v_f and v_t group by 1) fo on fo.day = d.day
    left join (select public.safe_date(data ->> 'date') as day, count(*) as n, count(distinct user_id) as nu from public.workouts
                where deleted_at is null and public.safe_date(data ->> 'date') between v_f and v_t group by 1) w on w.day = d.day;

  -- came back: the day after signing up; any day in the first week; any day in week 4 (days 22–28)
  with u as (select id, (created_at at time zone 'Asia/Kolkata')::date as d0 from auth.users),
       act as materialized (select * from public.admin_act())
  select jsonb_build_object(
      'd1', jsonb_build_object('eligible', count(*) filter (where u.d0 <= v_t - 1),
        'returned', count(*) filter (where u.d0 <= v_t - 1 and exists (select 1 from act where act.user_id = u.id and act.day = u.d0 + 1))),
      'w1', jsonb_build_object('eligible', count(*) filter (where u.d0 <= v_t - 7),
        'returned', count(*) filter (where u.d0 <= v_t - 7 and exists (select 1 from act where act.user_id = u.id and act.day between u.d0 + 1 and u.d0 + 7))),
      'w4', jsonb_build_object('eligible', count(*) filter (where u.d0 <= v_t - 28),
        'returned', count(*) filter (where u.d0 <= v_t - 28 and exists (select 1 from act where act.user_id = u.id and act.day between u.d0 + 22 and u.d0 + 28))))
    into v_ret
    from u;

  -- when people log (IST weekday × hour): food entries keep the phone's log time; workouts carry theirs in data
  select coalesce(jsonb_agg(jsonb_build_object('dow', h.dow, 'hour', h.hr, 'n', h.n)), '[]'::jsonb)
    into v_hours
    from (
      select extract(isodow from x.ts)::integer - 1 as dow, extract(hour from x.ts)::integer as hr, count(*) as n
        from (
          select l.created_at at time zone 'Asia/Kolkata' as ts from public.food_logs l
           where l.deleted_at is null and l.logged_on between v_f and v_t
          union all
          select to_timestamp((public.jnum(w.data -> 'createdAt') / 1000)::double precision) at time zone 'Asia/Kolkata' from public.workouts w
           where w.deleted_at is null and public.safe_date(w.data ->> 'date') between v_f and v_t and public.jnum(w.data -> 'createdAt') > 0
        ) x
       group by 1, 2
    ) h;

  select coalesce(jsonb_object_agg(s.src, s.n), '{}'::jsonb)
    into v_sources
    from (select coalesce(source, 'manual') as src, count(*) as n from public.food_logs
           where deleted_at is null and logged_on between v_f and v_t group by 1) s;

  return jsonb_build_object('from', v_f, 'to', v_t, 'days', v_len, 'kpi', v_kpi, 'series', v_series,
    'retention', v_ret, 'hours', v_hours, 'sources', v_sources);
end $$;

-- ── 4. Food: what people eat, how close they get to their goals, what the catalog is missing ──
create function public.admin_food(p_days integer) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_t date := public.ist_today();
  v_f date := public.admin_from(p_days);
  v_start timestamptz := v_f::timestamp at time zone 'Asia/Kolkata';
  v_meals jsonb; v_top jsonb; v_custom jsonb; v_days jsonb; v_series jsonb; v_water jsonb; v_goals jsonb; v_misc jsonb;
begin
  select coalesce(jsonb_object_agg(m.meal, m.n), '{}'::jsonb)
    into v_meals
    from (select meal, count(*) as n from public.food_logs where deleted_at is null and logged_on between v_f and v_t group by meal) m;

  select coalesce(jsonb_agg(jsonb_build_object('id', x.food_id, 'name', x.name, 'logs', x.logs, 'users', x.users, 'kcal', x.kcal) order by x.logs desc), '[]'::jsonb)
    into v_top
    from (select food_id, max(name) as name, count(*) as logs, count(distinct user_id) as users, sum(kcal) as kcal
            from public.food_logs where deleted_at is null and logged_on between v_f and v_t
           group by food_id order by logs desc limit 20) x;

  -- foods people had to create themselves = gaps in the catalog (all time)
  select jsonb_build_object(
      'total', (select count(*) from public.custom_foods where deleted_at is null),
      'users', (select count(distinct user_id) from public.custom_foods where deleted_at is null),
      'top', coalesce((
        select jsonb_agg(jsonb_build_object('name', t.name, 'users', t.users, 'logs', t.logs) order by t.users desc, t.logs desc)
          from (select max(c.data ->> 'name') as name, count(distinct c.user_id) as users, coalesce(sum(l.n), 0) as logs
                  from public.custom_foods c
                  left join (select food_id, count(*) as n from public.food_logs where deleted_at is null group by food_id) l on l.food_id = c.id
                 where c.deleted_at is null
                 group by lower(btrim(c.data ->> 'name'))
                 order by 2 desc, 3 desc limit 15) t), '[]'::jsonb))
    into v_custom;

  -- one row per user per logged day, judged like the app's streaks (D24: on target = 80–105 % of the goal)
  with ud as (
    select l.user_id, l.logged_on as day, sum(l.kcal) as kcal, count(*) as n,
           sum(coalesce(l.protein_g, 0)) as p, sum(coalesce(l.carbs_g, 0)) as c, sum(coalesce(l.fat_g, 0)) as fat
      from public.food_logs l
     where l.deleted_at is null and l.logged_on between v_f and v_t
     group by 1, 2),
  j as (select ud.*, coalesce(g.daily_kcal, 2000) as goal from ud left join public.user_goals g on g.user_id = ud.user_id)
  select
    (select jsonb_build_object(
        'userDays', count(*), 'avgKcal', round(avg(kcal)), 'avgGoal', round(avg(goal)), 'avgItems', round(avg(n), 1),
        'on', count(*) filter (where kcal >= goal * 0.8 and kcal <= goal * 1.05),
        'under', count(*) filter (where kcal > 0 and kcal < goal * 0.8),
        'over', count(*) filter (where kcal > goal * 1.05),
        'p', round(avg(p)), 'c', round(avg(c)), 'f', round(avg(fat)))
       from j),
    (select coalesce(jsonb_agg(jsonb_build_object('day', d.day, 'users', coalesce(x.users, 0), 'avgKcal', x.avg_kcal,
                                                  'avgGoal', x.avg_goal, 'on', coalesce(x.on_n, 0), 'logs', coalesce(x.logs, 0)) order by d.day), '[]'::jsonb)
       from (select g::date as day from generate_series(v_f::timestamp, v_t::timestamp, interval '1 day') g) d
       left join (select day, count(*) as users, round(avg(kcal)) as avg_kcal, round(avg(goal)) as avg_goal,
                         count(*) filter (where kcal >= goal * 0.8 and kcal <= goal * 1.05) as on_n, sum(n) as logs
                    from j group by day) x on x.day = d.day)
    into v_days, v_series;

  select jsonb_build_object('userDays', count(*), 'users', count(distinct user_id), 'avg', round(avg(glasses), 1),
                            'eight', count(*) filter (where glasses >= 8))
    into v_water
    from public.water where logged_on between v_f and v_t and glasses > 0;

  select jsonb_build_object(
      'rows', count(*), 'avgGoal', round(avg(daily_kcal)), 'avgProtein', round(avg(protein_g)),
      'noProfile', count(*) filter (where profile is null),
      'aim', jsonb_build_object('lose', count(*) filter (where profile ->> 'aim' = 'lose'),
                                'maintain', count(*) filter (where profile ->> 'aim' = 'maintain'),
                                'gain', count(*) filter (where profile ->> 'aim' = 'gain')),
      'sex', jsonb_build_object('male', count(*) filter (where profile ->> 'sex' = 'male'),
                                'female', count(*) filter (where profile ->> 'sex' = 'female')),
      'avgAge', round(avg(public.jnum(profile -> 'age'))),
      'avgWeight', round(avg(public.jnum(profile -> 'weightKg')), 1))
    into v_goals
    from public.user_goals;

  select jsonb_build_object(
      'weighIns', (select count(*) from public.weights where deleted_at is null and measured_on between v_f and v_t),
      'weighUsers', (select count(distinct user_id) from public.weights where deleted_at is null and measured_on between v_f and v_t),
      'corrections', (select count(*) from public.parse_corrections where created_at >= v_start),
      'thalis', (select count(*) from public.saved_meals where deleted_at is null),
      'thaliUsers', (select count(distinct user_id) from public.saved_meals where deleted_at is null),
      'measureUsers', (select count(distinct user_id) from public.measurements where deleted_at is null))
    into v_misc;

  return jsonb_build_object('from', v_f, 'to', v_t, 'meals', v_meals, 'top', v_top, 'custom', v_custom, 'days', v_days,
    'series', v_series, 'water', v_water, 'goals', v_goals, 'misc', v_misc);
end $$;

-- ── 5. Training: workouts, exercises, gym visits ──
create function public.admin_training(p_days integer) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_t date := public.ist_today();
  v_f date := public.admin_from(p_days);
  v_start timestamptz := v_f::timestamp at time zone 'Asia/Kolkata';
  v_series jsonb; v_refs jsonb; v_tot jsonb; v_gym jsonb; v_misc jsonb;
begin
  with ws as (
    select w.user_id, public.safe_date(w.data ->> 'date') as day, w.data, w.data ->> 'kind' as kind,
           case when jsonb_typeof(w.data -> 'sets') = 'array' then jsonb_array_length(w.data -> 'sets') else 0 end as sets,
           coalesce(public.jnum(w.data -> 'kcal'), 0) as kcal, coalesce(public.jnum(w.data -> 'minutes'), 0) as minutes
      from public.workouts w
     where w.deleted_at is null and public.safe_date(w.data ->> 'date') between v_f and v_t)
  select
    (select coalesce(jsonb_agg(jsonb_build_object('day', d.day, 'lifts', coalesce(x.lifts, 0), 'cardio', coalesce(x.cardio, 0),
                                                  'sets', coalesce(x.sets, 0), 'kcal', coalesce(x.kcal, 0), 'users', coalesce(x.users, 0)) order by d.day), '[]'::jsonb)
       from (select g::date as day from generate_series(v_f::timestamp, v_t::timestamp, interval '1 day') g) d
       left join (select day, count(*) filter (where kind = 'lift') as lifts, count(*) filter (where kind = 'cardio') as cardio,
                         sum(sets) as sets, round(sum(kcal)) as kcal, count(distinct user_id) as users
                    from ws group by day) x on x.day = d.day),
    (select coalesce(jsonb_agg(jsonb_build_object('ref', r.ref, 'kind', r.kind, 'name', r.name, 'logs', r.logs, 'users', r.users,
                                                  'sets', r.sets, 'minutes', r.minutes) order by r.logs desc), '[]'::jsonb)
       from (select data ->> 'refId' as ref, kind, max(data ->> 'name') as name, count(*) as logs, count(distinct user_id) as users,
                    sum(sets) as sets, round(sum(minutes)) as minutes
               from ws group by 1, 2) r),
    (select jsonb_build_object(
        'workouts', count(*), 'lifts', count(*) filter (where kind = 'lift'), 'cardio', count(*) filter (where kind = 'cardio'),
        'sets', coalesce(sum(sets), 0), 'cardioMinutes', coalesce(round(sum(minutes) filter (where kind = 'cardio')), 0),
        'kcal', coalesce(round(sum(kcal)), 0), 'users', count(distinct user_id), 'userDays', count(distinct (user_id, day)),
        'fromRoutine', count(*) filter (where data ? 'routineId'), 'atGym', count(*) filter (where data ? 'visitId'))
       from ws)
    into v_series, v_refs, v_tot;

  with v as (
    select * from public.gym_visits
     where deleted_at is null and (started_at at time zone 'Asia/Kolkata')::date between v_f and v_t)
  select jsonb_build_object(
      'visits', count(*),
      'counted', count(*) filter (where ended_at is not null and ended_at - started_at >= interval '20 minutes'),
      'open', count(*) filter (where ended_at is null),
      'users', count(distinct user_id),
      'avgMin', round(avg(extract(epoch from ended_at - started_at) / 60) filter (where ended_at is not null)),
      'verification', coalesce((select jsonb_object_agg(q.k, q.n) from (select start_verification as k, count(*) as n from v group by 1) q), '{}'::jsonb),
      'status', coalesce((select jsonb_object_agg(q.k, q.n) from (select status as k, count(*) as n from v group by 1) q), '{}'::jsonb),
      'source', coalesce((select jsonb_object_agg(q.k, q.n) from (select source as k, count(*) as n from v group by 1) q), '{}'::jsonb),
      'series', coalesce((select jsonb_agg(jsonb_build_object('day', q.day, 'n', q.n, 'verified', q.ver) order by q.day)
                            from (select (started_at at time zone 'Asia/Kolkata')::date as day, count(*) as n,
                                         count(*) filter (where start_verification = 'verified') as ver
                                    from v group by 1) q), '[]'::jsonb),
      'failedChecks', (select count(*) from public.gym_events where type = 'check_in_attempt_failed' and occurred_at >= v_start))
    into v_gym
    from v;

  select jsonb_build_object(
      'gyms', (select count(*) from public.user_gyms where deleted_at is null),
      'gymsLocated', (select count(*) from public.user_gyms where deleted_at is null and lat is not null),
      'gymsSearched', (select count(*) from public.user_gyms where deleted_at is null and place is not null),
      'consentOn', (select count(*) from public.user_goals where location_consent is true),
      'consentOff', (select count(*) from public.user_goals where location_consent is false),
      'routines', (select count(*) from public.routines where deleted_at is null),
      'routineUsers', (select count(distinct user_id) from public.routines where deleted_at is null),
      'burnGoalUsers', (select count(*) from public.user_goals where public.jnum(fitness -> 'burnGoal') > 0))
    into v_misc;

  return jsonb_build_object('from', v_f, 'to', v_t, 'series', v_series, 'refs', v_refs, 'totals', v_tot, 'gym', v_gym, 'misc', v_misc);
end $$;

-- ── 6. System: AI parsing, API usage, storage, the admin access log ──
create function public.admin_system(p_days integer) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_t date := public.ist_today();
  v_f date := public.admin_from(p_days);
  v_start timestamptz := v_f::timestamp at time zone 'Asia/Kolkata';
  v_parse jsonb; v_cache jsonb; v_corr jsonb; v_api jsonb; v_places jsonb; v_audit jsonb; v_storage jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object('day', p.day, 'requests', p.req, 'users', p.users) order by p.day), '[]'::jsonb)
    into v_parse
    from (select day, sum(day_count) as req, count(*) as users from public.parse_usage where day between v_f and v_t group by day) p;

  -- every cache row is one successful model call (failures aren't cached); hits are answers served without one
  select jsonb_build_object(
      'entries', count(*), 'hits', coalesce(sum(hits), 0), 'newInPeriod', count(*) filter (where created_at >= v_start),
      'top', coalesce((select jsonb_agg(jsonb_build_object('text', t.normalized_text, 'hits', t.hits) order by t.hits desc)
                         from (select normalized_text, hits from public.parse_cache order by hits desc limit 12) t), '[]'::jsonb))
    into v_cache
    from public.parse_cache;

  select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'user', c.user_id, 'email', u.email, 'raw', c.raw_input,
                                               'parsed', c.parsed, 'confirmed', c.confirmed, 'at', c.created_at) order by c.created_at desc), '[]'::jsonb)
    into v_corr
    from (select * from public.parse_corrections order by created_at desc limit 25) c
    left join auth.users u on u.id = c.user_id;

  select coalesce(jsonb_agg(jsonb_build_object('bucket', a.bucket, 'day', a.day, 'requests', a.req, 'users', a.users) order by a.day), '[]'::jsonb)
    into v_api
    from (select bucket, day, sum(day_count) as req, count(*) as users from public.api_rate where day between v_f and v_t group by 1, 2) a;

  select jsonb_build_object('entries', count(*), 'hits', coalesce(sum(hits), 0)) into v_places from public.place_cache;

  select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'admin', a.admin_email, 'action', a.action, 'target', a.target_user,
                                               'targetEmail', u.email, 'detail', a.detail, 'at', a.created_at) order by a.created_at desc), '[]'::jsonb)
    into v_audit
    from (select * from public.admin_audit order by created_at desc limit 40) a
    left join auth.users u on u.id = a.target_user;

  -- rows: the stats collector's live count, else the planner's estimate (-1 = never analysed → 0, shown as unknown)
  select jsonb_build_object(
      'database', pg_catalog.pg_database_size(current_database()),
      'tables', coalesce(jsonb_agg(jsonb_build_object('table', c.relname,
                                                      'rows', greatest(coalesce(nullif(st.n_live_tup, 0), c.reltuples::bigint), 0),
                                                      'bytes', pg_catalog.pg_total_relation_size(c.oid))
                                   order by pg_catalog.pg_total_relation_size(c.oid) desc), '[]'::jsonb))
    into v_storage
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    left join pg_catalog.pg_stat_user_tables st on st.relid = c.oid
   where n.nspname = 'public' and c.relkind = 'r';

  return jsonb_build_object('from', v_f, 'to', v_t, 'parse', v_parse, 'cache', v_cache, 'corrections', v_corr,
    'api', v_api, 'places', v_places, 'audit', v_audit, 'storage', v_storage);
end $$;

-- ── 7. Akhada: profiles, friends, challenges, reports (the moderation queue) ──
create function public.admin_social(p_days integer) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_t date := public.ist_today();
  v_f date := public.admin_from(p_days);
  v_start timestamptz := v_f::timestamp at time zone 'Asia/Kolkata';
  v_kpi jsonb; v_series jsonb; v_top jsonb; v_reports jsonb; v_challenges jsonb; v_duels jsonb := null;
begin
  select jsonb_build_object(
      'profiles', (select count(*) from public.social_profiles),
      'listed', (select count(*) from public.social_profiles where listed),
      'newProfiles', (select count(*) from public.social_profiles where created_at >= v_start),
      'friends', (select count(*) from public.friendships where status = 'accepted'),
      'pending', (select count(*) from public.friendships where status = 'pending'),
      'blocks', (select count(*) from public.social_blocks),
      'reportsOpen', (select count(*) from public.social_reports where resolved_at is null),
      'reportsResolved', (select count(*) from public.social_reports where resolved_at is not null),
      'challenges', (select count(*) from public.challenges),
      'kinds', coalesce((select jsonb_object_agg(k.kind, k.n) from (select kind, count(*) as n from public.challenges group by kind) k), '{}'::jsonb),
      'states', coalesce((select jsonb_object_agg(s.st, s.n) from (
                  select case when cancelled_at is not null then 'cancelled' when starts_on > v_t then 'upcoming'
                              when ends_on < v_t then 'ended' else 'live' end as st, count(*) as n
                    from public.challenges group by 1) s), '{}'::jsonb),
      'members', (select count(*) from public.challenge_members where status = 'joined'),
      'disputes', (select count(*) from public.challenge_disputes),
      'flagged', (select coalesce(sum(flagged), 0) from public.activity_days where day between v_f and v_t))
    into v_kpi;

  select coalesce(jsonb_agg(jsonb_build_object('day', d.day, 'active', coalesce(x.active, 0), 'verified', coalesce(x.verified, 0),
                                               'effort', coalesce(x.effort, 0)) order by d.day), '[]'::jsonb)
    into v_series
    from (select g::date as day from generate_series(v_f::timestamp, v_t::timestamp, interval '1 day') g) d
    left join (select day, count(*) filter (where active) as active, count(*) filter (where verified) as verified,
                      round(avg(effort) filter (where active)) as effort
                 from public.activity_days where day between v_f and v_t group by day) x on x.day = d.day;

  select coalesce(jsonb_agg(jsonb_build_object('user', t.user_id, 'handle', t.handle, 'name', t.display_name, 'avatar', t.avatar,
                                               'active', t.active, 'effort', t.effort, 'verified', t.verified) order by t.active desc, t.effort desc), '[]'::jsonb)
    into v_top
    from (select a.user_id, p.handle, p.display_name, p.avatar, count(*) filter (where a.active) as active,
                 sum(a.effort) as effort, count(*) filter (where a.verified) as verified
            from public.activity_days a join public.social_profiles p on p.user_id = a.user_id
           where a.day between v_f and v_t
           group by 1, 2, 3, 4
           order by 5 desc, 6 desc limit 10) t;

  select coalesce(jsonb_agg(jsonb_build_object(
      'id', r.id, 'reason', r.reason, 'note', r.note, 'at', r.created_at, 'challenge', r.challenge_id,
      'target', r.target, 'targetHandle', tp.handle, 'targetName', tp.display_name, 'targetEmail', tu.email,
      'reporter', r.reporter, 'reporterHandle', rp.handle,
      'openAgainst', (select count(*) from public.social_reports o where o.target = r.target and o.resolved_at is null),
      'hidden', public.social_hidden(r.target)) order by r.created_at desc), '[]'::jsonb)
    into v_reports
    from (select * from public.social_reports where resolved_at is null order by created_at desc limit 50) r
    left join public.social_profiles tp on tp.user_id = r.target
    left join auth.users tu on tu.id = r.target
    left join public.social_profiles rp on rp.user_id = r.reporter;

  select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'title', c.title, 'kind', c.kind, 'audience', c.audience, 'target', c.target,
                                               'startsOn', c.starts_on, 'endsOn', c.ends_on, 'cancelled', c.cancelled_at is not null,
                                               'creator', p.handle, 'members', (select count(*) from public.challenge_members m
                                                                               where m.challenge_id = c.id and m.status = 'joined')) order by c.created_at desc), '[]'::jsonb)
    into v_challenges
    from (select * from public.challenges order by created_at desc limit 12) c
    left join public.social_profiles p on p.user_id = c.creator;

  -- duels arrive with a later Akhada migration; count them only once that table exists
  if to_regclass('public.duels') is not null then
    execute 'select jsonb_build_object(''total'', count(*), ''active'', count(*) filter (where status = ''active''), '
         || '''settled'', count(*) filter (where status = ''settled''), ''pending'', count(*) filter (where status = ''pending'')) from public.duels'
       into v_duels;
  end if;

  return jsonb_build_object('from', v_f, 'to', v_t, 'kpi', v_kpi, 'series', v_series, 'top', v_top, 'reports', v_reports,
    'challenges', v_challenges, 'duels', v_duels);
end $$;

-- a report was looked at and needs no more action (3 open reports hide someone from the global board, D46)
create function public.admin_resolve_report(p_id bigint) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  update public.social_reports set resolved_at = now() where id = p_id and resolved_at is null;
  return found;
end $$;

-- ── 8. Users: one row per account with its activity, searchable and sortable ──
create function public.admin_users(p_q text, p_sort text, p_limit integer, p_offset integer) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_t date := public.ist_today();
  v_q text := nullif(btrim(coalesce(p_q, '')), '');
  v_like text;
  v_total integer; v_rows jsonb;
begin
  if v_q is not null then
    v_like := '%' || replace(replace(replace(lower(v_q), '\', '\\'), '%', '\%'), '_', '\_') || '%';
  end if;

  with u as (
    select au.id, au.email, au.created_at, au.last_sign_in_at,
           coalesce(au.raw_user_meta_data ->> 'full_name', au.raw_user_meta_data ->> 'name') as name,
           au.raw_user_meta_data ->> 'avatar_url' as avatar
      from auth.users au
     where v_like is null
        or lower(coalesce(au.email, '')) like v_like
        or lower(coalesce(au.raw_user_meta_data ->> 'full_name', '')) like v_like
        or au.id::text = v_q),
  f as (select user_id, count(*) as logs, count(distinct logged_on) as days, max(logged_on) as last_day, max(updated_at) as last_at
          from public.food_logs where deleted_at is null group by user_id),
  w as (select user_id, count(*) as n, max(public.safe_date(data ->> 'date')) as last_day, max(updated_at) as last_at
          from public.workouts where deleted_at is null group by user_id),
  v as (select user_id, count(*) as n from public.gym_visits
         where deleted_at is null and ended_at is not null and ended_at - started_at >= interval '20 minutes' group by user_id),
  a7 as (select a.user_id, count(distinct a.day) as n from public.admin_act() a where a.day > v_t - 7 and a.day <= v_t group by 1),
  list as (
    select u.id, u.email, u.name, u.avatar, u.created_at, u.last_sign_in_at,
           coalesce(f.logs, 0) as logs, coalesce(f.days, 0) as days, coalesce(w.n, 0) as workouts, coalesce(v.n, 0) as visits,
           coalesce(a7.n, 0) as active7,
           greatest(f.last_day, w.last_day) as last_day,
           greatest(f.last_at, w.last_at, u.last_sign_in_at) as last_active,
           g.daily_kcal as goal, g.profile ->> 'aim' as aim, sp.handle
      from u
      left join f on f.user_id = u.id
      left join w on w.user_id = u.id
      left join v on v.user_id = u.id
      left join a7 on a7.user_id = u.id
      left join public.user_goals g on g.user_id = u.id
      left join public.social_profiles sp on sp.user_id = u.id),
  ranked as (
    select list.*, row_number() over (order by
             case when p_sort = 'joined' then list.created_at end desc nulls last,
             case when p_sort = 'logs' then list.logs + list.workouts end desc nulls last,
             case when p_sort = 'name' then lower(coalesce(list.name, list.email)) end asc nulls last,
             list.last_active desc nulls last, list.created_at desc) as rn
      from list)
  select (select count(*) from list),
         coalesce((select jsonb_agg(to_jsonb(r) - 'rn' order by r.rn)
                     from ranked r
                    where r.rn > greatest(coalesce(p_offset, 0), 0)
                      and r.rn <= greatest(coalesce(p_offset, 0), 0) + least(greatest(coalesce(p_limit, 50), 1), 200)), '[]'::jsonb)
    into v_total, v_rows;

  return jsonb_build_object('total', v_total, 'rows', v_rows);
end $$;

-- ── 9. Permissions: only the server (service role) can call any of this ──
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
