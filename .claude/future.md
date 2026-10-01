# Future Changes & Open Questions

## Open questions (need the owner's call)

| # | Question | Notes |
|---|---|---|
| ~~Q1~~ | ~~App name?~~ | **Resolved 2026-09-24: "Prana"** (D19) |
| Q2 | Sign off "Modern Masala" visual identity (D08)? | Owner likes it but wants it pushed further ("good, not best yet"); keep polishing |
| ~~Q3~~ | ~~Meal slots~~ | In daily use, no objections (D10) |
| ~~Q4~~ | ~~How to handle fried foods (samosa, puri, pakora, jalebi, namkeen)?~~ | INDB counts the *full* frying oil, not the absorbed amount. For now the app shows them with "~" and a "high estimate" note (D16). Options for a real fix: (a) use INDB value with a documented absorbed-oil adjustment, flagged `low`; (b) find a published absorbed-oil study; (c) manufacturer label for packaged namkeen. | **Resolved 2026-09-28: D52 (absorbed-oil model).**
| Q5 | Food images: AI-generated illustrations vs photos? | D11 proposes illustrations |
| ~~Q6~~ | ~~Chai value~~ | **Resolved:** derived chai (80 g milk + 8 g sugar per 150 ml cup = 89 kcal) + no-sugar variant (D22) |
| ~~Q7~~ | ~~Missing basics~~ | **Resolved:** USDA values for dahi/sugar/honey/butter/bread/cheese/cola (D22); packaged items (toned milk, Parle-G…) via custom foods (D21) |
| ~~Q8~~ | ~~Missing-food requests (D54): record failed searches automatically, or only on "Request it"?~~ | **Resolved 2026-09-30: both**, signed-in users only, food name text only ([food-requests.md](food-requests.md) "Capturing demand") |
| ~~Q9~~ | ~~Which model runs the research agent?~~ | **Resolved 2026-09-30: OpenAI.** Tested both with web search: `gpt-6-luna` (13.7 s) paired a correct USDA id with another food's name; `gpt-6-astra` (27.8 s) got both right → `RESEARCH_MODEL` default `gpt-6-astra`; AI logging keeps luna |
| ~~Q10~~ | ~~Where does the scheduled job run?~~ | **Resolved 2026-09-30 (follows Q11 = B):** a "Run research" button in the admin panel first; a daily Vercel Cron call later. No GitHub Actions |
| ~~Q11~~ | ~~How do new foods reach users?~~ | **Resolved 2026-09-30: B**, a Supabase table of approved foods; the owner approves each one in the admin panel; the app downloads them and merges them into search; no deploy. Partly supersedes D13 (the built-in catalog stays; approved foods come on top) |
| ~~Q12~~ | ~~May the agent transcribe official label images / chain nutrition PDFs (`MFR_LABEL`)?~~ | **Resolved 2026-09-30: yes**, transcription only, shown beside the image, the owner checks each one before Approve |

## Planned future changes

