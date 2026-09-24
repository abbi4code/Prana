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
  api/gym/              check-in, check-out, active (D30): sign-in required, server-written visits
  progress/page.tsx     Prana (global) + food streak cards, year heatmap (food/workout/both), weight, 14-day calories
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
  today/                AddBar ("Add anything" + mic, D29), CalorieRing, MacroBars, DateStrip (+streak flame), QuickRow (chai/water), MealCard (swipe rows), BurnCard
  workout/              WorkoutSheet (library, LiftDetail, CardioDetail), WorkoutList (swipe rows), WorkoutCards (burn, streak, goals), ExercisePhoto
  progress/             StreakCard + PranaStreakCard, YearHeatmap
  account/              GoogleButton, AccountCard (+ SyncStatus, Avatar)
src/lib/
  types.ts              Food, FoodUnit, Entry, Goals, Profile, SavedMeal, ThaliItem, Category, UnitKind
  foods.ts              catalog (static JSON) + custom-food registry + Hinglish search/ranking
  nutrition.ts          portion maths, MEALS, qtyOptions per unit kind, Mifflin–St Jeor goals
  store.ts              useStore (persisted data + sync queue + actions) and useUI (sheet, date, toast, fresh ids)
  thali.ts              resolveItems / thaliTotals for saved meals
  streaks.ts            PURE streak rules (dayStatus, runStreak engine with rest days, workoutDay, globalDay); useStreaks.ts wraps the food one
  burn.ts               PURE burn maths (Compendium MET, ACSM walk/run, minus Mifflin resting burn)
  exercises.ts          exercise/activity catalog, filters, search, setsSummary, lazy how-to steps
  gym/                  D30 check-in: config (thresholds), visits + verify (pure: Haversine, judge), location (browser permission/reading), schema (Zod, both sides), api (fetch + skew + offline flush), actions
  useWorkouts.ts        usePerson (body weight for a day), useDayWorkouts, lastTime, useFitnessStreaks (workout + global)
  auth.ts               useAuth, initAuth, signInWithGoogle, signOut, adoptLocalData
  sync/engine.ts        push → pull loop; sync/rows.ts PURE row mapping + merge rules
  supabase.ts           lazy browser client; supabaseEnabled = env keys present
  dates.ts              local-time YYYY-MM-DD keys (never UTC: late-night IST logs)
  useTokens.ts, useMediaQuery.ts (useIsDesktop), app.ts (APP_NAME, TAGLINE)
  nl/                   natural-language logging: match, units, schema, prompt, request, ranking, workoutMatch, workoutDraft (PURE, node-runnable)
                        + client.ts, corrections.ts, useSpeech.ts (browser)
src/server/             server-only: env (Zod), supabase-admin (service role), auth (getClaims), nl/{llm,cache,quota}
src/app/api/food/parse/ the parse route
src/data/foods.generated.json   BUILT catalog; never edit by hand (+ food-prefer.generated.json)
src/data/exercises.generated.json, exercise-steps.generated.json   BUILT by `npm run exercises`; never edit by hand
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
- `skipHydration: true`; `AppShell` calls `hydrateStore()` then `initAuth()`. Pages render skeletons until `hydrated` (so SSR HTML and the first client render match).
- `merge` fills missing queue fields from `EMPTY_QUEUE` (old saves lack newer fields).
- Entries **snapshot** nutrition at log time (D05); editing foods/thalis never rewrites history.
- `useUI` (not persisted): selected `date` (null = today), `sheet` (`add` | `edit` | `thali`), `toast`, `fresh` (entry ids to glow once).

### Sync (`lib/sync`, `lib/auth.ts`, D18)
- Tables: `food_logs`, `user_goals` (+ `profile`, `fitness` jsonb), `weights`, `water`, `custom_foods` (jsonb), `saved_meals` (jsonb), `workouts` (jsonb), `user_gyms` (columns). **Read-only on the device:** `gym_visits` (pulled, never pushed; written by `/api/gym/*` through Postgres functions), `gym_events` (server only). Device-only gym visits (offline/guest) upload through `flushGym()` inside the sync run. All have RLS `user_id = auth.uid()`, `updated_at` trigger, soft delete via `deleted_at`.
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
Phone < 768: bottom pill nav + round +, bottom sheet. `md`: wider single column, meals 2-up. `lg` ≥ 1024: left sidebar (`Sidebar`), Today = sticky summary column + meals column, sheets become centred modals (`Sheet.tsx`: `useIsDesktop` → `modal-pop` class, `handleOnly`; the workout picker is two-pane). `xl`: meals 2×2.

## Checklists

