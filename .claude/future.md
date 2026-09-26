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
| Thali photo logging | Photo → items + katori counts (Claude vision) |
| Weekly Wrapped, calorie bank, festival/shaadi mode, fasting mode | Engagement features from the roadmap (features.md v2) |
| Barcode scan | Packaged foods |
| Realtime sync | Today sync runs on edit/focus/reconnect; Supabase Realtime could push to other open devices |
| Per-dish illustrations (D11) | Category art exists; per-dish art would be the next visual step |
| Import more of INDB (1,014 recipes) / IFCT (542) | `scripts/import-extra.mjs` already reads INDB by code; extend with care (serving sizes, macro check) |
| More packaged brands from official labels | Same method as Yogabar (data.md) |
| Deployment | **Owner does it.** Before deploying: prod URL → `supabase/config.toml` redirect URLs + site_url → `npm run auth:push`; env vars on host |
| Gym place search follow-ups (D37) | Smoke-test with the real Geoapify key; prune `place_cache` / `api_rate` (pg_cron, with the parse tables); compare Ola Maps on ~20 real gym names once its storage terms are confirmed in writing; maybe reverse-geocode a hand-placed pin for an area label |
| Capacitor wrapper | Only if App Store/Play Store presence or native features are needed |

## Parked (not now)

- Social feed (friends, boards and challenges are built: D46, D47)
- Recipe pages
- ~~Workout tracking~~: built 2026-09-24, see D27 / workouts.md. Step import from Google Fit / Apple Health still parked

## Change log

| Date | Change |
|---|---|
| 2026-09-25 | Rest timer + last session per set (D40), Muscles this week (D41), Body measurements + device-only progress photos (D39). Migration `…180000_measurements` **needs `npm run db:push`** (blocked for the session) |
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
| 2026-09-25 | Workout week (D35): hover a day to peek, click to stretch it open, chevrons on days with workouts, doodle arrow (desktop) / ping (phone) toward Exercises until used once |
| 2026-09-25 | Workout tab activity rings (D33): burn today, Move 150 min + Strength 2 days a week (WHO 2020), `lib/activity.ts`; `BurnSummary` removed; Workout-tab streak note behind (i) |
| 2026-09-25 | Today desktop layout (D32): summary left, chai · water · burned tiles + meals list right from 1280 px; one column at 1024–1279; meal cards no longer stretch |
| 2026-09-25 | Greeting batches 5–7 reviewed (moments, 815; 1,940 total, complete). `prana-greetings-all.json` (unreviewed merge) not used. Picker: rest-day lines may mention the gym; no Monday/weekend gym nudges after a workout |
| 2026-09-25 | Greeting batch 4 reviewed (night/late 195; 1,125 total). `on_track` after 8 pm = the real 80–105 % |
| 2026-09-25 | Greeting batches 2–3 reviewed (early/morning 197, afternoon/evening 196; 930 total). Picker: morning until 12, `work` lines weekday-only, breakfast nudges from 8 am, `on_track` = logged and not over, no gym nudges after a workout |
| 2026-09-25 | Lifting kcal: rest length no longer changes calories (Farinatti 2011), only the time shown. Research `data/lift-energy.json` reviewed; per-set work model (v2) waits for a second research pass. Workout goals Save button overflow fixed |
| 2026-09-25 | Lifting burn v2: per-rep costs by movement from research rounds 2–3 (`data/lift-energy*.json`), 157 lifts on the new model, 54 core/conditioning moves on time × MET; dumbbell kg = per dumbbell ("kg each"); Adeel 2021 excluded as implausible |
| 2026-09-25 | Workout week strip with streak emojis (🔥 🌙 ❄️ 🥲), streak band and an "Exercises" view per day (phone list, desktop calendar). Progress re-laid out as an aligned grid: one `StreakShell` for all three streak cards, full-width fluid heatmap, weight + calories equal heights, calorie chart always shows the goal line. No migration |
| 2026-09-25 | Routines (D34): cards, checklist (tick = logged), Log all, ACSM overload hint, builder + picker, starters, "Save as routine"; `addWorkouts` store action; `updateWorkout` now keeps `visitId`/`routineId` (edits used to drop the gym-visit link). Migration `…160000_routines` pushed, RLS verified |
| 2026-09-25 | PRs (D36): derived per exercise from the log (heaviest, Brzycki est. 1RM ≤ 10 reps, best set, reps, hold, assistance, cardio), trophy banner on every logging path, live chip in the logger, Personal records card, 🏆 on rows and week days. No migration |
| 2026-09-25 | Gym edit / switch / remove + place search (D37): Edit pill on the Gym card, Me → Your gym, switch retires the old gym (visits keep it), `currentGym()`, Geoapify search behind `/api/places/search` (provider interface, `place_cache`, generic `api_rate`). Migrations `…170000_gym_switch`, `…171000_place_search` **not pushed yet** |
| 2026-09-25 | Achievements (D38): `/achievements` + "Awards" nav tab; 57 badges (12 tiered families + 9 one-offs) derived from history; `runStreak` returns `bestDates`; unlock banner queued with PR banners; Personal records card moved off the Workout tab; `bronze`/`silver` tokens. No migration |
| 2026-09-25 | Weekly Wrapped (D42): `lib/wrapped.ts` + stories viewer + canvas share image; festival days (D43) and plan-ahead calorie bank (D44) decided; research for fasting (engagement.md) and barcode/photo logging (smart-logging.md) written up. No migration |
| 2026-09-27 | BMR (D45): one shared Mifflin–St Jeor in `lib/energy.ts`; Me "Your energy" card (live since-midnight count, stacked goal bar, receipt), goal refresh nudge (Me + Progress, ≥ 50 kcal, calculator goals only, Undo), resting burn on the Progress weight card, resting context in the workout logger. No migration |
| 2026-09-27 | Deployed on Vercel (prana-liart.vercel.app). Sign-in landed on localhost: the live URL wasn't in Supabase's redirect list, so `site_url` (localhost) was used. `config.toml` site_url + redirect URLs updated and pushed |
| 2026-09-27 | Akhada (D46, D47): opt-in profiles, friends + invite links, block/report, inbox, server-computed leaderboard (active days → effort → verified), challenges (lift / days / minutes / team) with verify, flag and dispute; Awards moved into the Akhada tab. Migrations `…100000_social`, `…101000_challenges` **not pushed yet** |
| 2026-09-27 | Akhada part 2 (D48, D49): weekly duels, lazy result settling (frozen places + notifications), Akhada badges in Awards, result share cards, Shabaash kudos + nudges with opt-out. Migration `…120000_duels_results_kudos` **not pushed yet** |
