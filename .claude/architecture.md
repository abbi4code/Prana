# Architecture

How Prana works, where things live, and the traps already hit once. Decisions referenced as Dxx are in [decisions.md](decisions.md).

## Stack (as built)

| Layer | Choice | Notes |
|---|---|---|
| Framework | **Next.js 16.3** App Router, React 19.2, TypeScript | Turbopack default. All pages are client components rendered on the device (no server data fetching). |
| Styling | **Tailwind CSS v4** | Design tokens in `src/app/globals.css` (`@theme`). No component library (shadcn was planned in D01, never used). |
| Motion | `motion` (Framer Motion v13, import from `motion/react`) | springs, `layoutId`, drag/pan gestures |
| State | `zustand` v5 + `persist` → localStorage key **`ct-v1`** | the whole user dataset lives here (D14) |
| Sheets | `vaul` drawer | bottom sheet on phone, right side panel on desktop |
| Charts | `recharts` v3 | themed via CSS + `useTokens()` |
| Maps | `leaflet` 1.9 + OpenStreetMap tiles | gym location picker only, loaded on demand; tiles inverted in dark mode (`--map-filter`) |
| Icons | `lucide-react` (UI) + hand-drawn inline SVG food art | |
| Backend | **Supabase**: Postgres + RLS + Google OAuth (PKCE, browser-only) | `@supabase/supabase-js`; no server code |
| Offline | hand-written `public/sw.js` (D15) | production only |
| Server | one route, `POST /api/food/parse` (Node runtime) + `src/server/*` (`server-only`) | the only server code; everything else is on the device (D26) |
| AI | OpenAI `gpt-6-luna` via `openai` SDK, Structured Outputs + `zod` | text → structure only; see [nl-logging.md](nl-logging.md) |

## Folder map

