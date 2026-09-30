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
| D17 | Responsive: phone, tablet and desktop layouts from one codebase | Decided (Today desktop columns superseded by D32) | 2026-09-24 |
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
| D31 | Today greeting: hardcoded desi lines picked for the moment, not a live LLM | Decided (built, 1,940 lines) | 2026-09-25 |
| D32 | Today on desktop: day summary left, trackers + one meals list right, two columns only from 1280 px | Decided (built) | 2026-09-25 |
| D33 | Workout tab: activity rings (burn today, Move + Strength this week vs WHO 2020 targets); fine print behind (i) | Decided (built) | 2026-09-25 |
| D34 | Routines: saved exercise lists; numbers follow your last session (Option B) with an ACSM overload hint; starters + custom | Decided (built) | 2026-09-25 |
| D35 | Workout week: hover a day to peek, click to stretch that day open, doodle hint to Exercises until used once | Decided (built) | 2026-09-25 |
| D36 | PRs: derived from the log (never stored), per exercise type; est. 1RM = Brzycki on sets of ≤ 10 reps; first log is a baseline; trophy banner on every logging path | Decided (built) | 2026-09-25 |
| D37 | Gym: edit in place vs switch (old gym retired, keeps its visits) + remove; place search behind our server (Geoapify, provider-agnostic, cached, rate limited) | Decided (built; search needs `GEOAPIFY_API_KEY`) | 2026-09-25 |
| D38 | Achievements menu: tiered badges for habits (derived, never stored) + the PR list, moved off the Workout tab; unlock banners queued with PRs | Decided (built) | 2026-09-25 |
| D39 | Body: tape measurements (synced) + progress photos (this device only, never uploaded); waist ÷ height vs 0.5 | Decided (built) | 2026-09-25 |
| D40 | Rest timer: tick a set's number to start it; floating pill above sheets; per-set "last time" with ▲/▼ | Decided (built) | 2026-09-25 |
| D41 | Muscles this week: fractional weekly sets per muscle (Pelland 2025) on a front/back body, bands < 5 / 5–9 / 10+ (Schoenfeld 2017) | Decided (built) | 2026-09-25 |
| D42 | Weekly Wrapped: Monday–Sunday story cards (current week from Sunday 6 pm), derived on the device; share image drawn on a canvas, habits only (no kcal eaten, no body weight) | Decided (built) | 2026-09-25 |
| D43 | Festival / shaadi days: a marked day is skipped by the food streak (neither adds nor breaks), max 4 a month, mark on the day or up to 2 days after | Decided (not built) | 2026-09-25 |
| D44 | Calorie bank = plan ahead: pick a splurge day, the extra comes evenly off the other days of that week (never below a safe floor); streaks judge each day against its adjusted goal | Decided (not built) | 2026-09-25 |
| D45 | Resting burn (BMR) shown: "Your energy" card in Me (live count + how the goal is built), goal refresh nudge when weight moves it ≥ 50 kcal, BMR on the Progress weight card, resting context in the workout logger | Decided (built) | 2026-09-27 |
| D46 | Social leaderboard: opt-in (consent, chosen name + @handle, 18+), ranked by active days (cap 6/week, 26/month) → effort (% of a standard day, capped) → verified gym days; calories never ranked; computed only on the server; lives in a new **Akhada** tab (Leaderboard · Challenges · Awards) | Decided (built; migrations not pushed) | 2026-09-27 |
| D47 | Challenges: 1:1 / group / open to everyone; lift targets need a real logged set of 1–5 reps (✓ when logged during a verified gym visit, else "self-reported"), impossible lifts blocked, big jumps flagged, members can dispute; video proof later | Decided (built; migrations not pushed) | 2026-09-27 |
| D48 | Weekly duels: 1v1 with a friend, 7 days from the day after accepting; score = effort on your best 6 days (max 600); tie → verified gym days → draw; invites expire in 48 h; max 5 open | Decided (built; migration not pushed) | 2026-09-27 |
| D49 | Results settle (frozen) 3 days after the last day, lazily on app open: notifications + Akhada badges (Finisher, Champion, Duel master, Shabaash); kudos once per friend per active day; nudges after 3 quiet days, once per 3 days, opt-out | Decided (built; migration not pushed) | 2026-09-27 |
| D50 | Saving on the device: batched localStorage writes (≤ 1 per 500 ms, immediate when hidden), failed saves caught + shown, storage.persist(), iPhone guest hint; move to per-record IndexedDB before users have ~2 years of logs | Decided (steps 1–4 built) | 2026-09-27 |
| D51 | Admin panel: server-decided admins (ADMIN_EMAILS, Google only), read through service-role Postgres functions, read-only except resolving reports, every member view/export logged | Decided (built; migration not pushed) | 2026-09-27 |
| D52 | Deep-fried foods: absorbed-oil model (sourced dough + measured fat of the fried food, dry basis × (1 − moisture)); INDB deep-fried rows no longer added; fresh-oil values for home food, reused-oil for street food | Decided (checker built; existing fried rows not converted yet) | 2026-09-28 |
| D53 | Alcohol: new `alcohol` category; kcal = 7 × ethanol g (ABV × 0.789) + 4 × (protein + carbs) + 9 × fat; ABV per brand from label / brand / excise sources, carbs from the brand or the USDA style row; ml everywhere; logged like food, no judgement | Decided (built; beers from batch A1) | 2026-09-29 |
| D54 | Missing foods: record what people can't find (search, AI logging, custom foods, "Request it"), fix alias gaps first, then a scheduled research agent that returns source **references** (never numbers); `check-research.mjs` re-reads every number; approved foods live in a Supabase table, approved by the owner in the admin panel, merged into search on the device (no deploy); people who asked are told | Decided (built, phases 1–5) | 2026-09-30 |

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

