-- Saved meals ("thalis"): a named list of { foodId, unitId, qty } logged in one tap.
-- Stored as jsonb in the app's shape, like custom_foods.

create table public.saved_meals (
  id          text primary key,                 -- "thali-<uuid>", generated on the device
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  data        jsonb not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
create index saved_meals_user_updated on public.saved_meals (user_id, updated_at);

alter table public.saved_meals enable row level security;
create policy "own rows" on public.saved_meals for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create trigger touch before update on public.saved_meals for each row execute function public.touch_updated_at();
