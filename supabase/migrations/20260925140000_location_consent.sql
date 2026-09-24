-- Gym check-in phase 2 (D30): the app-level location consent, the first of two consent layers
-- (the browser's own permission is the second). null = never asked, false = turned off, true = on.
-- The check-in API ignores coordinates unless this is true.
alter table public.user_goals
  add column location_consent    boolean,
  add column location_consent_at timestamptz;
