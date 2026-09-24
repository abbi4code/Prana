-- Workouts (decision D26): logged exercises + cardio, stored as jsonb in the app's shape like saved_meals.
-- Burn is estimated on the device and snapshotted in `data` (kcal, minutes, met), like food_logs.

create table public.workouts (
  id          text primary key,                 -- uuid generated on the device
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  data        jsonb not null,                   -- { date, kind, refId, name, sets?, minutes, met, kcal, ... }
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
create index workouts_user_updated on public.workouts (user_id, updated_at);

alter table public.workouts enable row level security;
create policy "own rows" on public.workouts for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create trigger touch before update on public.workouts for each row execute function public.touch_updated_at();

-- workout goals: { burnGoal: number | null, restDays: number[] } (0 = Sunday)
alter table public.user_goals add column fitness jsonb;