| Change | Why / notes |
|---|---|
| **Home vs restaurant toggle** | Restaurant/dhaba food ≈ 1.5–2× the oil; biggest source of hidden calories |
| **Hidden-calorie chips** | "+ ghee on roti", "+ tadka", "+ sugar in chai" on the food detail |
| **Syrup-soaked fried sweets** (jalebi, imarti, balushahi, gulab jamun) | The D52 model covers dough + absorbed oil only; the research agent answers "not found" for jalebi. Needs a syrup-uptake step (measured sugar uptake or a label) before these can be researched |
| **Rebuild existing fried rows with D52** | done: bhatura, samosa (potato), kachori (khasta). Left: veg samosa, matar kachori, aloo + onion pakora, poori, medu vada, dahi vada, gulab jamun, besan kadhi pakodi, fried fish: send them through `recipe.frying` and drop the INDB rows (old logs keep their snapshots) |
| NL logging follow-ups | Real-phone voice test (Android + iPhone); prune `parse_cache` / `parse_usage` (pg_cron); grow `evals/nl-parse.jsonl` from real corrections; maybe server STT later (nl-logging.md) |
| Thali photo logging | Photo → items + katori counts (Claude vision) |
| Calorie bank (D44), festival/shaadi days (D43), fasting mode | Engagement features from the roadmap (features.md v2); Weekly Wrapped is built (D42) |
| **Missing-food requests + research agent** (D54, decided) | Demand from failed searches / AI logging / custom foods → alias triage → AI call finds source refs → server reads the numbers from INDB/IFCT/USDA + checks → owner approves in admin → live from a Supabase table → notify. [food-requests.md](food-requests.md) "Build plan"; all decisions made (Q8–Q12), not built |
| Barcode scan | Packaged foods |
| Realtime sync | Today sync runs on edit/focus/reconnect; Supabase Realtime could push to other open devices |
| Per-dish illustrations (D11) | Category art exists; per-dish art would be the next visual step |
| Import more of INDB (1,014 recipes) / IFCT (542) | `scripts/import-extra.mjs` already reads INDB by code; extend with care (serving sizes, macro check) |
| More packaged brands from official labels | Same method as Yogabar (data.md) |
| Deployment | **Owner does it.** Before deploying: prod URL → `supabase/config.toml` redirect URLs + site_url → `npm run auth:push`; env vars on host |
| Gym place search follow-ups (D37) | Smoke-test with the real Geoapify key; prune `place_cache` / `api_rate` (pg_cron, with the parse tables); compare Ola Maps on ~20 real gym names once its storage terms are confirmed in writing; maybe reverse-geocode a hand-placed pin for an area label |
| **Per-record IndexedDB for user data** (D50) | Replace the single `ct-v1` localStorage blob: one IndexedDB record per entry/workout/…, write only what changed, quota becomes a share of the disk; one-time move of existing data; maybe `idb-keyval` (ask first). Needed before users reach ~2 years of logs |
| Health tab follow-ups (D55) | Admin member page: show BP readings + habit days (synced, owner allowed); ask the 2025 obesity symptoms so stage 2 can be shown; BP: allow morning + evening readings (guidelines average both); a gentle reminder to measure BP weekly |
| Capacitor wrapper | Only if App Store/Play Store presence or native features are needed |

## Known issues (found 2026-09-30, not fixed yet)

