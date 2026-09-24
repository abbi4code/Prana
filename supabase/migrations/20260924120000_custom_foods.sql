-- User-created foods (for anything missing from the catalog, e.g. a packet's label values).
-- The whole food is stored as jsonb in the app's catalog shape, so the client needs no mapping.

create table public.custom_foods (
  id          text primary key,                 -- "custom-<uuid>", generated on the device
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  data        jsonb not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
create index custom_foods_user_updated on public.custom_foods (user_id, updated_at);

alter table public.custom_foods enable row level security;
create policy "own rows" on public.custom_foods for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create trigger touch before update on public.custom_foods for each row execute function public.touch_updated_at();
