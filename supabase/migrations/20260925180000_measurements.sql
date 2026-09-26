-- Body measurements (D39): one day's tape measurements in cm, e.g. {"id", "date", "cm": {"waist": 84, "arms": 34}}.
-- Stored as jsonb in the app's shape, like saved_meals and routines. Progress photos are NOT stored here: they stay on
-- the device only (IndexedDB), by design.

create table public.measurements (
  id          text primary key,                 -- "measure-<uuid>", generated on the device
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  data        jsonb not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
create index measurements_user_updated on public.measurements (user_id, updated_at);

alter table public.measurements enable row level security;
create policy "own rows" on public.measurements for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create trigger touch before update on public.measurements for each row execute function public.touch_updated_at();
