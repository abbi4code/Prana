# Global Decisions

Status: **Decided** = agreed, build on it. **Proposed** = suggested, waiting for confirmation.
When something changes, mark the old entry **Superseded by Dxx** instead of deleting it.

## Summary

| ID | Decision | Status | Date |
|---|---|---|---|
| D01 | Next.js + Supabase stack | Decided (as built: see note in D01) | 2026-09-24 |
| D02 | Phone app = PWA, no native app | Decided (SW detail superseded by D15) | 2026-09-24 |
| D03 | Food data from INDB + IFCT 2017 (+ labels); no calorie apps | Decided (extended by D22) | 2026-09-24 |
| D04 | Nutrients per 100 g; unit weights per food | Decided (foods table superseded by D13) | 2026-09-24 |
| D05 | Log entries snapshot grams + kcal | Decided | 2026-09-24 |
| D06 | Standard household unit sizes | Decided | 2026-09-24 |
| D07 | Canonical unit names (normalize dataset) | Decided (built) | 2026-09-24 |
| D08 | Visual identity "Modern Masala" | Built (dark + light, D20); owner asked for more polish | 2026-09-24 |
| D09 | UX rules (≤3 taps to log, etc.) | Decided | 2026-09-24 |
| D10 | Meal slots incl. "Chai & Snacks" | Built (in daily use) | 2026-09-24 |
| D11 | One consistent illustration style for food images | Partly built: category art (D23); per-dish art open | 2026-09-24 |
| D12 | Project docs live in `.claude/`, one file per topic | Decided | 2026-09-24 |
| D13 | Food catalog ships inside the app as static JSON | Decided | 2026-09-24 |
| D14 | Local-first: data lives on the device, Supabase syncs it | Decided | 2026-09-24 |
| D15 | Hand-written service worker instead of Serwist | Decided | 2026-09-24 |
| D16 | Unreliable food rows excluded at build time; fried rows badged | Decided | 2026-09-24 |
| D17 | Responsive: phone, tablet and desktop layouts from one codebase | Decided | 2026-09-24 |
| D18 | Google sign-in (Supabase, PKCE) + offline-first sync; guest mode kept | Decided | 2026-09-24 |
| D19 | App name: **Prana** (प्राण) | Decided | 2026-09-24 |
| D20 | Light theme + per-device Appearance setting | Decided | 2026-09-24 |
| D21 | User-created ("custom") foods, synced | Decided | 2026-09-24 |
| D22 | Extra food sources: INDB import, USDA fallback, derived recipes | Decided | 2026-09-24 |
| D23 | Interaction patterns: swipe-delete + undo, drag katori, celebrate habits only | Decided | 2026-09-24 |
| D24 | Streak rules: on target = logged + 80–105% of goal; freezes | Decided | 2026-09-24 |
| D25 | Saved meals ("thalis"), logged in one tap | Decided | 2026-09-24 |
| D26 | Natural-language + voice logging (food + workouts): server parses, device matches | Decided (built) | 2026-09-25 |
| D27 | Workouts: exercise library, sets × reps × kg, estimated burn kept separate from food, food/workout/global streaks | Decided (built) | 2026-09-24 |
| D28 | Desktop log sheets are centred modals (workout: two-pane); supersedes the side panel in D17 | Decided (built) | 2026-09-25 |
| D29 | "Add anything": one search bar on Today for food + workouts; + adds exactly what the row shows | Decided (built) | 2026-09-25 |
| D30 | Gym check-in: manual (web can't geofence), server-written visits + append-only events, online by default with offline/guest fallback, server-side location verification | Decided (built, phases 1–4) | 2026-09-25 |
| D31 | Today greeting: hardcoded desi lines picked for the moment, not a live LLM | Decided (built, batch 1) | 2026-09-25 |

---

## D01 — Stack
| Layer | Choice |
|---|---|
| Framework | Next.js (App Router) + TypeScript |
| DB / Auth / Storage | Supabase (Postgres, Google login, Storage for food images, Row Level Security) |
| Styling | Tailwind CSS |
| Components | shadcn/ui, heavily restyled (we own the code) |
| Animation | Motion (Framer Motion) |
| Charts | Recharts |
| Hosting | Vercel |

**Why:** one codebase for web + phone; Supabase gives auth, DB and file storage in one place.

**As built (2026-09-24):** no shadcn/ui: custom components on Tailwind v4 tokens, plus `vaul` (sheets), `zustand` (state), `lucide-react`. Supabase Storage is not used yet (food art is inline SVG). Hosting is the owner's call. Details: [architecture.md](architecture.md).

## D02 — Phone app is a PWA
Installable via "Add to Home Screen", full-screen, offline shell. Use **Serwist** for the service worker.
**Why:** no second codebase. If App Store features are ever needed, wrap with Capacitor (see future.md).

## D03 — Food data sources
- Cooked dishes: **INDB** (Indian Nutrient Databank, Anuvaad 2024).
- Raw ingredients, fruits, dairy, nuts: **IFCT 2017** (ICMR-NIN).
- Packaged foods: manufacturer label only.
- Not allowed as nutrient sources: calorie apps, recipe blogs, AI-generated sites.
- Unknown values are `null`, never `0`. Each food carries `source` + `confidence`.

Details and review results: [data.md](data.md).

## D04 — Data model
Nutrients are stored **per 100 g**. Household units are stored **per food in grams**, because a katori of rice ≠ a katori of dal by weight.

```
foods       (id, name, name_hi, aliases[], category, diet, form,
             kcal_per_100g, protein_g, carbs_g, fat_g, fiber_g,
             image_url, source_id, source_ref, confidence)
food_units  (food_id, unit, label, grams, basis)
food_logs   (id, user_id, food_id, meal, logged_on, unit, qty,
             grams, kcal, protein_g, carbs_g, fat_g)      -- snapshot values
user_goals  (user_id, daily_kcal, protein_g, carbs_g, fat_g)
weights     (user_id, measured_on, kg)
```
All user tables are protected by RLS (`user_id = auth.uid()`).

## D05 — Snapshot on log
Each `food_logs` row stores the computed grams, kcal and macros at the time of logging.
**Why:** correcting a food's values later must not change past days.

## D06 — Standard unit sizes
| Unit | Size |
|---|---|
| katori | 150 ml small bowl |
| bowl | 250 ml large bowl |
| glass | 250 ml |
| cup | 150 ml (chai/coffee cup) |
| tbsp | 15 ml |
| tsp | 5 ml |
| handful | ~30 g |

Gram weight of a katori/bowl is still per food (density differs).

## D07 — Canonical unit kinds
Implemented in `scripts/build-foods.mjs`. Each unit keeps its original id + friendly `label`, and gets a canonical `kind`:

`g, katori, bowl, plate, piece, glass, cup, tbsp, tsp, handful, pack`

Example: unit `chapati` → kind `piece`, label "1 chapati". Every food also gets a `g` unit. INDB recipe-yield units (`soup_bowl`, `curry_bowl`, `tall_glass`, `tea_cup`) are dropped when the food already has a corrected standard unit.

## D08 — Visual identity: "Modern Masala" (Proposed)
- Dark mode first: deep charcoal-brown background (not pure black).
- Spice accents with fixed meanings: turmeric yellow = carbs, chilli red = protein, ghee gold = fat, curry-leaf green = on target.
- Brass/steel textures for thali and katori.
- Bold serif display font for big numbers, clean sans for body.

Will be confirmed with a clickable mockup before coding.

## D09 — UX rules
- Logging a food takes **≤ 3 taps** for foods eaten before.
- Bottom tab bar (Today · Progress · Me) + big floating **+** in thumb reach.
- Bottom sheets, not modal pop-ups.
- The UI updates immediately on log (optimistic updates); logging works offline and syncs later.
- Skeleton loaders, not spinners.
- Search matches Hinglish/aliases ("dahi" → curd, "arhar" → toor dal).

## D10 — Meal slots
Breakfast · Lunch · **Chai & Snacks** · Dinner.
**Why:** evening chai + snack is a real meal in Indian routines and a big source of unlogged calories.

## D11 — Food images (partly superseded by D23 category art)
One consistent illustration style for every food (generated from each food's `image_prompt`), stored in Supabase Storage.
**Why:** stock photos of Indian dishes are patchy and don't match each other.

## D13 — Food catalog ships with the app
`data/foods.json` (research output) → `npm run foods` → `src/data/foods.generated.json` (~100 KB, ~20 KB gzipped), imported by the app.
**Why:** instant search with no network round-trip, works fully offline, no DB seeding step. Supersedes the `foods` table in D04; `food_logs.food_id` stores the catalog id. User-created foods will get a DB table later.

## D14 — Local-first data
All logs, goals, weights and water are stored on the device (zustand + localStorage, key `ct-v1`), so logging works offline and is instant. Supabase (schema in `supabase/migrations/20260924000000_init.sql` + later migrations) syncs it across devices after Google sign-in (D18): rows have `updated_at` / `deleted_at` for last-write-wins sync.

## D15 — Service worker
`public/sw.js`, hand-written: network-first for pages with cached fallback, cache-first for hashed build assets. Registered only in production.
**Why:** Serwist needs webpack; Next 16 builds with Turbopack. The worker is ~50 lines.

## D16 — Data quality gates at build time
`scripts/build-foods.mjs` excludes rows flagged in the data review (`plain-dosa`, `paneer-tikka`, `onion-uttapam`) and marks deep-fried rows ≥ 400 kcal/100g as `fried`. The app shows those with a "~" and a "high estimate" note. Raw grains/dals/flours are tagged "Uncooked" and ranked lower in search.

## D17 — Responsive layouts
The owner uses both phone and desktop, so every screen has a layout per size (Tailwind breakpoints):

| Width | Navigation | Today | Log food |
|---|---|---|---|
| Phone (< 768) | Floating bottom tab bar + round **+** | One column | Bottom sheet |
| Tablet (`md`, 768+) | Bottom bar | One column, meals in a 2-column grid | Bottom sheet |
| Desktop (`lg`, 1024+) | Left sidebar with "Log food" button | Sticky summary column (ring, macros, chai/water) + meals column | ~~Side panel from the right~~ centred modal (D28), search autofocused |
| Wide (`xl`, 1280+) | Sidebar | Meals in a 2×2 grid | Side panel |

Progress and Me become two-column on desktop. Desktop extras: hover states, pointer cursors, keyboard shortcut **N** to log food (**/** now opens "Add anything", D29). `useIsDesktop()` (`src/lib/useMediaQuery.ts`) switches bottom sheet ↔ desktop modal (D28).

## D18 — Auth and sync
- **Sign-in:** Google only, via Supabase Auth, PKCE flow, entirely in the browser (`src/lib/supabase.ts`). Google returns to `/auth/callback`; the client exchanges the code. No server code or cookies needed, so the app stays static.
- **Login screen** on first visit, with **"Use without an account"** (guest mode, data on device only). Without Supabase keys in `.env.local` the app runs local-only with no login screen.
- **Sync** (`src/lib/sync/engine.ts`): every change is recorded in a queue in the store (`sync.dirty*`, `sync.deleted*`). A sync pushes the queue (upserts; deletes are soft, `deleted_at`), then pulls rows with `updated_at` newer than the last pull. Runs ~1.5 s after an edit, on app focus, on reconnect, and on sign-in.
- **Conflicts:** last write wins. An item with unpushed local changes is never overwritten by a pull.
- **Signing in with guest data:** it's pushed into the account. Goals are only pushed if they were edited as a guest, so a new device doesn't overwrite the account's goals with defaults.
- **Sign-out:** pushes pending changes, then clears this device. Data stays in the account.
- Merge rules are pure functions in `src/lib/sync/rows.ts` (tested with Node's built-in TS support).

## D19 — Name: Prana
Sanskrit प्राण, "life force / breath". Chosen by the owner for people who eat with discipline. Tagline: *"Discipline, one katori at a time."*
Name, Hindi name and tagline live in `src/lib/app.ts`. The Google consent screen still shows the name set in Google Cloud (Google Auth Platform → Branding) and can be renamed there.

## D20 — Light theme
Dark stays the default look; light is "warm paper" (`#f7f0e5`) with deeper spice colours for contrast. Follows the system unless the user picks System / Light / Dark in **Me → Appearance** (stored per device in `localStorage["prana-theme"]`, applied before first paint by an inline script in `app/layout.tsx`).
Rules: all colours are CSS tokens (`globals.css`); `--ink` is the RGB used for hairlines; `cream` inverts (light pill on dark, dark pill on light); gradient buttons use `text-on-accent`. SVG attributes and Recharts props can't read CSS variables, so they use `style={{…}}`, CSS overrides, or `useTokens()`.

## D21 — Custom foods
"Create “x”" in search (or "Can't find a food?") opens a form copied from a packet label: values per serving or per 100 g, stored per 100 g in the catalog shape with `conf: "user"`, `src: "USER"`. Kept in the store (`customFoods`), searchable (ranked first), synced to `custom_foods` (whole food as jsonb, RLS). Deleting one keeps past logs (they snapshot nutrition, D05). Listed in **Me → My foods**.

## D22 — More food data
`data/foods-extra.json`, built by `scripts/import-extra.mjs` from the INDB spreadsheet (by food code), USDA FoodData Central values (fdcId recorded) for basics IFCT/INDB lack (dahi, sugar, honey, butter, bread, cheese, cola), and **DERIVED** recipes computed from sourced ingredients (chai = IFCT milk + USDA sugar). Supplements (whey powder, creatine, whey shakes with water/milk) live in a `supplement` category with a shaker illustration; scoops use unit kind `scoop` (steps of 1), shakes render as a glass. USDA and derived rows are `medium` confidence. The import refuses INDB codes already in `data/foods.json`. Calorie apps / aggregator sites are still never a source (D03): e.g. Amul toned milk is left to custom foods.

## D23 — Interaction patterns
- Swipe a logged item left to delete; every delete shows an **Undo** toast (restores the same entry id, so sync stays clean).
- Drag the portion art up/down to change the amount (22 px per step, light haptic tick). Steppers and chips remain for precision/accessibility.
- Celebrate **habits**, not eating: particle burst + toast when protein goal or 8 glasses of water is reached, never for hitting the calorie number.
- Big numbers roll like an odometer (`RollingNumber`); the icon glides from the result list into the detail (`layoutId`); new items glow once on Today; pages rise-and-fade (`app/template.tsx`).
- Category illustrations (brass katori, kulhad, roti stack…) replace icon tiles until per-dish art exists (D11).

## D24 — Streaks
One definition, `dayStatus()` in `src/lib/streaks.ts`, used everywhere (streak, heatmap, "days on target"):
**on target = logged and 80–105% of the calorie goal**. Under 80% doesn't count: starving isn't discipline.
- Streak = consecutive on-target days. Today counts once it's on target and never breaks it while in progress.
- Every 7 on-target days earns a **freeze** (max 2). An off day (not logged / under / over) spends one instead of resetting.
- History is judged against the *current* goal (goal changes aren't stored per day).
- Shown as a flame badge on Today (links to Progress), a streak card, and a 53-week heatmap (tap a day for kcal + status).
- Rules are pure and covered by a Node test (scratch; see `computeStreaks`).

## D25 — Thalis (saved meals)
A saved meal = name + usual meal slot + items `{ foodId, unitId, qty }`. Nutrition is computed when logged (entries snapshot, D05), so editing a food or thali never rewrites history.
- Create: **bookmark icon on a meal card** (prefilled with that meal's items) or **New thali** in the add sheet. The builder shows the food drawn on an illustrated steel thali, with live totals.
- Log: tap a card under **My thalis** in the add sheet (goes to the selected meal), or tap the **⚡ chip on an empty meal card** (thalis saved for that slot). Logging from Today shows an Undo toast.
- Synced via `saved_meals` (jsonb, RLS), migration `20260924130000_saved_meals`.

## D27 — Workouts and calorie burn
(First written as a second "D26" the same day; renumbered because NL logging took D26. Migration `20260925120000_workouts` still says D26 in its comment.)
Workout tracking is no longer parked (future.md). Full plan and as-built notes: [workouts.md](workouts.md).
- Exercise library curated from **free-exercise-db** (public domain): 200 exercises with start/end photos, self-hosted as 480 px WebP, cached offline; + 11 without photos; + 20 cardio/sport activities.
- Log sets × reps × kg per exercise (seconds for holds); cardio by minutes + speed/incline or effort.
- Burn = Compendium 2024 MET × body weight × time (ACSM equations for walking/running), **minus the person's own resting burn (Mifflin–St Jeor)**. Formula, never a lookup table; snapshotted at log time; shown with "~" (about ±25 %). Supersedes the "(MET − 1)" / corrected-MET wording from the planning note.
- **Burn is separate from food:** its own figure and an optional daily burn goal. It never changes the food budget. Today shows Eaten · Burned · Net · Goal, and the goal kcal can be edited there.
- **Streaks:** food streak (D24) and workout streak in their own sections; a global "Prana streak" lights when food is on target and the workout is done. **Rest days are chosen by the user** (default Sunday) and never break the workout or global streak. Today's flame shows the global streak once workouts exist.
- Workouts get their own colour token, **jamun** (purple), in both themes.
- **2026-09-25 (Decided, built):** lifting kcal moved from time × MET to measured per-rep costs by movement (per rep a + b × kg, from Scott/Knausenberger and Reis 2017); rest and pace no longer change kcal; 54 core/conditioning moves stay on time × MET. Supersedes the "(MET − 1)"/time-only lifting rule above. See workouts.md "v2 as built".

## D26 — Natural-language + voice logging
Full spec, architecture and as-built notes: [nl-logging.md](nl-logging.md).
- **The LLM only turns text into structure** (`{meal, items[{name, qty, unit}]}`); nutrition always comes from the catalog + maths.
- **Server does only what needs secrets:** `/api/food/parse` (signed-in users only) = auth → Postgres rate limit → shared cache → OpenAI `gpt-6-luna` (Structured Outputs) → Zod. Never returns numbers, never writes logs.
- **Device does matching + maths + confirm card** (catalog + custom foods live there). Matching is a pure module, so it can move server-side later without a rewrite.
- Nothing is saved without confirmation; entries get `source` (manual/text/voice) + `raw_input`; corrections go to `parse_corrections`.
- Voice = Web Speech API filling the same box (en-IN), feature-detected; typing and plain search are always the fallback.
- Quality gate: `npm run eval:parse` (84 cases) on every prompt/model change.
- **Addendum 2026-09-25 (owner: "build it for workout as well"):** the same endpoint also returns `workouts[]` (names + only the numbers said) and `day` (today/yesterday). Burn comes from the D27 maths on the device; missing values come from the user's last session, else defaults, and are flagged on the card; body weight is asked, never guessed. One confirm card logs food and workouts together from either sheet. Details: nl-logging.md Part 5.

## D28 — Desktop log sheets are centred modals
Owner, 2026-09-25: the right-hand side panel made you move the pointer to the screen edge. On desktop (`lg`+) both log sheets now open as a **centred modal** (`components/Sheet.tsx`, rise + fade, Esc / click outside closes, no drag). Food: 680 px. Workout picking: **two-pane**, 1120 px (library grid left, the chosen exercise's logger right; before picking, the right pane shows today's session), so a session is logged without going back and forth; editing one entry: 500 px. Filter chips wrap on desktop instead of scrolling sideways. Phones keep the bottom sheet. Supersedes the "side panel" column of D17.

## D29 — "Add anything": one search bar for food and workouts
Owner, 2026-09-25: "a global search bar … that works for both … on home screen … one step button to add … super reliable".
- **Where:** a bar on Today under the week strip (phone + desktop), an "Add anything…" field at the top of the desktop sidebar, and **/** or **⌘K / Ctrl+K** anywhere on desktop. The bottom-nav + and the N / W shortcuts still open the food and workout sheets directly.
- **One sheet** (`components/log/QuickAdd.tsx`) searches foods and exercises + cardio together. Both lists come from the normal prefix search; the section that fits the words better goes first (typo-tolerant matcher scores from nl-logging.md: "curl" → workouts first, "dal" → food first). A sentence goes to the AI parser and the same confirm card as the two sheets (signed-in).
- **One tap, never blind:** "+" logs exactly what the row shows. Food: your last portion of it, else the default serving, into the meal picked in "Food in" (defaults to the time of day). Workout: your last session of that exercise repeated, burn recomputed for today's weight. A workout with nothing to repeat (or no body weight yet) shows › instead and opens the detail; Enter opens the best match, it never logs. Every one-tap add has an Undo toast.
- **Empty box:** My thalis (one tap logs all), then "Again?": your last 10 foods and workouts mixed by recency, each with +. New users see popular foods + workouts.
- **Voice from the bar:** the mic on the Today bar starts listening inside the same tap (iPhone browsers only allow the mic from a user gesture), so the sheet's speech hook lives in an always-mounted component.
- Nothing new is stored: it only calls existing store actions (`addEntry`, `addWorkout`, `logSavedMeal`), so sync is unchanged.

## D30 — Gym check-in
Full spec, review, answers and as-built notes: [gym-checkin.md](gym-checkin.md).
- **Manual**: "I'm at the gym" / "Done". Browsers can't track location in the background or geofence, so there's no automatic check-in on the web; a native app can add it later through `gym_events` (`source = native_geofence`).
- **The server decides and stamps the time.** `gym_visits` / `gym_events` are written only by API routes (service role → Postgres functions); users can read, never write, so a verdict can't be forged. One active visit per user is a database rule. Events are append-only.
- **Store visits, not location trails** (from phase 2: only distance + accuracy are kept).
- **Online by default; never block.** No signal → the visit is saved on the phone with the phone's clock, marked offline, uploaded on the next sync. Guests: phone only; sign in for synced/verified visits.
- **Location (phase 2–3):** two consent layers (app setting in `user_goals`, re-checked by the server; then the browser permission, only ever asked after our own explainer and a tap). The server measures the distance (Haversine) and decides; outside/fuzzy readings ask "Try again / Check in anyway". Gym location = current location or a Leaflet + OpenStreetMap map pin, radius 100–300 m.
- **Forgotten visits:** closed lazily (next app open / gym call, no cron) after 3 h, ending at the last exercise logged during the visit, else start + 1:30; the user can fix an auto-closed end. Visits under 20 min don't count. Nearby banner only with consent + an already-granted permission, checked on the phone.
- One gym per user for now (editable); gyms sync like other data. Unverified visits count (with a tag). Nearby detection runs on the phone. Distance = Haversine in TypeScript (no PostGIS). A counted visit makes the day a workout day (no separate visit streak). **Calories never come from visit time.**

## D31 — Today greeting
Owner, 2026-09-25: "a header with a greet msg … Indian tone … cool, motivations, comedic … hardcode a list". Full notes and the batch prompt: [greetings.md](greetings.md).
- **Hardcoded lines, not a live LLM call:** free, instant, offline, works for guests, tone reviewed once. Generated by browser Claude in batches, checked by `npm run greetings`, reviewed by a human.
- **Picked for the moment:** first day, back after a break, at the gym, rest day, workout done, streak ≥ 3, nothing logged by 1 pm, on track, Monday, weekend, time of day; else a general line. No repeats within 80 picks.
- **~600 good lines over thousands:** quality drops when an LLM writes 1000+ at once.
- **Same rules as the app (D23, D24):** celebrate habits, never food restriction or body shaming; bhai/bro lines skipped for a female profile; gym lines skipped for food-only users and on rest days.
- Same line until the app has been away 30 min; tap it for another.
- **Never wrong about the day:** office/commute lines only on weekdays; "log your lunch" nudges only when nothing is logged; no "go train" lines once today's workout is logged; weather is never stated as fact.

## D12 — Project docs
Decisions, features, future changes and data notes live as separate md files in `.claude/`, indexed in [CLAUDE.md](CLAUDE.md).