```
src/app/
  layout.tsx            fonts (Manrope + Fraunces), theme no-flash script, <AppShell>
  template.tsx          page rise-and-fade on navigation
  page.tsx              Today
  workout/page.tsx      Workout tab: gym check-in card (D30), burn card, session list, workout streak, workout goals (D27)
  api/gym/              check-in, check-out, active, visit (fix end) (D30): sign-in required, server-written visits, lazy auto-close on every call
  api/places/search/    gym place search (D37): sign-in, rate limit, shared cache, provider behind an interface (Geoapify)
  api/admin/            admin panel API (D51): me, stats?section=, users, user?id= (logged), reports (resolve); admin = ADMIN_EMAILS + Google, server-checked
  admin/, admin/u/[id]/ admin panel pages (D51, admin.md)
  progress/page.tsx     Prana (global) + food streak cards, year heatmap (food/workout/both), weight, 14-day calories
  achievements/page.tsx badges (D38) + records (D36) tabs, summary hero
  me/page.tsx           goal calculator, goals, appearance, my foods, account + backup
  login/, auth/callback/  login screen (full-screen, no nav), OAuth return page
  manifest.ts, icon.tsx, apple-icon.tsx, pwa-icon/[size]/route.tsx   PWA manifest + generated icons
  globals.css           theme tokens (dark + light), utilities (card, skeleton, tabular), Recharts overrides
src/components/
  AppShell.tsx          hydrate store → init auth; login gate; keyboard N (food), W (workout), / or ⌘K ("Add anything", D29); nav + sheets + toaster
  Sheet.tsx             shared sheet frame: vaul bottom sheet on phones, centred modal on desktop (D28)
  BottomNav.tsx / Sidebar.tsx   phone / desktop navigation (NAV_TABS shared)
  FoodIcon.tsx          category illustrations (48×48 SVG per Category), `bare` mode for the thali
  RollingNumber.tsx     odometer digits  ·  Burst.tsx particles + useGoalHits  ·  Toaster.tsx undo toasts
  log/                  LogSheet (add/edit/thali flows), FoodDetail, PortionVisual (katori/glass/pieces), CreateFood, NlLog + ConfirmParse + ConfirmWorkoutRow (NL confirm card, used by all three sheets), QuickAdd ("Add anything" sheet, D29)
  thali/                ThaliPlate (steel thali art), ThaliBuilder
  today/                AddBar ("Add anything" + mic, D29), CalorieRing, MacroBars, DateStrip (+streak flame), Greeting (D31), QuickRow (chai/water), MealCard (swipe rows), BurnCard
  workout/              Routines + RoutineSheet (D34: cards, checklist, builder, picker), WorkoutWeek (week strip with streak marks + "Exercises" per day), WorkoutSheet (library, LiftDetail, CardioDetail), WorkoutList (swipe rows), ActivityRings (burn / Move / Strength dial, D33), MuscleMap (D41), RestTimer (D40), WorkoutCards (goals), ExercisePhoto
  akhada/               Akhada (D46–D49): Profile (gate, consent/edit, avatar), Leaderboard (+ Trained today), People (person / friends / inbox sheets, CheerButton), Challenges (tab, create, detail, Results), Duels (block, picker, DuelView), AkhadaCard (Me)
  admin/                admin panel (D51): ui.tsx kit (Panel, Stat, Segmented, BarList, SplitBar, Ring), AdminGate, AdminLink, Overview, UsersTab, FoodTab, TrainingTab, SocialTab, SystemTab, UserDetail, UserDay, Corrections
  wrapped/              Weekly Wrapped (D42): WrappedViewer (stories), WrappedCards, WrappedEntry (Today banner, Progress card)
  progress/             StreakShell (one layout for every streak card) + StreakCard / PranaStreakCard / WorkoutStreakCard, YearHeatmap (fluid squares)
  account/              GoogleButton, AccountCard (+ SyncStatus, Avatar)
src/lib/
  types.ts              Food, FoodUnit, Entry, Goals, Profile, SavedMeal, ThaliItem, Category, UnitKind
  foods.ts              catalog (static JSON) + custom-food registry + Hinglish search/ranking
  nutrition.ts          portion maths, MEALS, qtyOptions per unit kind, Mifflin–St Jeor goals
  store.ts              useStore (persisted data + sync queue + actions) and useUI (sheet, date, toast, fresh ids)
  thali.ts              resolveItems / thaliTotals for saved meals
  energy.ts             D45: PURE Mifflin–St Jeor (shared by goals + burn), goal breakdown, currentWeight (7-day avg); useEnergy.ts adds the refresh rule
  badges.ts             D38: PURE badge catalogue + evaluate(facts); useBadges.ts builds the facts from the store; celebrate.ts = banner queue (PRs + badges)
  records.ts            D36: PRs derived from the log (metrics, computeRecords, wouldBreak, Brzycki e1RM); useRecords.ts wraps it
  routines.ts           D34: STARTERS, draftFor (last session → defaults), overloadHint, draftWorkout (burn), summaries
  streaks.ts            PURE streak rules (dayStatus, runStreak engine with rest days, workoutDay, globalDay); useStreaks.ts wraps the food one
  muscles.ts            PURE weekly sets per muscle, fractional (D41)
  restTimer.ts          rest countdown store (D40) · photos.ts: progress photos in IndexedDB, device only (D39)
  activity.ts           PURE weekly Move minutes + Strength days vs WHO 2020 targets (D33)
  burn.ts               PURE burn maths (Compendium MET, ACSM walk/run, minus Mifflin resting burn)
  exercises.ts          exercise/activity catalog, filters, search, setsSummary, lazy how-to steps
  gym/                  D30 check-in: config (thresholds), visits + verify (pure: Haversine, judge), location (browser permission/reading), schema (Zod, both sides), api (fetch + skew + offline flush), actions, gyms (currentGym: newest, never gyms[0]), places (search contract, Zod) + placesApi
  admin/                admin client (D51): api.ts (fetch, 60 s cache, useIsAdmin, CSV/JSON download), types.ts, userModel.ts (member data through the app's own streak/PR rules)
  social/               Akhada client: api.ts (typed RPCs + failText), state.ts (profile store + social_sync on open, useRemote cache, avatars, resume after sign-in, trophy cache for badges)
  akhadaShare.ts        result / duel share cards (canvas, reuses wrappedShare helpers)
  wrapped.ts            PURE Weekly Wrapped (D42): week maths, stats, persona; useWrapped.ts feeds it; wrappedShare.ts draws the share image
  greet.ts              PURE greeting picker (D31): moments, fits, pickGreeting, greetParts
  useWorkouts.ts        usePerson (body weight for a day), useDayWorkouts, lastTime, useFitnessStreaks (workout + global)
  auth.ts               useAuth, initAuth, signInWithGoogle, signOut, adoptLocalData
  sync/engine.ts        push → pull loop; sync/rows.ts PURE row mapping + merge rules
  supabase.ts           lazy browser client; supabaseEnabled = env keys present
  dates.ts              local-time YYYY-MM-DD keys (never UTC: late-night IST logs)
  useTokens.ts, useMediaQuery.ts (useIsDesktop), app.ts (APP_NAME, TAGLINE)
  nl/                   natural-language logging: match, units, schema, prompt, request, ranking, workoutMatch, workoutDraft (PURE, node-runnable)
                        + client.ts, corrections.ts, useSpeech.ts (browser)
src/server/             server-only: env (Zod), supabase-admin (service role), auth (getClaims), nl/{llm,cache,quota}, places/{provider,geoapify,cache}, rate (generic per-user limit: `consume_api_rate`), admin/{auth,user} (D51)
src/app/api/food/parse/ the parse route
src/data/foods.generated.json   BUILT catalog; never edit by hand (+ food-prefer.generated.json)
src/data/exercises.generated.json, exercise-steps.generated.json   BUILT by `npm run exercises`; never edit by hand
src/data/greetings.generated.json   BUILT by `npm run greetings` from data/greetings/*.json (greetings.md)
data/aliases.json       reviewed search names (add / remove / prefer) merged into the catalog
evals/nl-parse.jsonl    60 parsing cases for `npm run eval:parse`
data/foods.json, data/foods-extra.json   food sources (see data.md)
data/exercises.json, exercises-extra.json, burn-model.json, free-exercise-db.json   workout sources (see workouts.md)
public/exercises/<id>-0|1.webp   exercise photos (scripts/import-exercise-db.mjs)
scripts/ build-foods.mjs, import-extra.mjs, build-exercises.mjs, import-exercise-db.mjs, supabase.sh, load-env.mjs
supabase/ config.toml (minimal on purpose), migrations/*.sql
```

