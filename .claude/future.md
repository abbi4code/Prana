# Future Changes & Open Questions

## Open questions (need the owner's call)

| # | Question | Notes |
|---|---|---|
| ~~Q1~~ | ~~App name?~~ | **Resolved 2026-09-24: "Prana"** (D19) |
| Q2 | Sign off "Modern Masala" visual identity (D08)? | Owner likes it but wants it pushed further ("good, not best yet"); keep polishing |
| ~~Q3~~ | ~~Meal slots~~ | In daily use, no objections (D10) |
| Q4 | How to handle fried foods (samosa, puri, pakora, jalebi, namkeen)? | INDB counts the *full* frying oil, not the absorbed amount. For now the app shows them with "~" and a "high estimate" note (D16). Options for a real fix: (a) use INDB value with a documented absorbed-oil adjustment, flagged `low`; (b) find a published absorbed-oil study; (c) manufacturer label for packaged namkeen. |
| Q5 | Food images: AI-generated illustrations vs photos? | D11 proposes illustrations |
| ~~Q6~~ | ~~Chai value~~ | **Resolved:** derived chai (80 g milk + 8 g sugar per 150 ml cup = 89 kcal) + no-sugar variant (D22) |
| ~~Q7~~ | ~~Missing basics~~ | **Resolved:** USDA values for dahi/sugar/honey/butter/bread/cheese/cola (D22); packaged items (toned milk, Parle-G…) via custom foods (D21) |

## Planned future changes

| Change | Why / notes |
|---|---|
| **Home vs restaurant toggle** | Restaurant/dhaba food ≈ 1.5–2× the oil; biggest source of hidden calories |
| **Hidden-calorie chips** | "+ ghee on roti", "+ tadka", "+ sugar in chai" on the food detail |
| **Fried-food fix** (Q4) | Replace "~ high estimate" with a sourced absorbed-oil adjustment |
| NL logging follow-ups | Real-phone voice test (Android + iPhone); prune `parse_cache` / `parse_usage` (pg_cron); grow `evals/nl-parse.jsonl` from real corrections; maybe server STT later (nl-logging.md) |
| Greeting batches 5–7 | Moment lines (streak, back after a break, first day, at gym, workout done, rest day, nothing logged, on track, Monday, weekend); prompt in greetings.md |
| Thali photo logging | Photo → items + katori counts (Claude vision) |
| Weekly Wrapped, calorie bank, festival/shaadi mode, fasting mode | Engagement features from the roadmap (features.md v2) |
| Barcode scan | Packaged foods |
| Realtime sync | Today sync runs on edit/focus/reconnect; Supabase Realtime could push to other open devices |
| Per-dish illustrations (D11) | Category art exists; per-dish art would be the next visual step |
| Import more of INDB (1,014 recipes) / IFCT (542) | `scripts/import-extra.mjs` already reads INDB by code; extend with care (serving sizes, macro check) |
| More packaged brands from official labels | Same method as Yogabar (data.md) |
| Deployment | **Owner does it.** Before deploying: prod URL → `supabase/config.toml` redirect URLs + site_url → `npm run auth:push`; env vars on host |
| Capacitor wrapper | Only if App Store/Play Store presence or native features are needed |

## Parked (not now)

- Social feed / friends
- Recipe pages
- ~~Workout tracking~~: built 2026-09-24, see D27 / workouts.md. Step import from Google Fit / Apple Health still parked

## Change log

