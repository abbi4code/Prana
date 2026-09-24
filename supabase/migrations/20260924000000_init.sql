-- Initial schema (decisions D04, D05, D13, D14).
-- The food catalog ships with the app (src/data/foods.generated.json), so there's no foods table yet;
-- food_id is the catalog id. Custom user foods will get their own table later.
-- Rows carry updated_at / deleted_at so the offline-first client can sync (last write wins, soft deletes).

create table public.food_logs (
  id          uuid primary key,                 -- generated on the device
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  logged_on   date not null,
  meal        text not null check (meal in ('breakfast', 'lunch', 'snacks', 'dinner')),
  food_id     text not null,
  name        text not null,                    -- snapshot, survives catalog changes
  unit_id     text not null,
  unit_label  text not null,
  qty         numeric(7, 2) not null check (qty > 0),
  grams       numeric(8, 1) not null,
  kcal        integer not null,
  protein_g   numeric(6, 1),                    -- null when the source had no reliable macros
  carbs_g     numeric(6, 1),
  fat_g       numeric(6, 1),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
create index food_logs_user_day on public.food_logs (user_id, logged_on);
create index food_logs_user_updated on public.food_logs (user_id, updated_at);

create table public.user_goals (
  user_id     uuid primary key default auth.uid() references auth.users on delete cascade,
  daily_kcal  integer not null,
  protein_g   integer not null,
  carbs_g     integer not null,
  fat_g       integer not null,
  profile     jsonb,                            -- sex, age, height, weight, activity, aim
  updated_at  timestamptz not null default now()
);

create table public.weights (
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  measured_on date not null,
  kg          numeric(5, 1) not null check (kg between 20 and 300),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  primary key (user_id, measured_on)
);

create table public.water (
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  logged_on   date not null,
  glasses     smallint not null check (glasses >= 0),
  updated_at  timestamptz not null default now(),
  primary key (user_id, logged_on)
);

-- Row Level Security: every user sees and edits only their own rows.
alter table public.food_logs  enable row level security;
alter table public.user_goals enable row level security;
alter table public.weights    enable row level security;
alter table public.water      enable row level security;

create policy "own rows" on public.food_logs  for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own rows" on public.user_goals for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own rows" on public.weights    for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own rows" on public.water      for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- keep updated_at honest on every write
create function public.touch_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger touch before update on public.food_logs  for each row execute function public.touch_updated_at();
create trigger touch before update on public.user_goals for each row execute function public.touch_updated_at();
create trigger touch before update on public.weights    for each row execute function public.touch_updated_at();
create trigger touch before update on public.water      for each row execute function public.touch_updated_at();