## Data flow

```
data/foods.json ─┐
data/foods-extra.json ─┴─ npm run foods ─→ src/data/foods.generated.json ─→ lib/foods.ts (FOODS, search)
                                                                          ↑ + customFoods registered from the store

UI action → useStore action ─→ state (entries, goals, weights, water, customFoods, savedMeals)
                           └─→ sync queue (dirty*/deleted* ids)  ─→ localStorage "ct-v1"
                                        │ (signed in) debounce 1.5 s / focus / online / sign-in
                                        ▼
                         sync/engine: push queue → Supabase tables → pull rows updated since lastPulledAt → merge
```

### Store (`lib/store.ts`)
- `useStore` persisted fields: `entries, goals, profile, weights, water, customFoods, savedMeals, sync, guest` (see `partialize`).
- Saved through `lib/localSave.ts` (`batchedStorage`), not zustand's default: see "Local storage" below.
- `skipHydration: true`; `AppShell` calls `hydrateStore()` then `initAuth()`. Pages render skeletons until `hydrated` (so SSR HTML and the first client render match).
- `merge` fills missing queue fields from `EMPTY_QUEUE` (old saves lack newer fields).
- Entries **snapshot** nutrition at log time (D05); editing foods/thalis never rewrites history.
- `useUI` (not persisted): selected `date` (null = today), `sheet` (`add` | `edit` | `thali`), `toast`, `fresh` (entry ids to glow once).

### Sync (`lib/sync`, `lib/auth.ts`, D18)
- Tables: `food_logs`, `user_goals` (+ `profile`, `fitness` jsonb), `weights`, `water`, `custom_foods` (jsonb), `saved_meals` (jsonb), `workouts` (jsonb), `routines` (jsonb), `measurements` (jsonb, D39), `user_gyms` (columns). **Read-only on the device:** `gym_visits` (pulled, never pushed; written by `/api/gym/*` through Postgres functions), `gym_events` (server only). Device-only gym visits (offline/guest) upload through `flushGym()` inside the sync run. All have RLS `user_id = auth.uid()`, `updated_at` trigger, soft delete via `deleted_at`.
- Push upserts dirty rows, soft-deletes deleted ids, then clears only what it pushed (edits made mid-push stay queued).
- Pull fetches rows with `updated_at > lastPulledAt` (paged by 1000) and merges: server wins, **except** ids with unpushed local changes.
- Sign-in: `adoptLocalData` pushes guest data into the account (goals only if edited as guest). Another user's leftover data is wiped first. Sign-out: sync, `signOut`, `resetLocal()`.
- `supabaseEnabled` false (no env keys) → app runs local-only, no login gate.

