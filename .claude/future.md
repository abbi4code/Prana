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
| Capacitor wrapper | Only if App Store/Play Store presence or native features are needed |

## Parked (not now)

- Social feed / friends
- Recipe pages
- ~~Workout tracking~~: un-parked 2026-09-24, see D26 / workouts.md. Step import from Google Fit / Apple Health still parked

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
| 2026-09-24 | Workouts & calorie burn planned (D26, workouts.md): free-exercise-db library, sets × reps × kg, MET-based burn separate from food, food/workout/global streaks |