| Date | Change |
|---|---|
| 2026-09-24 | Project docs created; `foods.json` v1.0 (120 foods) reviewed |
| 2026-09-24 | `foods (1).json` (176 foods) reviewed: superset of `foods.json`, earlier issues not fixed. See data.md |
| 2026-09-24 | `foods_v2.json` (227 foods) reviewed: most v1 issues fixed; fried-food values, a few suspicious rows and ~25 missing items remain. Now the working file |
| 2026-09-24 | Moved to `data/foods.json`, old files deleted. v1 app built: Next.js 16, local-first, PWA; 224 foods in catalog |
| 2026-09-24 | Desktop/tablet layouts (D17). Google sign-in + sync built (D18) |
| 2026-09-24 | Supabase project `fitness` set up via CLI: migration pushed, Google provider + redirect URLs pushed |
| 2026-09-24 | Renamed to Prana (D19). Food data +41 (D22), custom foods (D21, migration `20260924120000_custom_foods` pushed), design pass: light theme, illustrations, gestures, celebrations (D20, D23) |
| 2026-09-24 | Supplements: whey powder (USDA), creatine (ON label), whey shakes with water/milk (derived); `supplement` category, `scoop` unit kind |
| 2026-09-24 | Thalis / saved meals (D25) + streaks, freezes, year heatmap (D24); migration `20260924130000_saved_meals` pushed |
| 2026-09-24 | Yogabar protein oats & muesli (7 rows) from official label images; `cereal` category |
| 2026-09-24 | Docs reorganised for future sessions: CLAUDE.md rewritten as the entry point, architecture.md added |
| 2026-09-25 | Natural-language + voice logging built (D26): typo-tolerant matcher, `data/aliases.json`, `/api/food/parse` (gpt-6-luna), confirm card, mic, eval 60/60. Migrations `…090000_food_logs_source`, `…093000_nl_parsing` pushed |
| 2026-09-24 | Workouts & calorie burn planned (D27, workouts.md): free-exercise-db library, sets × reps × kg, MET-based burn separate from food, food/workout/global streaks |
| 2026-09-25 | Workouts phase 1 built (D27): Workout tab + sheet, 211 exercises / 400 self-hosted photos, 20 cardio activities, burn estimate, Today Eaten·Burned·Net·Goal + inline goal edit, workout + global streaks with user-picked rest days, heatmap modes, `jamun` token. Migration `…120000_workouts` pushed, RLS verified |
| 2026-09-25 | Desktop log sheets moved from right side panel to centred modals; workout picker two-pane (D28). Filter chips wrap on desktop; toasts sit above sheets |
| 2026-09-25 | NL/voice logging extended to workouts + "yesterday" (D26 addendum): workout sheet gets the ✨ row + mic, one confirm card for food + workouts, burn on device, weight asked if unknown; `MIN_FUZZY` stops weak fuzzy food matches; eval 84/84 (prompt `2026-09-25.3`). No migration |
| 2026-09-25 | "Add anything" (D29): Today bar + sidebar field + / ⌘K open one sheet searching food and workouts; one-tap + (last portion / last session, Undo), mixed recents, thalis, sentence + voice (mic starts from the bar). `searchWorkouts()` in `lib/exercises.ts`; `useSpeech` gained a silent `abort()`. No migration |
| 2026-09-25 | Gym check-in phase 1 (D30): `user_gyms`, `gym_visits` (server-written), `gym_events` (append-only), check-in/out API, timer, offline/guest fallback. Migration `…130000_gym_checkin` pushed; SQL tests in a rolled-back transaction |
| 2026-09-25 | Gym check-in phases 2–3 (D30): location consent (`…140000_location_consent` pushed), explainer + permission states, server Haversine verification with confirm step, gym sheet with current location + Leaflet/OSM map + radius. Dependency: `leaflet` |
| 2026-09-25 | Gym check-in phase 4 (D30): lazy auto-close (last exercise or +1:30, fix end), 20-min minimum, visits count as workout days, nearby banner (on the phone), recent visits. Migration `…150000_gym_autoclose` pushed |
| 2026-09-25 | Today greeting (D31): `data/greetings/batch-1.json` (537 lines, reviewed from 541), `npm run greetings`, `lib/greet.ts` picker, `Greeting` on Today. No migration |
| 2026-09-25 | Greeting batch 4 reviewed (night/late 195; 1,125 total). `on_track` after 8 pm = the real 80–105 % |
| 2026-09-25 | Greeting batches 2–3 reviewed (early/morning 197, afternoon/evening 196; 930 total). Picker: morning until 12, `work` lines weekday-only, breakfast nudges from 8 am, `on_track` = logged and not over, no gym nudges after a workout |
| 2026-09-25 | Lifting kcal: rest length no longer changes calories (Farinatti 2011), only the time shown. Research `data/lift-energy.json` reviewed; per-set work model (v2) waits for a second research pass. Workout goals Save button overflow fixed |
| 2026-09-25 | Lifting burn v2: per-rep costs by movement from research rounds 2–3 (`data/lift-energy*.json`), 157 lifts on the new model, 54 core/conditioning moves on time × MET; dumbbell kg = per dumbbell ("kg each"); Adeel 2021 excluded as implausible |
| 2026-09-25 | Workout week strip with streak emojis (🔥 🌙 ❄️ 🥲), streak band and an "Exercises" view per day (phone list, desktop calendar). Progress re-laid out as an aligned grid: one `StreakShell` for all three streak cards, full-width fluid heatmap, weight + calories equal heights, calorie chart always shows the goal line. No migration |
