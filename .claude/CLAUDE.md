# Calorie Tracker (working name TBD)

Personal calorie & fitness tracker for Indian food: website + installable phone app (PWA).
Logs food in Indian household measures (katori, roti, plate) as well as grams.

## Project docs (read before making changes)

| File | What's in it |
|---|---|
| [decisions.md](decisions.md) | Global decisions: stack, data model, units, design direction, UX rules |
| [features.md](features.md) | Feature list by phase, with status |
| [future.md](future.md) | Backlog, future changes, open questions |
| [data.md](data.md) | Food dataset (`foods.json`): sources, rules, review results, known gaps |
| [setup-auth.md](setup-auth.md) | Step-by-step Supabase + Google sign-in setup (owner's dashboard work) |

## Code map

| Path | What |
|---|---|
| `src/app/` | Pages: `/` Today, `/progress`, `/me`; `manifest.ts`, icons |
| `src/components/log/` | Log sheet: search, food detail, katori/glass/piece visual |
| `src/components/today/` | Calorie ring, macro bars, date strip, chai/water, meal cards |
| `src/lib/store.ts` | All user data (zustand, persisted to localStorage `ct-v1`) + UI state |
| `src/lib/foods.ts` | Catalog access + Hinglish search |
| `src/lib/nutrition.ts` | Portion maths, meal slots, goal suggestion |
| `src/components/Sidebar.tsx` / `BottomNav.tsx` | Desktop / phone navigation (see D17) |
| `src/components/FoodIcon.tsx` | Category illustrations (inline SVG) |
| `src/components/log/CreateFood.tsx` | Create-your-own-food form (D21) |
| `src/components/RollingNumber.tsx`, `Burst.tsx`, `Toaster.tsx` | Odometer digits, goal celebrations, undo toasts (D23) |
| `src/lib/useTokens.ts` | Theme colours for SVG/Recharts (D20) |
| `scripts/import-extra.mjs` | Builds `data/foods-extra.json` from INDB/USDA/derived (D22) |
| `src/components/thali/`, `src/lib/thali.ts` | Thali plate art, builder, saved-meal helpers (D25) |
| `src/lib/streaks.ts`, `useStreaks.ts`, `src/components/progress/` | Streak rules, streak card, year heatmap (D24) |
| `scripts/build-foods.mjs` | `data/foods.json` → `src/data/foods.generated.json` (`npm run foods`) |
| `src/lib/supabase.ts` | Browser Supabase client (PKCE); `supabaseEnabled` is false without env keys |
| `src/lib/auth.ts` | Auth state, Google sign-in/out, attaching local data to the account |
| `src/lib/sync/` | `engine.ts` push/pull loop; `rows.ts` pure row mapping + merge rules |
| `src/app/login`, `src/app/auth/callback` | Login screen, OAuth return page |
| `supabase/migrations/` | DB schema + RLS, pushed with `npm run db:push` |
| `supabase/config.toml` | Auth settings (site URL, redirect URLs, Google provider) pushed with `npm run auth:push` |
| `public/sw.js` | Service worker (offline) |

Commands: `npm run dev`, `npm run build`, `npm run foods` (after editing `data/foods.json`), `npm run lint`.
Supabase CLI (reads `.env` / `.env.local`, see `scripts/supabase.sh`): `npm run db:push` (migrations), `npm run auth:push` (auth config from `supabase/config.toml`), `npm run env:keys` (fills app keys).
New DB change → `npx supabase migration new <name>`, write SQL, `npm run db:push`. Never edit an already-pushed migration.

## Working rules

- One md file per topic in `.claude/`. When a new topic comes up, add a new file and list it in the table above.
- When a decision is made or changed, update `decisions.md` in the same session (add a dated row; don't silently rewrite history — mark old ones as superseded).
- Items marked **Proposed** are suggestions awaiting the owner's confirmation. Don't treat them as final.
- Never invent calorie/nutrient numbers. Every value must trace to a source listed in `data.md`.