### Food catalog (`scripts/build-foods.mjs`, D13/D16)
- Merges both data files; fails on duplicate ids or null kcal.
- Maps unit ids to canonical `kind` (katori, bowl, plate, piece, glass, cup, tbsp, tsp, handful, pack, scoop, g). The kind drives the portion art and quantity steps (`qtyOptions`).
- Adds a `g` unit to every food; drops INDB recipe-yield units; excludes known-bad rows (`EXCLUDE`).
- Flags `fried` (deep-fried and ≥400 kcal/100 g → "~" + high-estimate note) and `uncooked` (raw grain/dal/flour/egg; ranked lower, tagged).
- Search (`lib/foods.ts`): token prefix/word/alias/compact matching, +25 when the query matches the category label, +40 on an exact alias/name hit, +15 for staples (`STARTER_IDS`), +20 for your own foods, −30 for uncooked.

### Theming (D08, D20)
- Tokens: `--color-bg/surface/surface-2/surface-3/line/line-strong/text/muted/faint`, spices `turmeric` (carbs) `saffron` (fat) `chilli` (protein/over) `leaf` (on target) `sky` (water) `jamun` (workouts / burn) `brass`, plus `cream` (selected pills; **inverts** in light mode) and `on-accent` (text on turmeric→saffron gradient buttons). `--ink` = RGB triplet for hairlines/glows: `rgb(var(--ink) / 0.1)`.
- Light theme = `prefers-color-scheme` unless `localStorage["prana-theme"]` is `light`/`dark` (set in Me → Appearance, applied by the inline script in `layout.tsx` via `data-theme` on `<html>`).

### Layout (D17)
Phone < 768: bottom pill nav + round +, bottom sheet. `md`: wider single column, meals 2-up. `lg` ≥ 1024: left sidebar (`Sidebar`), sheets become centred modals (`Sheet.tsx`: `useIsDesktop` → `modal-pop` class, `handleOnly`; the workout picker is two-pane); Today stays one column (the sidebar leaves ~690 px). `xl` ≥ 1280 Today (D32): left = week strip, add bar, ring card (sticky); right = chai · water · burned tiles (`QuickRow` is `xl:contents`, `BurnCard` has a tile variant) + one meals list. Meal cards never stretch to their neighbour's height (`items-start`).

### Local storage (D50)
- Everything the store persists is **one localStorage key, `ct-v1`**, rewritten whole on each save (zustand persist stringifies all of it). Progress photos are the exception (IndexedDB, `lib/photos.ts`); other keys (theme, greeting history, seen badges, trophies, Supabase session) are a few KB.
- **Measured (Chrome 153, 2026-09-27):** limit ~5.24 M characters per site (Devanagari counts the same); one food entry ≈ 294 characters, one 4-set lift ≈ 380; a typical user ≈ 1.4–1.5 M characters a year → full after ~3.5 years (heavy ~2 years). One save: 2 / 5 / 7 ms on a Mac at 1 / 2 / 3 years, 14 / 28 / 51 ms with the CPU throttled 6× (budget Android).
- **`batchedStorage`:** keeps the latest state and writes at most every 500 ms (`WRITE_EVERY_MS`), and at once on `visibilitychange` → hidden and `pagehide`; `flushSaves()` forces it. A failed write (QuotaExceededError, blocked storage) is caught, sets `useSaveHealth` and the next change retries; nothing is thrown into tap handlers. `StorageNotice` (in AppShell) shows the banner + a one-time toast. After the first good write, `navigator.storage.persist()` is asked once (skipped in Firefox, which shows a prompt).
- **Safari:** deletes a site's script-writable storage (localStorage, IndexedDB…) after 7 days of Safari use without visiting it; home-screen web apps count their own days ([WebKit](https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/)). Signed-in users get everything back from Supabase; guests don't, hence the iPhone hint.
- **Planned:** per-record IndexedDB (future.md).

## Checklists

