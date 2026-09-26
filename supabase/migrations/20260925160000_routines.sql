-- Routines ("Chest day", "Push"): a named, ordered list of exercises / cardio, logged in one tap or as a checklist.
-- Stored as jsonb in the app's shape, like saved_meals. Numbers aren't stored: each exercise repeats your last
-- session (workouts.md "Routines").

create table public.routines (
  id          text primary key,                 -- "routine-<uuid>", generated on the device
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  data        jsonb not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
create index routines_user_updated on public.routines (user_id, updated_at);

alter table public.routines enable row level security;
create policy "own rows" on public.routines for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create trigger touch before update on public.routines for each row execute function public.touch_updated_at();