**Add a synced entity** (as done for `custom_foods`, `saved_meals`):
1. `npx supabase migration new <name>` → table with `id text pk`, `user_id default auth.uid()`, `data jsonb` (or columns), `updated_at`, `deleted_at`, RLS policy "own rows", `touch` trigger → `npm run db:push`.
2. `types.ts` type → `store.ts`: field in `Data` + `INITIAL`, queue lists in `SyncQueue` + `EMPTY_QUEUE`, actions that add ids to `dirty*`/`deleted*`, add to `partialize`, count in `pendingCount`.
3. `auth.ts adoptLocalData`: mark existing items dirty.
4. `sync/engine.ts`: push (upsert + soft delete + clear pushed ids) and pull (`fetchSince` + `mergeDocs`, include rows in `maxUpdated`).

**Add foods:** add to `scripts/import-extra.mjs` (INDB code / USDA fdcId / DERIVED recipe / MFR_LABEL with URL), run it with `INDB.xlsx` (download: `github.com/lindsayjaacks/Indian-Nutrient-Databank-INDB-/raw/main/INDB.xlsx`), then `npm run foods`. Check the macro sum (4P+4C+9F within ~15% of kcal) and the default serving. Brand labels: official site → Shopify `…/products/<handle>.json` → nutrition-facts image → read the image. New category → `Category` type, `CATEGORY_LABEL`, `FoodIcon` `HUE` + `ART`, `CreateFood` `KINDS`.

**Change the NL prompt, model or aliases:** edit `src/lib/nl/prompt.ts` (bump `PROMPT_VERSION`), `NL_MODEL`, or `data/aliases.json` (+ `npm run foods`) → `npm run eval:parse` must pass → add a case to `evals/nl-parse.jsonl` for any real miss.

**Add exercises:** add to `data/exercises.json` (free-exercise-db id, aliases, group) or `data/exercises-extra.json` (no photo), run `node scripts/import-exercise-db.mjs` for new photos (needs `cwebp`), then `npm run exercises`. Burn class = `metFor` in `scripts/build-exercises.mjs`; METs are looked up by Compendium code in `data/burn-model.json` (never typed in). New cardio option → `OPTIONS` there.

**Add a screen/feature:** phone and desktop layouts, dark and light theme, skeleton while `!hydrated`, the store as the only data path, docs updated.

## Gotchas (all hit once already)

- **Zustand v5 selectors must not return new arrays/objects** (`s.entries.filter(...)`) → infinite render loop. Select raw state, then `useMemo`.
- **React Compiler lint rules** (`eslint-config-next`): no `Date.now()`/impure calls during render, no synchronous `setState` in effects (defer with a timeout), no reading refs during render.
- **SVG presentation attributes can't use `var()`** → use `style={{ fill: "var(--color-x)" }}`. Recharts props: CSS overrides in `globals.css` or `useTokens()`.
- **Multiple SVGs on one page need unique gradient/clip ids** → `useId()` (a hidden duplicate once broke the katori on login).
- **vaul:** give every sheet exactly one `Drawer.Title` (embedded panes skip theirs); add `data-vaul-no-drag` to anything draggable inside a sheet; keep `after:hidden`. The desktop modal animation overrides vaul's keyframes with `!important` (`.modal-pop` in globals.css) because vaul injects its CSS at runtime, after ours.
- **Leaflet**: its CSS loads after ours, so override with doubled classes (`.leaflet-marker-icon.gym-pin`); SVG paths are styled by `className` (vars can't go in attributes); call `invalidateSize()` after a sheet animates in; mark the map `data-vaul-no-drag`.
- **Location**: never call `getCurrentPosition` on load or when the app setting is off; `navigator.permissions` can throw (wrap it); test with puppeteer `overridePermissions` + `setGeolocation`.
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
- **Stale local servers:** a previous `next start` on the same port serves old chunk hashes (500s). Kill the port before restarting.

## Verifying changes

1. `npx tsc --noEmit && npm run lint && npm run build`.
2. Pure logic (merge rules, streaks): Node runs TS directly, e.g. `node test.mts` importing `src/lib/streaks.ts` (no alias imports in those files).
3. UI: `PORT=3100 npm run start`, then drive it with **puppeteer-core** + the installed Chrome (`/Applications/Google Chrome.app/…`), keeping scripts in the session scratchpad. Take screenshots at 390×844 (phone) and 1440×900 (desktop), in both themes, then look at them.
   - Seed data before load: `localStorage.setItem("ct-v1", JSON.stringify({ state: { guest: true, entries: [...] }, version: 1 }))` (`guest: true` skips the login gate).
   - Theme: `localStorage["prana-theme"] = "light"`.
   - Watch `pageerror`/console errors.