**Add a synced entity** (as done for `custom_foods`, `saved_meals`):
1. `npx supabase migration new <name>` → table with `id text pk`, `user_id default auth.uid()`, `data jsonb` (or columns), `updated_at`, `deleted_at`, RLS policy "own rows", `touch` trigger → `npm run db:push`.
2. `types.ts` type → `store.ts`: field in `Data` + `INITIAL`, queue lists in `SyncQueue` + `EMPTY_QUEUE`, actions that add ids to `dirty*`/`deleted*`, add to `partialize`, count in `pendingCount`.
3. `auth.ts adoptLocalData`: mark existing items dirty.
4. `sync/engine.ts`: push (upsert + soft delete + clear pushed ids) and pull (`fetchSince` + `mergeDocs`, include rows in `maxUpdated`).

**Add foods:** add to `scripts/import-extra.mjs` (INDB code / USDA fdcId / DERIVED recipe / MFR_LABEL with URL), run it with `INDB.xlsx` (download: `github.com/lindsayjaacks/Indian-Nutrient-Databank-INDB-/raw/main/INDB.xlsx`), then `npm run foods`. Check the macro sum (4P+4C+9F within ~15% of kcal) and the default serving. Brand labels: official site → Shopify `…/products/<handle>.json` → nutrition-facts image → read the image. New category → `Category` type, `CATEGORY_LABEL`, `FoodIcon` `HUE` + `ART`, `CreateFood` `KINDS`.

**Change the NL prompt, model or aliases:** edit `src/lib/nl/prompt.ts` (bump `PROMPT_VERSION`), `NL_MODEL`, or `data/aliases.json` (+ `npm run foods`) → `npm run eval:parse` must pass → add a case to `evals/nl-parse.jsonl` for any real miss.

**Add exercises:** add to `data/exercises.json` (free-exercise-db id, aliases, group) or `data/exercises-extra.json` (no photo), run `node scripts/import-exercise-db.mjs` for new photos (needs `cwebp`), then `npm run exercises`. Burn class = `metFor` in `scripts/build-exercises.mjs`; METs are looked up by Compendium code in `data/burn-model.json` (never typed in). New cardio option → `OPTIONS` there.

**Add greetings:** save the browser-Claude batch as `data/greetings/batch-N.json` (prompt in greetings.md) → `npm run greetings` → read the lines once for tone.

**Add a screen/feature:** phone and desktop layouts, dark and light theme, skeleton while `!hydrated`, the store as the only data path, docs updated.

## Gotchas (all hit once already)

