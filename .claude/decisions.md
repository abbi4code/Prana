# Global Decisions

Status: **Decided** = agreed, build on it. **Proposed** = suggested, waiting for confirmation.
When something changes, mark the old entry **Superseded by Dxx** instead of deleting it.

## Summary

| ID | Decision | Status | Date |
|---|---|---|---|
| D01 | Next.js + Supabase stack | Decided | 2026-09-24 |
| D02 | Phone app = PWA, no native app | Decided (SW detail superseded by D15) | 2026-09-24 |
| D03 | Food data from INDB + IFCT 2017 only | Decided | 2026-09-24 |
| D04 | Nutrients per 100 g; unit weights per food | Decided (foods table superseded by D13) | 2026-09-24 |
| D05 | Log entries snapshot grams + kcal | Decided | 2026-09-24 |
| D06 | Standard household unit sizes | Decided | 2026-09-24 |
| D07 | Canonical unit names (normalize dataset) | Decided (built) | 2026-09-24 |
| D08 | Visual identity "Modern Masala" | Built (dark + light, D20); owner asked for more polish | 2026-09-24 |
| D09 | UX rules (≤3 taps to log, etc.) | Decided | 2026-09-24 |
| D10 | Meal slots incl. "Chai & Snacks" | Built; awaiting owner's sign-off | 2026-09-24 |
| D11 | One consistent illustration style for food images | Proposed | 2026-09-24 |
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

## D10 — Meal slots (Proposed)
Breakfast · Lunch · **Chai & Snacks** · Dinner.
**Why:** evening chai + snack is a real meal in Indian routines and a big source of unlogged calories.

## D11 — Food images (Proposed)
One consistent illustration style for every food (generated from each food's `image_prompt`), stored in Supabase Storage.
**Why:** stock photos of Indian dishes are patchy and don't match each other.

## D13 — Food catalog ships with the app
`data/foods.json` (research output) → `npm run foods` → `src/data/foods.generated.json` (~100 KB, ~20 KB gzipped), imported by the app.
**Why:** instant search with no network round-trip, works fully offline, no DB seeding step. Supersedes the `foods` table in D04; `food_logs.food_id` stores the catalog id. User-created foods will get a DB table later.

## D14 — Local-first data
All logs, goals, weights and water are stored on the device (zustand + localStorage, key `ct-v1`), so logging works offline and is instant. Supabase (schema in `supabase/migrations/0001_init.sql`) will sync it across devices once login is added: rows have `updated_at` / `deleted_at` for last-write-wins sync.

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
| Desktop (`lg`, 1024+) | Left sidebar with "Log food" button | Sticky summary column (ring, macros, chai/water) + meals column | Side panel from the right, search autofocused |
| Wide (`xl`, 1280+) | Sidebar | Meals in a 2×2 grid | Side panel |

Progress and Me become two-column on desktop. Desktop extras: hover states, pointer cursors, keyboard shortcut **N** or **/** to log food. `useIsDesktop()` (`src/lib/useMediaQuery.ts`) switches the drawer direction.

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

## D12 — Project docs
Decisions, features, future changes and data notes live as separate md files in `.claude/`, indexed in [CLAUDE.md](CLAUDE.md).
