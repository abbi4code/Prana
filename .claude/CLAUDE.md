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
- **Deployment (Vercel etc.) is the owner's job.** Don't set it up. Before they deploy they need: prod URL added to `additional_redirect_urls` + `site_url` in `supabase/config.toml` → `npm run auth:push`; env vars on the host: the two `NEXT_PUBLIC_SUPABASE_*` plus server-only `SUPABASE_SECRET_KEY` and `OPENAI_API_KEY`; migrations pushed before new client code ships; function region near the DB (Mumbai).
- "Focus on building features." Verify work in a real browser (see [architecture.md](architecture.md#verifying-changes)) before calling it done.
- Keep these `.claude/*.md` docs updated as you go (see Working rules).

## Current status (2026-09-25)

Working MVP+ on GitHub (`abbi4code/Prana`, public). Built:
- Today (calorie ring, macros, week strip, streak flame, chai counter, water, 4 meal cards), Progress (streak card, year heatmap, weight trend, 14-day calories), Me (goal calculator, goals, appearance, my foods, account), login + Google OAuth.
- Food search (Hinglish, Hindi, aliases) over **276 foods**; food detail with draggable brass katori; create-your-own food; thalis (saved meals); swipe-to-delete with undo; celebrations for protein/water goals; streaks with freezes.
- Supabase project **`fitness`** (ref `ibioqnkpbvxgsmhswgyd`, Mumbai) has Google sign-in live and confirmed working by the owner.

- **Natural-language + voice logging** for food **and workouts** ("2 roti aur dal for dinner", "bench 3x10 60kg aur 20 min walk", "kal raat…" → one confirm card → log), signed-in users, via `/api/food/parse` + OpenAI `gpt-6-luna`. See [nl-logging.md](nl-logging.md). Eval 84/84.
- **"Add anything"** (D29): one search bar on Today (+ sidebar, / or ⌘K) for food and workouts; + adds exactly what the row shows (last portion / last session) with Undo; sentences + voice in the same box.
- **Workouts** (D27, [workouts.md](workouts.md)): Workout tab, 211 exercises with photos (free-exercise-db), sets × reps × kg, 20 cardio/sport activities, calorie-burn estimate (Compendium + ACSM, minus resting), Today Eaten · Burned · Net · Goal (goal editable inline), workout + global "Prana" streaks with user-picked rest days.
- **Gym check-in** phases 1–3 (D30, [gym-checkin.md](gym-checkin.md)): gym sheet with current location + Leaflet/OSM map + radius; "I'm at the gym" / Done with a live timer; location consent + explainer, server-side distance verification (verified / not verified); offline + guest fallback. Phase 4 (nearby banner, auto-close) next.
- Supabase: 8 migrations pushed (latest `20260925140000_location_consent`).

**Next up**: workouts phase 2 (routines, rest timer, PRs), then the roadmap ([features.md](features.md) / [future.md](future.md)): home vs restaurant oil toggle, hidden-calorie chips (+ghee, +sugar), fried-food fix (Q4), weekly Wrapped, calorie bank, festival/fasting modes, barcode scan.

## Docs index

| File | What's in it |
|---|---|
| [architecture.md](architecture.md) | **How the code works**: data flow, store, sync, theming, food pipeline, checklists for common changes, gotchas, how to verify |
| [decisions.md](decisions.md) | All decisions D01–D28 with reasons (stack, data model, units, design, UX, streak rules, thalis…) |
| [features.md](features.md) | Feature list by phase with status |
| [future.md](future.md) | Open questions, backlog, parked ideas, change log |
| [data.md](data.md) | Food data: files, sources actually used, rules, review results, known gaps |
| [setup-auth.md](setup-auth.md) | Supabase + Google sign-in setup (done; keep for reference and redeploys) |
| [nl-logging.md](nl-logging.md) | Natural-language + voice logging (food + workouts): owner's spec, architecture, as-built files, eval, odd-input behaviour |
| [gym-checkin.md](gym-checkin.md) | Gym check-in (D30): owner's spec, mapping onto Prana, answers, as-built phases 1–3, phase 4 next |
| [workouts.md](workouts.md) | Workouts (built, phase 1): exercise library + photos, burn model and its sources, streak rules, data pipeline, phases 2–3 |

## Commands

```bash
npm run dev          # http://localhost:3000
npm run build        # production build (also type-checks)
npm run lint
npm run foods        # rebuild src/data/foods.generated.json after editing data/*.json
npm run exercises    # rebuild src/data/exercises*.generated.json after editing data/exercises*.json / burn-model.json
node scripts/import-exercise-db.mjs   # fetch free-exercise-db muscles + photos (WebP via cwebp) for new exercises
node scripts/import-extra.mjs /path/to/INDB.xlsx   # regenerate data/foods-extra.json (see data.md)
npm run db:push      # push supabase/migrations to the hosted project (reads .env)
npm run auth:push    # push supabase/config.toml auth settings (preview first: npx supabase config diff --project-ref <ref>)
npm run env:keys     # write NEXT_PUBLIC_SUPABASE_URL + publishable key into .env
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