- **Zustand v5 selectors must not return new arrays/objects** (`s.entries.filter(...)`) → infinite render loop. Select raw state, then `useMemo`.
- **React Compiler lint rules** (`eslint-config-next`): no `Date.now()`/impure calls during render, no synchronous `setState` in effects (defer with a timeout), no reading refs during render.
- **SVG presentation attributes can't use `var()`** → use `style={{ fill: "var(--color-x)" }}`. Recharts props: CSS overrides in `globals.css` or `useTokens()`.
- **Multiple SVGs on one page need unique gradient/clip ids** → `useId()` (a hidden duplicate once broke the katori on login).
- **vaul:** give every sheet exactly one `Drawer.Title` (embedded panes skip theirs); add `data-vaul-no-drag` to anything draggable inside a sheet; keep `after:hidden`. The desktop modal animation overrides vaul's keyframes with `!important` (`.modal-pop` in globals.css) because vaul injects its CSS at runtime, after ours.
- **Leaflet**: its CSS loads after ours, so override with doubled classes (`.leaflet-marker-icon.gym-pin`); SVG paths are styled by `className` (vars can't go in attributes); call `invalidateSize()` after a sheet animates in; mark the map `data-vaul-no-drag`.
- **Location**: never call `getCurrentPosition` on load or when the app setting is off; `navigator.permissions` can throw (wrap it); test with puppeteer `overridePermissions` + `setGeolocation`.
- **CSS grid tracks size to their content by default:** a sideways-scrolling row inside a `grid` item stretches the page. Use `grid-cols-1` (= `minmax(0,1fr)`) on single-column grids.
- **Full-page puppeteer screenshots can catch Recharts mid-animation** (the capture resizes the viewport). Check charts with a normal viewport screenshot.
- **Horizontal chip rows** scroll on phones but must wrap on desktop (`lg:flex-wrap`): sideways scrolling is awkward with a mouse.
- **Next 16:** `LayoutProps`/`RouteContext` types come from `npx next typegen`; deleting a route leaves stale `.next/types` until typegen/build runs. Middleware is now `proxy.ts` (unused here).
- **`supabase/config.toml` is deliberately minimal.** The CLI template would overwrite unrelated dashboard settings (email confirmations, MFA…). Never `supabase init --force`; preview with `config diff`.
- **`.env` is parsed with Node's dotenv parser** (`scripts/load-env.mjs`), not the shell: the DB password contains `&`.
- **Writing `\u` escapes through Claude's tools turns them into literal characters.** Use Unicode property classes (`\p{L}`) instead of `\uXXXX` ranges in source.
- **Supabase queries are lazy:** `void supabase.rpc(...)` never sends anything. Fire-and-forget needs `.then(...)`.
- **Secrets:** never prefix with `NEXT_PUBLIC_` (a secret key was once misnamed like that). Server code imports `server-only`. After a build, scan `.next/static` for the actual secret *values* (the string `sb_secret_` appears legitimately inside supabase-js).
- **Migrations before clients:** new client code that sends a new column must ship after the migration is pushed, or sync upserts fail.
- **Node-runnable TS modules** (`src/lib/nl/*` pure files, `sync/rows.ts`, `streaks.ts`) use relative imports with `.ts` extensions (`allowImportingTsExtensions` is on) and no `@/` aliases, so tests/evals can import them with plain `node`.
- **Chrome exposes unprefixed `SpeechRecognition`** as well as `webkitSpeechRecognition`; tests that fake it must replace both.
- **Toasts sit above sheets**, and a tap outside a sheet closes it: a toast over a sheet's lower part eats taps (and closes the sheet) for its 4.5 s. Browser tests wait for it to clear.
- **Esc closes a vaul sheet from a capture listener** (Radix), so an input's `stopPropagation` is too late. A field that clears itself on Esc sets `data-escape-clears` (only while it has something to clear); `Sheet.tsx` then keeps the sheet open.
- **Headless Chrome paints sheets late:** a screenshot within ~2 s of opening one can show only the Leaflet map on black. Wait ~2.5 s before screenshots (the DOM is already there for assertions).
- **RLS without an update policy doesn't error:** a user's UPDATE just matches 0 rows. Test that nothing changed, not that it failed.
- **NULL in PL/pgSQL IF checks:** `if not (a or p_code = c.join_code)` is NULL (so skipped) when `p_code` is null. Wrap access checks in `coalesce(…, false)`; this once let anyone join invite-only challenges (caught by the SQL tests).
- **`full` is a reserved word** in Postgres: not usable as a parameter name.
- **Name filters vs Indian names:** plain substring bans hit Shital, Nazia, Gandhi, Chodankar; keep the banned list in `social_banned_terms` free of such collisions and test real names.
- **Devanagari + letter-spacing:** tracking splits conjuncts (अखाड़ा → अ खा ड़ा). Hindi text never gets `tracking-*` or `uppercase`.
- **A store update now saves up to 500 ms later** (batched). Tests that read `localStorage["ct-v1"]` right after an action must wait ~600 ms or hide the page first; seeding `ct-v1` before load is unchanged.
- **Stale local servers:** a previous `next start` on the same port serves old chunk hashes (500s). Kill the port before restarting.

## Verifying changes

1. `npx tsc --noEmit && npm run lint && npm run build`.
2. Pure logic (merge rules, streaks): Node runs TS directly, e.g. `node test.mts` importing `src/lib/streaks.ts` (no alias imports in those files).
3. UI: `PORT=3100 npm run start`, then drive it with **puppeteer-core** + the installed Chrome (`/Applications/Google Chrome.app/…`), keeping scripts in the session scratchpad. Take screenshots at 390×844 (phone) and 1440×900 (desktop), in both themes, then look at them.
   - Seed data before load: `localStorage.setItem("ct-v1", JSON.stringify({ state: { guest: true, entries: [...] }, version: 1 }))` (`guest: true` skips the login gate).
   - Theme: `localStorage["prana-theme"] = "light"`.
   - Watch `pageerror`/console errors.
4. SQL (migrations, security-definer functions): replay every migration on **PGlite** in the scratchpad (`npm i @electric-sql/pglite` there, not in the project) with a stub `auth` schema (`auth.users`, `auth.uid()` from `request.jwt.claim.sub`) and the roles `anon` / `authenticated` / `service_role`; run calls with `set role authenticated` + the claim so RLS applies. For UI tests, answer the app's Supabase RPC requests from PGlite in puppeteer's request interception (with CORS headers + OPTIONS). See social.md "Tests".
