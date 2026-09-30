# Prana (प्राण): project guide

**Start here.** This file is loaded into every session. Read the linked docs before changing the related area.

## What we're building

**Prana** ("life force"): a calorie and fitness tracker **for Indian food**, built for people who eat with discipline.
Tagline: *"Discipline, one katori at a time."*

- Log meals the way Indians actually measure them: **katori, roti, piece, plate, glass, scoop**, or grams.
- **One codebase, three form factors:** phone (installable PWA), tablet and desktop website. Each gets its own layout; phone is not the only target.
- **Local-first:** everything is saved on the device instantly and works offline. Google sign-in syncs it to Supabase across devices. Guest mode (no account) is allowed.
- **Trustworthy numbers:** every calorie value traces to a real source (INDB 2024, IFCT 2017, USDA, official pack labels). Numbers are never invented. See [data.md](data.md).
- **Look and feel:** "Modern Masala": warm charcoal dark theme (default) plus a "warm paper" light theme, spice accents, brass katori and steel thali illustrations, springy motion. The owner wants the UI and animations to be **top notch**, not generic.

## Who the owner is and how they like to work

- Solo owner, building this for personal use (and possibly others later). Writes casually (Indian English / Hinglish); reply plainly.
- Wants **research-backed** data and decisions. When facts matter (nutrition values, current dashboard steps), search the web / read official sources. Do not guess.
- **Git:** the owner commits and pushes. When a chunk of work is done, give a **short commit name only** (e.g. `feat: thalis and discipline streaks`). Do not commit, push or deploy unless asked.
- **Deployment (Vercel etc.) is the owner's job.** Don't set it up. Before they deploy they need: prod URL added to `additional_redirect_urls` + `site_url` in `supabase/config.toml` → `npm run auth:push`; env vars on the host: the two `NEXT_PUBLIC_SUPABASE_*` plus server-only `SUPABASE_SECRET_KEY` and `OPENAI_API_KEY` (+ `GEOAPIFY_API_KEY` for gym place search, `ADMIN_EMAILS` for the admin panel, `USDA_API_KEY` for food research; optional `RESEARCH_MODEL`, `RESEARCH_PER_DAY`, `LABEL_MODEL`); migrations pushed before new client code ships; function region near the DB (Mumbai).
- "Focus on building features." Verify work in a real browser (see [architecture.md](architecture.md#verifying-changes)) before calling it done.
- Keep these `.claude/*.md` docs updated as you go (see Working rules).

## Current status (2026-09-30)

Working MVP+ on GitHub (`abbi4code/Prana`, public). Built:
- Today (calorie ring, macros, week strip, streak flame, chai counter, water, 4 meal cards), Progress (streak card, year heatmap, weight trend, 14-day calories), Me (goal calculator, goals, appearance, my foods, account), login + Google OAuth.
- Food search (Hinglish, Hindi, aliases) over **329 foods** (276 original + research batches, see below); food detail with draggable brass katori; create-your-own food; thalis (saved meals); swipe-to-delete with undo; celebrations for protein/water goals; streaks with freezes.
- Supabase project **`fitness`** (ref `ibioqnkpbvxgsmhswgyd`, Mumbai) has Google sign-in live and confirmed working by the owner.

- **Natural-language + voice logging** for food **and workouts** ("2 roti aur dal for dinner", "bench 3x10 60kg aur 20 min walk", "kal raat…" → one confirm card → log), signed-in users, via `/api/food/parse` + OpenAI `gpt-6-luna`. See [nl-logging.md](nl-logging.md). Eval 84/84.
- **"Add anything"** (D29): one search bar on Today (+ sidebar, / or ⌘K) for food and workouts; + adds exactly what the row shows (last portion / last session) with Undo; sentences + voice in the same box.
- **Workouts** (D27, [workouts.md](workouts.md)): Workout tab, 211 exercises with photos (free-exercise-db), sets × reps × kg, 20 cardio/sport activities, calorie-burn estimate (Compendium + ACSM, minus resting), Today Eaten · Burned · Net · Goal (goal editable inline), workout + global "Prana" streaks with user-picked rest days.
- **Gym check-in** phases 1–3 (D30, [gym-checkin.md](gym-checkin.md)): gym sheet with current location + Leaflet/OSM map + radius; "I'm at the gym" / Done with a live timer; location consent + explainer, server-side distance verification (verified / not verified); offline + guest fallback; nearby banner, lazy auto-close (fix end), visits count as workout days. Gym **edit / switch / remove** + **place search** (D37: Geoapify behind `/api/places/search`, needs `GEOAPIFY_API_KEY`).
- **Greetings** (D31, [greetings.md](greetings.md)): a desi hype/funny line on top of Today, picked for the moment (streak, back after a break, at the gym, rest day…), no repeats for 80 picks, tap for another. All 7 batches in: 1,940 reviewed lines covering every time of day and moment.
- **Routines** (D34): saved exercise lists ("Chest day") as cards; numbers follow your last session with an ↑ overload hint; checklist or one-tap Log all; starters + custom.
- **PRs** (D36): auto-detected per exercise from the log (heaviest, est. 1-rep max, best set, reps, holds, cardio), trophy banner, Personal records card.
- **Achievements** (D38): 57 habit badges (bronze → diamond, derived from history) + the PR list; unlock banners. Now the Awards tab inside Akhada, with 16 Akhada badges (D49): 73 badges in total.
- **Weekly Wrapped** (D42, [engagement.md](engagement.md)): Monday–Sunday stories from Sunday 6 pm, share image drawn on the device. Festival days (D43) + plan-ahead calorie bank (D44) decided, not built.
- **BMR** (D45): "Your energy" in Me (live resting burn + how the goal is built), goal refresh nudge when weight moves it, resting burn on Progress.
- **Akhada** (D46, D47, [social.md](social.md)): opt-in profiles, friends + invite links, block/report, inbox, leaderboard (active days → effort → verified, server-computed), challenges (lift / days / minutes / team; ✓ verified, big-jump flag, disputes). Replaced the Awards tab (Leaderboard · Challenges · Awards). Part 2 (D48, D49): weekly duels, frozen results + notifications, Akhada badges, share cards, Shabaash kudos + nudges.
- **Admin panel** (D51, [admin.md](admin.md)): `/admin` for accounts in `ADMIN_EMAILS` (server-checked, Google only): overview, members + per-member page (charts, day by day, streaks, PRs, JSON export), food, training, Akhada moderation queue, AI + storage; service-role functions only, every member view logged in `admin_audit`.
- **Food research pipeline** ([data.md](data.md) "Adding foods at scale"): browser Claude researches batches with `data/research/PROMPT.txt`; replies saved as `data/research/batch-*.json`; `scripts/check-research.mjs` re-reads every number from INDB.xlsx / IFCT / USDA (local CSV downloads via `FDC_DIRS`) and writes `data/foods-research.json`. Done: batch 1 + 1b (street food: pani puri, chaats, bhel, tikki, momos, vada pav, rolls, chole bhature…), chicken biryani (INDB recipe + cooking yields). Next: food batches 2–12.
- **Fried foods** (D52): absorbed-oil model (dough + measured fat of the fried food, Jain et al. 2024) replaces INDB's whole-pan-of-oil rows; samosa, bhatura, kachori replaced in place. Other old fried rows still to rebuild.
- **Alcohol** (D53): `alcohol` category, kcal from ABV (7 kcal/g ethanol), ml units, "incl. N kcal from alcohol" in the food detail. 12 beers in (batch A1). Prompt `data/research/PROMPT-ALCOHOL.txt` (A1b big brands, then A2 whisky … A7 cocktails).
- Supabase: all migrations pushed up to `20260930120000_candidate_labels` (2026-09-30; `…100000` + `…110000` had been run outside `db push`, fixed with `migration repair`, see architecture.md gotchas). **Not pushed yet:** `20260930130000_food_request_news` (D54 phase 5), **`20260930140000_health`** (D55: `blood_pressure`, `habit_days`, `user_goals.health`; sync pulls both tables on every run, so push it before deploying or every signed-in sync fails).
- **Missing-food requests** (D54, [food-requests.md](food-requests.md)). Phase 1: "Request it" + Create at the end of a food search; failed searches, AI misses and custom foods recorded (signed in, name only); admin **Requests** tab (most wanted, Same as / Dismiss). Phase 2: **shared foods**: candidates checked in admin (Approve / Reject, server re-check `server/foods/schema.ts`), approved foods + "Same as" names downloaded by every device (`catalog_updates()`, `lib/sharedFoods.ts`) into search, no deploy; Retract / Restore. Phase 3: **Research** in admin (one food, or the top 5): OpenAI (`gpt-6-astra`, web search + tools over INDB / IFCT / USDA) names the source, the server reads the numbers with the shared checker rules (`src/lib/research/check.ts`, also used by the laptop script) and a candidate waits for approval; also "same as" suggestions, not found, not a food. Phase 4: **label images** beside the numbers for label foods: a vision model (`gpt-6-luna`) copies the panel, our code compares each value (✓ / ≠), "Use the label's numbers", paste a link or upload a photo, and Approve needs the owner's "checked against the label" tick. Phase 5: **"your food is in Prana now"** cards on Today for people who asked (or made their own): Log it, Use it instead of mine (thalis move at the same grams, Undo), dismiss. D54 complete.
- **Health tab** (D55, [habits.md](habits.md)): Progress became **Health** (`/health?tab=progress|body|habits`, `/progress` redirects). **Body**: BMI / waist with Asian-Indian cut-offs, blood-pressure log (home rules: 135/85, urgent 180/120), WHO 2019 10-year heart-attack / stroke risk (South Asia chart) with what-ifs, INTERHEART no-lab heart score (PURE South Asia), Indian Diabetes Risk Score, tape + photos. **Habits** (opt-in): tobacco counter (cigarettes, bidis, gutka / khaini, hookah, vape), per-disease risk vs a non-smoker with a what-if slider, quit milestones (sourced steps only), life + money, chewing / hookah / vape cards, alcohol from logged drinks vs the South Asia lowest-risk amount, smoking + drinking together. All numbers in `src/lib/health/*` with their sources.
- **Known issues** found 2026-09-30 (challenge ✓ can reuse an old verified visit, env coupling, a checker bug…): [future.md](future.md) "Known issues".

**Next up**: import the next research batches as the owner brings them (alcohol A1b → A7, food 2 → 12); rebuild the remaining INDB fried rows with D52; check INDB rice dishes (their per-100 g is on raw ingredient weight, see data.md); **missing-food requests + research agent** (D54, all 5 phases built; possible next: a daily automatic research run; OpenAI finds sources, server reads numbers, owner approves in admin, Supabase `shared_foods` table; build plan in [food-requests.md](food-requests.md)); then the roadmap ([features.md](features.md) / [future.md](future.md)): home vs restaurant oil toggle, hidden-calorie chips (+ghee, +sugar), festival days (D43) → calorie bank (D44) → fasting, barcode scan + thali photo (decisions pending, [smart-logging.md](smart-logging.md)).

## Docs index

| File | What's in it |
|---|---|
| [architecture.md](architecture.md) | **How the code works**: data flow, store, sync, theming, food pipeline, checklists for common changes, gotchas, how to verify |
| [decisions.md](decisions.md) | All decisions D01–D54 with reasons (stack, data model, units, design, UX, streak rules, thalis…) |
| [features.md](features.md) | Feature list by phase with status |
| [future.md](future.md) | Open questions, backlog, parked ideas, change log |
| [data.md](data.md) | Food data: files, sources actually used, rules, review results, known gaps; **research pipeline** (prompts, checker, batch results, USDA downloads) |
| [setup-auth.md](setup-auth.md) | Supabase + Google sign-in setup (done; keep for reference and redeploys) |
| [nl-logging.md](nl-logging.md) | Natural-language + voice logging (food + workouts): owner's spec, architecture, as-built files, eval, odd-input behaviour |
| [gym-checkin.md](gym-checkin.md) | Gym check-in (D30): owner's spec, mapping onto Prana, answers, as-built phases 1–4 |
| [greetings.md](greetings.md) | Today greeting (D31): why hardcoded + context-picked, picking rules, data pipeline, **the browser-Claude prompt** for new batches |
| [workouts.md](workouts.md) | Workouts (built, phase 1): exercise library + photos, burn model and its sources, streak rules, data pipeline, phases 2–3 |
| [engagement.md](engagement.md) | Weekly Wrapped, festival days, calorie bank, fasting: owner decisions, research (vrat foods with INDB/IFCT codes, calendars, IF safety copy), as-built |
| [smart-logging.md](smart-logging.md) | Barcode scan + thali photo: research (scanner libs, Open Food Facts, FSSAI labels, vision accuracy + cost) and the decisions still needed |
| [admin.md](admin.md) | Admin panel (D51): access model (ADMIN_EMAILS, service-role functions, audit log), every screen, files, setup, tests |
| [food-requests.md](food-requests.md) | Missing-food requests + research agent (D54, built, phases 1–5): demand capture, OpenAI finds sources, server reads the numbers, admin approval, `shared_foods` table, **build plan + phases** |
| [habits.md](habits.md) | Health tab Body + Habits (D55, built): smoking / tobacco / alcohol impact (owner's ask 2026-09-30; research H1–H5 verified): per-disease risk by dose, quitting, alcohol, WHO South Asia CVD chart (`data/research/who-cvd-south-asia-nonlab.json`), INTERHEART non-lab score, IDRS, open decisions |
| [social.md](social.md) | Leaderboard + challenges: owner's ask, research (Apple/Strava/Duolingo, motivation, anti-cheat, DPDP), proposed design, decisions |

## Commands

```bash
npm run dev          # http://localhost:3000
npm run build        # production build (also type-checks)
npm run lint
npm run foods        # rebuild src/data/foods.generated.json after editing data/*.json
npm run exercises    # rebuild src/data/exercises*.generated.json after editing data/exercises*.json / burn-model.json
npm run greetings    # validate data/greetings/*.json + rebuild src/data/greetings.generated.json
node scripts/import-exercise-db.mjs   # fetch free-exercise-db muscles + photos (WebP via cwebp) for new exercises
node scripts/import-extra.mjs /path/to/INDB.xlsx   # regenerate data/foods-extra.json (see data.md)
npm run db:push      # push supabase/migrations to the hosted project (reads .env)
npm run auth:push    # push supabase/config.toml auth settings (preview first: npx supabase config diff --project-ref <ref>)
npm run env:keys     # write NEXT_PUBLIC_SUPABASE_URL + publishable key into .env
FDC_DIRS="<fndds csv dir>:<sr legacy csv dir>" node --env-file-if-exists=.env scripts/check-research.mjs /path/INDB.xlsx [--write]   # verify data/research/batch-*.json; INDB.xlsx + USDA CSV downloads aren't in the repo (links in data.md)
npm run eval:parse   # NL parsing eval (calls OpenAI, ~$0.01): run after ANY prompt/model/alias change
npx next typegen     # regenerate route types (needed for LayoutProps/RouteContext, and after deleting a route)
```
There is no test runner; see [architecture.md](architecture.md#verifying-changes).

## Working rules

- **Secrets never get the `NEXT_PUBLIC_` prefix** (Next.js ships those to browsers). Server-only code lives in `src/server/` and imports `server-only`.
- **The LLM never produces nutrition numbers** (nl-logging.md hard rules).
- **Never invent calorie/nutrient numbers.** Every value traces to a source listed in [data.md](data.md). Calorie apps and aggregator sites (HealthifyMe, FatSecret…) are not allowed as sources. Missing data → custom food, or read the manufacturer's label.
- **This is Next.js 16** (see root `AGENTS.md`): APIs differ from older versions. Read `node_modules/next/dist/docs/` before using an unfamiliar API.
- Every data mutation goes through the store and records itself in the **sync queue**; see the checklist in [architecture.md](architecture.md) before adding a synced entity.
- Colours only through theme tokens (both themes must work). Every screen must work on phone **and** desktop.
- One md file per topic in `.claude/`. New topic → new file + add it to the index above.
- Decision made or changed → update [decisions.md](decisions.md) the same session (add a row; mark old ones superseded, don't rewrite history). Feature done → [features.md](features.md). Notable change → change log in [future.md](future.md).
- Items marked **Proposed** await the owner's confirmation.