| Issue | Where | Notes |
|---|---|---|
| ~~Migration `20260925180000_measurements` probably not pushed~~ | CLAUDE.md status | **Resolved 2026-09-30:** the owner pushed every pending migration |
| Challenge lift ✓ can reuse an old verified visit | `challenge_best_lift` (`…101000_challenges.sql`) | A set counts as verified if its `visitId` (client-synced JSON) is any of the user's verified visits; the visit's date isn't compared with the workout's date. Fix: require `v.started_at::date` (IST) = the workout date, or the set's `createdAt` inside the visit window |
| One missing server env var breaks unrelated routes | `src/server/env.ts` | `serverEnv()` validates everything at once: no `OPENAI_API_KEY` → gym, places and admin routes 500 too. Split per feature or make the key optional until parse is called |
| ~~Checker: a `REPLACES` target missing from the catalog is still accepted~~ | `scripts/check-research.mjs` | **Fixed 2026-09-30** (status decided after the replacement check) |
| Manifest locks portrait | `src/app/manifest.ts` | Installed on a tablet, the landscape layouts can't be used |
| Stale code comments | `store.ts` (says `lib/sync.ts`), `burn.ts` `liftBurn` (says weight lifted isn't in the model; lifting v2 is) | Cosmetic. (The checker's DEMO_KEY comment was right: 30 an hour, 50 a day per IP; fixed the docs instead) |
| `admin/userModel.ts` copies `DEFAULT_GOALS` | `src/lib/admin/userModel.ts` | Can drift from `lib/nutrition.ts` |

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
| 2026-09-27 | Local saving (D50): checked the localStorage limits (measured: ~5.24 M characters; typical user ~1.4 M a year; one save 2–51 ms), batched writes, failed saves caught + shown, storage.persist(), iPhone guest hint. IndexedDB move planned |
| 2026-09-27 | Admin panel (D51, admin.md): `/admin` + member pages, service-role `admin_*` functions, `admin_audit` access log, report resolving, CSV/JSON export; `ADMIN_EMAILS` server env; `useTokens` gained jamun + brass. Migration `…130000_admin` **not pushed yet**. SQL tested on PGlite, UI in Chrome (phone + desktop, both themes) |
| 2026-09-28 | Food research prompt for browser Claude (data.md "Adding foods at scale"): 12 themed batches, sources INDB → IFCT → USDA (incl. FNDDS) → official labels/chains → DERIVED recipes, exact refs so every number is re-read before import; returns go in `data/research/batch-N.json` |
| 2026-09-28 | Food research round 1: `scripts/check-research.mjs` (re-reads INDB / IFCT / USDA, recomputes DERIVED, D52 fried model, USDA `search:` refs), `data/foods-research.json` in the build, batch 1 → 7 foods + 12 alias sets, chole renamed; D52 fried-food model (Q4 resolved). Eval 84/84. Catalog 283 foods |
| 2026-09-28 | Food research batch 1b: 34 street foods (pani puri, chaats, bhel, tikki, rolls, chole bhature…) through the D52 fried model; bhatura / samosa / kachori replaced in place (577 → 321 kcal/100 g for samosa); USDA cache; FOOD refs for combos. Catalog 307. Eval 84/84 |
| 2026-09-28 | Chicken biryani added (INDB ASC122 recipe with IFCT chicken thigh, cooked weight from USDA water contents; 185 kcal/100 g). Checker refuses self-contradicting IFCT rows (N001). Found: INDB per-100 g is on raw ingredient weight. Catalog 308. Eval 84/84 |
| 2026-09-28 | Batch 1b finished (pav, momos, vada pav, dabeli, misal pav, bread pakora): 44 research foods, catalog 317; checker reads USDA from local CSV downloads (`FDC_DIRS`), keeps a food's own aliases on re-runs; veg momos rebuilt from a recipe (USDA's 'no meat' dumpling is plain dough). Alcohol research prompt written (import needs an alcohol category + alcohol_g). Eval 84/84 |
| 2026-09-29 | Alcohol (D53): `alcohol` category, `alc` field, ml + 'incl. N kcal from alcohol' in the food detail, beer-mug art, checker computes kcal from ABV (7 kcal/g); batch A1: 12 beers (Bira, Godfather, generics). Catalog 329. Eval 84/84 |
| 2026-09-30 | Docs synced with the code (architecture: 11 API routes, Akhada routes, store fields, eval 84; badges 57 + 16 = 73; Akhada screens; data.md missing list + source-file location); known issues listed above; missing-food requests + research agent proposed (D54, food-requests.md). No code change |
| 2026-09-30 | D54 phase 1: missing-food requests. Migration `…100000_food_requests` (**not pushed yet**): `food_requests`, `food_request_users`, `food_request_add` (signed in, rate limited), admin functions + audit action. App: Request it + Create at the end of a search (add sheet, Add anything), `looksLikeFoodName` for dish names with spaces, signals search (looked at 1.5 s, then given up) / AI / custom, offline queue. Admin Requests tab (Same as ≥ 85 %, Dismiss, Reopen). Found: Postgres `[[:punct:]]` splits Devanagari conjuncts; signed-in users never saw Create for multi-word searches. SQL on PGlite, UI in Chrome (phone + desktop, both themes) |
| 2026-09-30 | D54 phase 2: shared foods. Migration `…110000_shared_foods` (**not pushed yet**): `food_candidates`, `shared_foods`, `catalog_updates()` (anon + authenticated), `admin_food_review`, `admin_food_candidate_decide` (approve → shared + request found), `admin_shared_food_set` (retract / restore), audit actions. Device: `lib/sharedFoods.ts` (start + focus, 15 min, saved copy `prana-shared-foods`, shape check) → `setSharedFoods` in `lib/foods.ts` (search, matcher, getFood; catalog wins an id clash); "Same as" names now live. Server gate `server/foods/schema.ts` (Zod Food + macro ±15 % + 1,200 kcal unit + not a catalog id). Admin: Waiting for your check (cards, problems block Approve, Reject with reason) + Added for everyone (Retract / Restore). SQL on PGlite, gate unit-tested, UI in Chrome (phone + desktop, both themes) |
| 2026-09-30 | D54 phase 3: food research agent. Checker rules moved to `src/lib/research/check.ts` (+ `shape.ts`, `csv.ts`), shared by `scripts/check-research.mjs`, `scripts/build-foods.mjs` and the server; regression: identical report + `foods-research.json` + `foods.generated.json`; the REPLACES bug fixed. Server: `src/server/foods/{sources,verify,research}.ts` (INDB.xlsx from GitHub at run time, IFCT CSV, USDA API with `USDA_API_KEY`), `POST /api/admin/research` (one food per call, 300 s, `RESEARCH_PER_DAY`), `src/data/food-refs.generated.json`. Admin: Research / Research top N / Research again (stuck), AI "same as" suggestions, reject reopens the request. Real runs: dal makhani (INDB OSR139), fulka (alias), asdfgh (not a food), kulfi (INDB ASC321, reads low: raw-weight warning added), Amul Kool Kesar (official Rajkot Union table), jalebi (not found: syrup). No migration |
| 2026-09-30 | D54 phase 4: label images beside the numbers. `src/server/foods/label.ts` (vision copy with `LABEL_MODEL` = gpt-6-luna after a test on known Yogabar labels: 20/20 + a blurred misaligned label; astra slipped once), per-serve / kJ maths and the comparison in our code; research reads label images; review route: Read (link or uploaded photo), Use the label's numbers, Approve refuses a differing label and needs the owner's tick. Card: zoomable image + ✓ / ≠ table. Migration `…120000_candidate_labels` (**not pushed yet**). The old session's INDB / USDA download folder is gone (tmp wiped): data.md says how to get them again. Also: one test request to Open Food Facts carried the owner's email in its User-Agent by mistake; retries used a generic one |
| 2026-09-30 | D54 phase 5 (D54 complete): "your food is in Prana now". Migration `…130000_food_request_news` (**not pushed yet**): `food_request_news()`, `food_request_seen()`. Today cards (Log it opens the food, Use it instead of mine swaps thalis to the checked food at the same grams with Undo, dismiss); only people who asked or made their own are told. Store fix: `addCustomFood` also clears a pending delete. Earlier the same day: `…100000` + `…110000` had been run outside `db push`; history fixed with `migration repair`, `…120000` pushed |
| 2026-09-30 | Health tab (D55): Progress → Health (Progress · Body · Habits), `/progress` redirects, nav icon HeartPulse, `sw.js` v4 precaches `/health` + `/akhada`. Body: BP log, WHO South Asia 10-year risk (+ what-ifs), INTERHEART non-lab score, IDRS, Asian BMI / Indian waist. Habits (opt-in): tobacco counter, per-disease risk with a slider, quit milestones, life + money, chewing / hookah / vape, alcohol from drinks, smoking × drinking. Research H1–H5 + BP thresholds verified against the papers (habits.md). Migration `…140000_health` (**not pushed yet**). Checked: tsc, lint, build, Node checks of every curve / score, Chrome phone + desktop, dark + light (no errors, no sideways scroll) |
| 2026-10-01 | Habits: "Edit days" on the tobacco counter (last 14 days + older date; steppers edit the picked day). Average now starts at the earliest filled-in day. Checked in Chrome, phone + desktop |