## D32 — Today layout on desktop
Owner, 2026-09-25: the desktop Today "looks very scattered" (long summary column on the left, four short meal cards stretched to equal heights on the right, a big empty area below). Supersedes the Today rows of D17.
- **xl (≥ 1280):** left = your day (week strip, "Add anything" bar, calorie ring card; sticky); right = three equal tiles **Chai · Water · Burned**, then **Meals** as one list. Both columns end up about the same height.
- **lg (1024–1279):** one column, like tablets (chai + water side by side, Burned as a row, meals 2-up). With the 256 px sidebar the right column would only be ~256 px: tiles crushed, dish names cut.
- Meal cards keep their own height everywhere (no empty stretched cards). Phone order and layout unchanged.

## D33 — Activity rings on the Workout tab
Owner, 2026-09-25: the Workout tab "looks very standard, dull… no excitement in seeing those numbers". Owner picked **activity rings** (over a session scoreboard, a muscle map, or a streak redesign). Details: [workouts.md](workouts.md) "Activity rings".
- One dial, three nested rings: **Burn** (outer, jamun→chilli) = today's estimate vs the burn goal (any workout fills it when there's no goal, same rule as the streak); **Move** (saffron→turmeric) = this week's moderate-equivalent cardio minutes vs **150**; **Strength** (leaf→sky) = this week's days with a lift vs **2**. Legend beside the dial (under it on narrow phones).
- **Targets are sourced, not invented:** WHO 2020 guidelines (Bull et al., BJSM 2020): 150–300 min moderate or 75–150 min vigorous aerobic activity a week, and muscle-strengthening on 2+ days a week. Vigorous = ≥ 6 METs counts double; light (< 3 METs) doesn't count; lifting counts for Strength, not Move.
- Hitting either weekly WHO mark gets a burst + toast, like the burn goal. The week is the Monday–Sunday of the selected day.
- Fine print (burn method, WHO rules, streak rules) moves behind an **(i)** on the Workout tab. Progress keeps its streak notes visible (its grid is aligned on them).

