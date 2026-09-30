-- Health tab (D55, .claude/habits.md): blood-pressure readings, daily tobacco counts, and the health questions
-- the risk scores need. Readings and tobacco days are stored as jsonb in the app's shape, like measurements
-- (one entry per day each). Synced like every other user table (owner's choice): RLS "own rows".

-- 1. Blood pressure, one reading a day: {"id", "date", "sys", "dia", "pulse"?, "createdAt"}
create table public.blood_pressure (
  id          text primary key,                 -- "bp-<uuid>", generated on the device
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  data        jsonb not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
create index blood_pressure_user_updated on public.blood_pressure (user_id, updated_at);
alter table public.blood_pressure enable row level security;
create policy "own rows" on public.blood_pressure for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create trigger touch before update on public.blood_pressure for each row execute function public.touch_updated_at();

-- 2. Tobacco per day: {"id", "date", "counts": {"cigarette": 6, "bidi": 2, ...}, "createdAt"}
--    Alcohol is NOT stored here: it comes from the drinks already logged in food_logs (D53).
create table public.habit_days (
  id          text primary key,                 -- "habit-<uuid>", generated on the device
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  data        jsonb not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
create index habit_days_user_updated on public.habit_days (user_id, updated_at);
alter table public.habit_days enable row level security;
create policy "own rows" on public.habit_days for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create trigger touch before update on public.habit_days for each row execute function public.touch_updated_at();

-- 3. Health questions + Habits settings (diabetes, BP diagnosis, family history, activity, diet items, stress,
--    habits on/off, tobacco kinds, prices...). Pushed with the goals row, like `fitness`.
alter table public.user_goals add column health jsonb;