## D34 — Routines ("Chest day", "Push")
Owner, 2026-09-25: "people can create a set … for chest or legs … a card that they can click, instant add … they keep on increasing wt, so they can edit each exercise". Details: [workouts.md](workouts.md) "Routines".
- **A routine stores which exercises, in order, never numbers.** Each exercise repeats your **last session** of it (owner chose "Option B" over fixed numbers), so getting stronger never means editing the routine. No history yet → the logger's defaults, flagged "First time · check the numbers".
- **Overload hint, never automatic:** "↑ 62.5 kg?" when every set at the same weight reached the first set's reps in your last two sessions (ACSM 2009 position stand: +2–10 % after two consecutive sessions with reps to spare; we don't know the target reps, so "no drop-off" stands in). Step = the app's kg step (2.5 kg / 1 kg dumbbells); bodyweight moves get +1 rep.
- **Two ways to log:** a checklist (tick = logged at once, so closing the app mid-workout loses nothing; untick removes it) and **Log all**. One tap from the card only when every remaining exercise has a last session (D29 "never blind"); otherwise the card opens the checklist.
- Logged workouts carry `routineId` (last done, progress, the week strip's "Chest day" label). Starters Push / Pull / Legs / Full body are copied into your routines when used; custom ones via the builder or "Save as routine" on a session.
- Synced like thalis: `routines` table (jsonb, RLS), migration `20260925160000_routines`.

## D35 — Discoverable week details on the Workout tab
Owner, 2026-09-25: nobody would know "Exercises" opens each day's logs; wanted an arrow/SVG hint, and a day to stretch open on click (or show on hover).
- **Hover (desktop):** a floating card under the day: routine, each exercise with photo + sets (or minutes), kcal, "Click to open". Keyboard focus shows it too. Nothing on the page moves.
- **Click:** selects the day (as before) and stretches only that tile open; a second click folds it. "Exercises" still opens every day as a calendar.
- **Cues:** days with workouts show a small chevron that bobs on hover; a hand-drawn arrow draws itself toward "Exercises" ("see every day's workout") on tablet/desktop, a soft ping around the button on phones, until "Exercises" or a day has been opened once (`localStorage["prana-week-hint"]`).

## D36 — Personal records (PRs)
Owner, 2026-09-25: "PR for each [exercise] … we don't have to ask, auto detect … our own logic to calculate and show". Details: [workouts.md](workouts.md) "PRs".
- **Derived, never stored** (`lib/records.ts`, pure): walk the log oldest → newest; per exercise and record kind keep the best. Editing or deleting a log fixes records by itself; nothing to sync, no migration.
- **What counts, by exercise type:** weighted lifts: heaviest weight, best est. 1-rep max, best set (kg × reps); bodyweight: most reps, most added kg; assisted: least counterweight (lower is better) + most reps; holds: longest; cardio: longest session, and for walks/runs of 5+ min fastest speed + farthest distance.
- **Est. 1-rep max = Brzycki** (w × 36 / (37 − reps)), only on sets of 1–10 reps: accuracy falls as reps rise (LeSuer 1997: ≤ 10 reps to fatigue predicts 1RM well; Reynolds 2006: 5RM predicts best). Our sets aren't always to failure, so it's shown as "est." and reads as a floor.
- **First log is a baseline, not a PR**; a PR must be strictly better than every earlier log (equal isn't).
- **Celebration:** one trophy banner at the top (never covers the bottom Undo toast) for every logging path (sheet, routine, Add anything, voice), fed by a store watcher; only fresh logs (not sync pulls, reloads or undo-restores). Plus: live "New PR" chip while editing sets, 🏆 on session rows, routine rows, week strip days, and a Personal records card.

## D37 — Editing and switching the gym, place search
Owner, 2026-09-25: "user might change gym … allow editing the location"; for search: "production grade, think long term, not a shortcut". Details: [gym-checkin.md](gym-checkin.md) "Editing, switching and place search".
- **Edit ≠ switch.** Edit (pin, name, radius) changes the same `user_gyms` row. **Switch** creates a new gym and soft-deletes the old one, so past visits keep pointing at the gym they happened at (same idea as D05: history is never rewritten). **Remove** soft-deletes. Switch/remove are blocked during a visit. Clear "Edit" button on the Gym card + **Me → Your gym**.
- **Current gym = newest `createdAt`** (`currentGym()`), never `gyms[0]`: a device offline during a switch can bring the old row back (last write wins).
- Offline/guest visits uploaded after a switch may reference your own retired gym (migration `…170000_gym_switch`); live check-ins still need a current gym.
- **Place search goes through our route** `/api/places/search` (sign-in, per-user limit, shared Postgres cache, key on the server) behind a provider interface. **Provider: Geoapify** (OSM data; commercial use on the free tier; storing results allowed; any map). **Ruled out by their terms:** Google Places (no non-Google map, lat/lng max 30 days), Mapbox (POIs only on a Mapbox map, no storing temporary results), Mappls (no non-Mappls map, no cache), HERE (30-day storage), public Nominatim (no autocomplete), public Photon (no guarantee). Ola Maps: terms silent on storage, so not yet.
- **Search only helps you get close; the pin you confirm is the gym.** OSM knows ~2,400 gyms in all of India, so area search → "Gyms nearby" → tap/drag the pin is the main path, and every empty/failed state points back to the map and current location. The picked result is kept as `user_gyms.place` (provider, id, area label) only while the pin stays within 1 km of it.

## D38 — Achievements: badges + records
Owner, 2026-09-25: "keep [PRs] in an achievements menu … a badge system … 5 days streak, PR breaker … if we put everything in the workout section this would be cluttered … nothing else should break … UI cool".
- **New screen `/achievements`** (phone tab "Awards", sidebar "Achievements"): a summary hero (earned / total, count per metal, latest, "Next up" = the locked tier closest to done), then **Badges** and **Records** tabs. The Personal records card moved here from the Workout tab; the small PR signals (banner, row chips, week trophies) stay where you log.
- **Badges are derived from history, never stored** (`lib/badges.ts` pure + `lib/useBadges.ts`), like PRs (D36): no migration, can't drift, deleting data can un-earn. Streak badges use your **best run ever** (`runStreak` now records `bestDates`), so a broken streak never takes a badge away.
- **12 families × 4 metals (bronze, silver, gold, diamond) + 9 one-offs = 57.** Streaks (food 5/14/30/100, workout 5/14/30/60, Prana 3/7/21/50), Training (PR sessions 1/10/25/50, workout days, routine sessions, gym visits), Habits (days logged, on target, protein goal, 8 glasses, weigh-ins), One-offs (first meal, first workout, thali, routine, early bird, weekend warrior, comeback after a week away, perfect week, bench est. 1RM ≥ body weight).
- **Habits only:** no weight-loss or eat-less badges (same rule as D23, D31).
- **Unlock banner** shares one queue with PR banners (`lib/celebrate.ts`), so they never overlap; tapping opens Achievements. Announced-once per device via `localStorage["prana-badges-seen"]`; the first run and anything earned before yesterday (history pulled onto a new phone) are marked seen silently.
- Medal art: SVG hexagon per metal; new tokens `bronze` + `silver` (both themes), gold = turmeric, diamond = sky → jamun.

## D39 — Body measurements and progress photos
Owner, 2026-09-25 (from the roadmap). Details: [workouts.md](workouts.md) "Body".
- **Measurements** (Progress → Body): waist, hips, chest, arms, thighs, neck in cm, one entry per day, synced (`measurements` table, jsonb, migration `20260925180000_measurements`). Waist + hips measured the WHO way (2008 expert consultation). Only the waist trend is coloured (smaller = better); the rest depend on the goal.
- **Waist ÷ height** vs **0.5** (Ashwell, Gunn & Gibson, Obes Rev 2012: better than BMI for cardiometabolic risk, same boundary for men and women across 14 countries).
- **Progress photos stay on the device** (IndexedDB), never uploaded or synced: they're the most private thing in the app. Re-encoded on add (≤ 1280 px JPEG), which also strips EXIF/GPS. Before/after slider over any two dates. Not in backups or other devices, by design.

## D40 — Rest timer and last session per set
Owner, 2026-09-25. In the exercise logger (today's new logs), the set number is the done-tick: tapping it marks the set ✓ and starts a rest countdown of the chosen rest length (none after the last set). The countdown is a floating pill at the top of the screen, above sheets (`data-float-ui`; `Sheet` ignores clicks on it), with −15/+15/skip, vibration + a short WebAudio beep at the end, and the tab title counting down on desktop. Only the end time is stored (`prana-rest`), so a locked phone or reload keeps it right. Under each set: last session's same set and ▲/▼ (more weight, or same weight and more reps). The old one-line "Last time" pill became "vs <date>" in the Sets header.

## D41 — Muscles this week
Owner, 2026-09-25. A card on the Workout tab: front + back body, each muscle shaded by this week's sets, plus a bar per trained muscle with a 10-set mark. **Fractional counting** (1 per set for targeted muscles, ½ for assisting ones): Pelland et al., Sports Med 2025. **Bands** < 5, 5–9, 10+ weekly sets: Schoenfeld, Ogborn & Krieger, J Sports Sci 2017 (graded dose-response). Lifts only, Monday–Sunday. Phones list the top 6 muscles ("Show all").

## D42 — Weekly Wrapped
Owner, 2026-09-25 (roadmap order: Wrapped → festival → bank). Details: [engagement.md](engagement.md).
- **Week = Monday–Sunday** (as the week strips). The current week opens on **Sunday from 6 pm**; earlier weeks any time (last 12 with data). Today shows a banner Sunday 6 pm → Tuesday until opened or dismissed (per device); Progress has a Wrapped card with earlier weeks.
- **Derived, never stored:** `lib/wrapped.ts` (pure) from the store + the same day judges as the streak cards, PR hits (one per session, its headline kind) and badge unlocks. A new streak rule (D43, D44) reaches Wrapped with no change there.
- **Same rules as D23/D24:** only habits are celebrated; no kcal eaten anywhere in Wrapped; not-on-target days are neutral ("logged"), never red. The share image (canvas, 1080 × 1920, live theme tokens + app fonts, drawn on the device) has no kcal and no body weight. Web Share with the file where supported, else download.
- **Persona:** one title per week, most remarkable habit first (Perfect week, Record breaker, Gym regular, Protein pro, Never missed a log, On target, Hydration hero, Chai connoisseur, Food explorer, Moving well), fallback "Showing up".

## D43 — Festival / shaadi days (Decided, not built)
Owner's pick of three options (2026-09-25): a marked celebration day is **skipped** by the food streak like a workout rest day, **max 4 per month**, markable on the day or up to 2 days after. Rejected: unlimited (easy to abuse), counting as on target (too generous).

## D44 — Calorie bank (Decided, not built)
Owner's pick (2026-09-25): **plan ahead**. Choose a splurge day in advance (e.g. +600 on Saturday); the extra is taken evenly from the other days of that week, never pushing a day below a safe floor; streaks judge each day against its adjusted goal. Rejected: "save as you go" (rewards under-eating, against D24) and a pure weekly budget.

## D45 — Resting burn (BMR) made visible
Owner, 2026-09-27: "integrate BMR … plan where we will show this data … take care of UI", then "build all 4".
- **One formula, `lib/energy.ts`** (pure): Mifflin–St Jeor, now shared by the goal calculator and the workout burn (they had separate copies; results are identical, tested). Frankenfield 2005 (systematic review): the most reliable common equation, within 10 % of measured for more people than any other, with individual errors and thin data for some groups; no solid validation found for Indian adults → always "~ estimate".
- **Weight = 7-day average of weigh-ins** ending at the latest one (same smoothing as Progress), else the profile's weight. Before this, the goal only knew the weight typed into the calculator.
- **Me → "Your energy"**: a live "~1,134.6 kcal burned since midnight" counter, a stacked bar (resting · daily life · aim hatched · pin at your goal) and a receipt: BMR + daily life = maintenance ± aim = goal.
- **Goal refresh nudge** (Me + top of Progress): only when the goal came from the calculator (a goal you typed yourself is left alone) and today's weight moves the suggestion by ≥ 50 kcal. Neutral wording (weights, not "lighter/heavier"); Update (with Undo) sets profile weight + goals; "Not now" hides it until the suggestion moves another 50.
- **Progress weight card:** "Resting burn ~1,690 · −39 kcal/day since 18 Aug".
- **Workout logger footer:** "That's extra, on top of ~7 kcal your body burns resting anyway", explaining why burn numbers are lower than other apps (resting isn't counted twice).
- Today is unchanged (owner's choice). No migration.

## D46 — Social leaderboard (Akhada)
Owner, 2026-09-27: "leaderboard … week, month … first each day streak (of the gym), then exercise they did each day, and calories they burn each day … find the best way possible". Research + full design: [social.md](social.md). Owner picked the recommended option on all four questions:
- **Ranking:** active days → effort → verified gym days (not the original streak → exercises → calories): calories scale with body weight (heavier people would always win) and ranking them carries eating-disorder risk; "exercises done" rewards splitting a session. Active days capped (6/week, 26/month) so rest is never punished; effort = % of a standard training day, capped at 100 % per day; ties share a rank. The 🔥 streak is shown, not ranked.
- **Visibility:** opt-in with a separate consent screen, chosen display name + @handle (not the Google name), 18+ (DPDP: consent to show data; no tracking of children). Public = active days, effort, streak, verified share only.
- **Trust:** scores come only from server-side aggregates of synced rows (users can't write scores); guests never rank; logs synced > 48 h after the day don't count; hard caps; GPS-verified gym days are shown with ✓.
- **Where:** the Awards tab becomes **Akhada** (अखाड़ा) with Leaderboard · Challenges · Awards.

## D47 — Challenges
Owner, 2026-09-27: "one person can put challenge … 100 kg deadlift with someone, or everyone". Kinds: lift target, active days, active minutes, a shared group goal; audiences: people you invite (friends or link) or open to everyone. **Lift proof (owner's pick):** a real logged set of 1–5 reps at or above the target; ✓ verified when logged during a GPS-verified gym visit, else "self-reported"; lifts above world-record level rejected, jumps > 15 % over your recent best flagged; members can dispute. Video proof is a later phase.

## D48 — Weekly duels
Owner, 2026-09-27: "1v1 weekly duels (Apple Watch style): pick a friend, whoever scores more effort in 7 days wins". Like Apple's competitions, a duel starts the day after it's accepted (nobody gets a head start) and scores are capped per day; here each day is the same effort (0–100) as the leaderboard, and only the **best 6 of the 7 days** count (max 600), so one rest day never costs anything (D46). Tie → more GPS-verified gym days; still equal → draw. Friends only, one open duel per pair, at most 5 open, invites expire after 48 h. Rematch in one tap.

## D49 — Results, badges, kudos and nudges
- **Settling:** logs may arrive up to 48 h late (D46), so a challenge or duel ending on day E shows "provisional" and becomes **final on E + 3**. `social_sync()` (called when the app opens) settles it: every member's value, done and **shared place** are frozen, members are notified, and later edits can't change it. No cron.
- **Badges** (Awards → Akhada, same tiers engine as D38): Finisher (challenges completed), Champion (1st place, 2+ people; ties share), Duel master (duels won), Shabaash (days a friend cheered you). Fed by `social_trophies()`, cached on the device so Awards works offline; the existing unlock banner celebrates them.
- **Share cards:** the result or the duel score as a 1080 × 1920 image, drawn on the device (no calories, no body weight).
- **Kudos:** one "🔥 Shabaash" per friend per active day (today or yesterday). **Nudges:** only when a friend has had no active day for 3 days, at most once every 3 days per friend, and anyone can turn them off (Me → Akhada profile). Positive by design: no "you're falling behind" messages.

## D50 — Saving on the device
Owner asked whether "one localStorage blob, rewritten on every change, capped at ~5 MB" is a real problem (2026-09-27). Checked, not assumed (architecture.md "Local storage"): **true, but years away.** Measured in Chrome 153: ~5.24 M characters per site; a typical user adds ~1.4–1.5 M a year (heavy ~2.3 M, light ~0.8 M), so saving fails after ~2–6 years; one save costs 2 ms (Mac) to ~14 ms (budget-Android CPU) at 1 year, 30–51 ms at 3 years. The real gaps were the failure mode (an uncaught QuotaExceededError: the change shows but isn't saved) and Safari deleting a site's storage after 7 days without a visit (home-screen apps exempt).
- **Built now:** writes batched (latest state at most every 500 ms, at once when hidden/closed); failed saves caught → banner + toast (guests: "sign in to keep your logs"; signed in: "safe in your account"); `navigator.storage.persist()` asked once (not in Firefox, which prompts); iPhone guests in Safari get an "Add to Home Screen or sign in" hint (dismiss = 14 days).
- **Next (Proposed):** per-record IndexedDB storage (only the changed item is written; quota becomes a share of the disk), with a one-time move of `ct-v1`. Do it before real users approach ~2 years of logs.

## D51 — Admin panel
Owner, 2026-09-27: "an admin panel where admin can see each user, what they are eating, doing workout, everything, on different charts and graphs … build it in a better way, I might forget to include something". Details: [admin.md](admin.md).
- **Admins are decided on the server:** `ADMIN_EMAILS` (server env; not `NEXT_PUBLIC_`, not in the public repo) and a Google sign-in only. The browser only asks `/api/admin/me` to decide whether to show links.
- **Data is read with the service role**, through `/api/admin/*` and Postgres functions granted only to `service_role` (aggregates run in the database, not by downloading every row). Member pages reuse the app's own rules (streaks, PRs, day status) so the admin sees what the member sees.
- **Read-only**, except resolving Akhada reports (the moderation queue social.md left for later). No editing members' data.
- **Every member view and export is written to `admin_audit`**, shown in the panel. Looking at someone's food and body data always leaves a trace; the privacy policy must say admins can see logged data (DPDP).
- Included beyond the ask: retention, when-people-log heatmap, catalog gaps (custom foods), AI corrections + cost, gym verification health, storage, CSV + per-member JSON export.

## D52 — Deep-fried foods: absorbed-oil model (resolves Q4)
Owner's pick, 2026-09-28, over "keep holding fried foods" and "ship INDB rows with the badge" (D16). INDB recipes count the whole pan of frying oil: bread pakora 711 kcal and 74 g fat per 100 g, aloo bonda 633, bhatura 793.
- **Model:** a fried food = its dough / batter / filling from INDB / IFCT / USDA (no frying oil) + the fat that kind of food actually holds, from a measurement. Fat as eaten = fat on dry weight × (1 − moisture); protein, carbs and fiber fill the rest of the dry matter in the dough's proportions (ash ignored, so kcal reads a little high). Computed by `scripts/check-research.mjs` (`recipe.frying`), never typed in.
- **Anchor measurement:** Jain, Passi & Selvamurthy, J Food Sci Technol 2024 (https://pmc.ncbi.nlm.nih.gov/articles/PMC11465016/): poori, bread pakora, french fries, potato chips, mathri fried in groundnut oil; total fat reported on **dry weight** (Soxhlet), rising with frying cycles (e.g. poori 20.8 % at the 1st cycle → 25.1 % at the 32nd); moisture reported for mathri (~24 %) and poori (> 32 %). The per-food table lives in `scripts/check-research.mjs` (`JPS2024`); the full text is behind a reCAPTCHA / paywall, and the values were checked against the abstract (NCBI E-utilities): they average exactly to its stated 22.5 % (1st cycle) and 27.4 % (32nd). Research files name the cell (`fat_ref: "JPS2024:poori:180:32"`), the checker supplies the number. The earlier research notes quoted "22.5–27.4 % fat by weight" as if as eaten: that was dry basis. Example: home poori (atta, 20.78 % dry-basis fat, 32 % moisture) → 14.1 g fat, ~314 kcal / 100 g (INDB: 443).
- **Fresh vs reused oil:** 1st-cycle values for home-made food, 32nd-cycle values for street / shop food (vendors reuse oil). Foods without their own measurement use the closest measured food of the same type (wheat dough → poori / mathri, besan batter → bread pakora, potato → fries / chips), named in notes, confidence low.
- New INDB deep-fried rows are refused. The 13 fried rows already in the catalog (samosa, kachori, pakora, poori, bhatura, vada, gulab jamun…) keep their "high estimate" badge until they're rebuilt with the model (future.md).

## D53 — Alcohol
Owner, 2026-09-28: "users also have these on weekends, so we have to integrate this as well" (beer, wine, whisky by brand, ABV, ml). Research prompt: `data/research/PROMPT-ALCOHOL.txt` (batches A1–A7).
- **Energy:** ethanol is 7 kcal/g (FAO; EU Reg. 1169/2011 Annex XIV); grams per 100 ml = ABV × 0.789 (ethanol density at 20 °C). kcal is always computed by `scripts/check-research.mjs`: 7 × alcohol + 4 × (protein + carbs) + 9 × fat, never typed in; a brand's own stated kcal is only a cross-check.
- **Sources:** ABV must be the brand's own (label, brand / parent-company site, state excise list); Indian labels rarely print nutrition, so carbs / protein come from the brand's official nutrition page if there is one, else the USDA row for the style (e.g. "Alcoholic beverage, beer, regular, all"). Beer-rating sites (Untappd, BeerAdvocate), shops and blogs don't count, which is why Kingfisher, Budweiser, Tuborg… are still missing after A1.
- **App:** category `alcohol` ("Beer, wine & spirits", beer-mug art, a custom-food option), catalog field `alc` (g ethanol / 100 ml), amounts shown in ml, the detail line "incl. N kcal from alcohol (g)" so protein + carbs + fat visibly don't add up to the total, the glass drawing for bottles / cans / pegs. Units peg (60 ml), peg_small, quarter, pint, bottle_650, can_500… are countable pieces; they're not the "glass" kind, because the AI logger converts glasses by 250 ml.
- **Same rules as food:** counted in calories, no warnings, badges or streak penalties for drinking (D23).

## D54 — Missing foods: requests + research agent
Owner, 2026-09-30: when a search finds nothing, instead of only "add it yourself", a scheduler + agent should find the food in official sources and add it to the catalog in the same form as the others; "think from all the wide angles… if any better approach exists". Full proposal: [food-requests.md](food-requests.md).
- **The agent is a researcher, not a source.** It returns references in the existing batch schema (INDB code, IFCT code, USDA fdcId / exact description, DERIVED recipe with sourced ingredients, official label URL); `scripts/check-research.mjs` re-reads every number, exactly as for browser-Claude batches. Keeps D03 and the LLM rule.
- **Better than browser Claude:** the agent gets lookup tools over the real datasets (INDB.xlsx, IFCT CSV, USDA downloads), so it picks codes that exist instead of guessing (batch 1 lost 19 dishes to that).
- **Many misses aren't missing foods** but missing names ("fulka", "anda curry"): an alias triage step with the existing matcher comes first and needs no nutrition data.
- ~~**Publishing:** a PR the owner reviews and merges~~ (proposal; replaced by the owner's pick Q11 = B below) (static catalog, D13; the owner commits); label / chain values always need the owner's check. Not in real time while the user waits (minutes, cost, review).
- **Decided (owner, 2026-09-30, Q11 = B):** new foods go into a Supabase table, not a PR to the code file; the owner approves each one in the admin panel; the app downloads approved foods and merges them into search like custom foods. The built-in catalog (D13) stays; this adds a second, reviewed path on top. Q10 follows: an admin "Run research" button first, a daily Vercel Cron call later.
- **Numbers:** the AI returns references only; the server reads the numbers from INDB.xlsx / IFCT CSV / USDA API itself. Label values (no dataset) are transcribed and checked by the owner against the image (Q12 open).
- **Decided (owner, 2026-09-30, Q9, Q12):** OpenAI runs the research, `RESEARCH_MODEL` default `gpt-6-astra` (tested: luna can web-search too, but it paired USDA 171265 with another food's name; astra got id and name right); the agent may transcribe official label images / chain PDFs (`MFR_LABEL`), always checked by the owner beside the image before approval. Phase 4 (2026-09-30): labels are read by `LABEL_MODEL` = `gpt-6-luna` (tested on known labels: 20/20, plus a blurred misaligned one twice; astra slipped once); the server compares every value and refuses Approve on a difference or without the owner's tick.
- **Phase 5 default (2026-09-30, the owner can widen it):** only people who tapped "Request it" or made the food themselves are told when it's added or found under another name; silent signals (a search that found nothing, an AI miss) aren't. Swapping their own version moves thalis at the same grams; past logs keep their snapshots.
- **Decided (owner, 2026-09-30, Q8):** record both "Request it" taps and failed searches / AI misses; signed-in users only; the food name text only.
- Open: Q9–Q12 in future.md.

## D12 — Project docs
Decisions, features, future changes and data notes live as separate md files in `.claude/`, indexed in [CLAUDE.md](CLAUDE.md).
