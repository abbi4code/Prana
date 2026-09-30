# Admin panel (D51)

Status: **built 2026-09-27**. Migration `20260927130000_admin` **not pushed yet** (push it with the Akhada ones; its social tab reads their tables). Needs `ADMIN_EMAILS` on the host.

## What the owner asked for
"An admin panel where admin can see each user, what they are eating, doing workout, everything, on different charts and graphs; keep the UI cool like we already have; understand the schema; build it in a better way, I might forget to include something."

## Access and privacy (how it's locked)
- **Who is an admin is decided on the server only:** `ADMIN_EMAILS` (comma-separated, server env, never `NEXT_PUBLIC_`, never in the public repo), and only for **Google** sign-ins (`app_metadata.provider = google`), so an email/password sign-up using the same address can't pass. `src/server/admin/auth.ts` (`checkAdmin`, `requireAdmin`).
- **Reads go through the service role**, in `/api/admin/*` routes. The heavy numbers come from Postgres functions (`admin_growth`, `admin_food`, `admin_training`, `admin_system`, `admin_social`, `admin_users`, `admin_resolve_report`, helpers `admin_act`, `admin_from`) that are **revoked from public/anon/authenticated and granted only to `service_role`**. A user's own token can reach none of it (PGlite test: every function + the audit table deny `authenticated` and `anon`).
- **Access log:** opening or exporting a member (`view_user`, `export_user`) and resolving a report (`resolve_report`) insert a row in `admin_audit` (RLS on, no policies). Shown in System → "Admin access log".
- **Read-only**, except resolving Akhada reports. No editing or deleting members' logs from here.
- Never visible anywhere: progress photos (device only, D39), exact gym coordinates of a check-in (never stored, D30), guest data (never leaves the phone).
- **Before real users:** the privacy policy must say admins can see logged data for support/safety (DPDP). The JSON export per member is there for data access requests.

## Screens
`/admin` (Sidebar "Admin" + Me → "Admin panel" card, both shown only after the server says yes; `AdminGate` guards the pages, the server guards the data). Range 7d / 30d / 90d / 1y for the stats tabs; refresh button clears the 60 s cache.

| Tab | What |
|---|---|
| Overview | Members (+new vs last period), active, DAU/WAU/MAU + stickiness, things logged; active members vs sign-ups chart; come-back rate (next day / first week / week 4); food vs workouts per day; **when people log** (IST weekday × hour heatmap, busiest hour = reminder time); search / sentence / voice split; all-time totals |
| Users | Search (name, email, pasted user id), sort (last active, newest, most logs, name), 50 a page, activity dot (today / this week / quiet), food, workouts, days, goal + aim, @handle; **CSV export** (spreadsheet-formula safe) |
| Member `/admin/u/[id]` | Header (joined, last sign-in, last log, provider, @handle, open reports) + copy id + **Export data (JSON)**; range 30d/90d/1y/all; days logged, avg day vs goal + on-target %, workouts + gym visits (verified %), streaks (food / workout / Prana, current + best); calories vs goal (status colours, tap a bar → that day); profile & goals incl. BMR/maintenance (D45), burn goal, rest days, location consent; **their year** heatmap (food / workout); **day by day** (meals with portions, grams, time, source badge + the sentence typed/said, macros; workouts with sets or minutes, PR, at the gym / routine; water, weight, visits with verification); macros per day; burn + water; weight (7-day avg); top foods; top exercises; PRs; how they log + meals; gym (current + retired gyms, visits); own foods / thalis / routines; tape measurements; Akhada profile + reports + server active days; AI usage + their corrections |
| Food | Avg day vs avg goal (line), on-target / under / over (D24 rule; no goals row = the app's 2000 default), macros on an average day, items a day, water; top 20 foods (shared scale); meals; **catalog gaps** (custom foods grouped by name = what to add from a real source, data.md); goals & profiles (aims, sex, avg goal/age/weight); weigh-ins, thalis, tape measures, AI corrections |
| Requests (D54) | Missing foods, most wanted first ([food-requests.md](food-requests.md)): open / people asking / done / dismissed; per food: people, asked (tapped "Request it") · searched · AI · made own, last seen; closest catalog food from the app's matcher ("Looks like" + one-tap **Same as** at ≥ 85 %, "Closest in the catalog" hint only from 60 %); **Same as** (alias), **Dismiss** (junk), **Reopen**; filter Open / Done / Dismissed / All; **Research** (one food, ~30–90 s) and **Research top N** (the first 5 open rows without a suggestion, one after another), **Research again** on "no source" rows and on stuck "in review" rows (no candidate waiting); the AI's "same as" suggestion shows on the row with a Same as button; each run's result is written under the row. Every triage → `admin_audit` (`food_request`). Above it (phase 2): **Waiting for your check** (candidate cards: numbers, portions with kcal, source link, request, checker warnings, problems that block Approve; Approve for everyone / Reject with a reason; Waiting / Approved / Rejected) and **Added for everyone** (shared foods, Retract / Restore; audit `food_candidate`, `shared_food`). Label foods (phase 4): the label image (tap to zoom) beside a per-100 table Label | This food | ✓ / ≠, Read (paste a link) / Photo (upload, shrunk in the browser), Use the label's numbers, and the "I checked these numbers against the label" tick Approve waits for |
| Training | Workouts (lifts/cardio), training members + days, sets, cardio minutes, ~kcal; workouts per day; **sets by muscle group** (catalog lookup); top lifts (photos), cardio by minutes; gym check-ins (visits, counted 20+ min, avg length, checked in now, verified vs not per day, verification split, auto-closed = forgot Done, offline, failed location checks); setup & habits (gyms located / via search, consent, routines, from a routine, logged at the gym, burn goals) |
| Akhada | Members, friendships, challenges, open reports; **moderation queue** (reason, note, reporter, "hidden from board" = `social_hidden()`, open member, Resolve); server active days (+ GPS-verified), most active, challenge types + duels, latest challenges |
| System | AI requests, model calls (new cache rows), AI spend (≈ $0.0001 each, nl-logging.md), cache hit rate; AI per day; most repeated sentences; **what people corrected** (guess → confirmed, for `data/aliases.json` + evals); gym place searches per day; storage (DB size, biggest tables); admin access log |

## Files
| Path | Role |
|---|---|
| `supabase/migrations/20260927130000_admin.sql` | `admin_audit`, the `admin_*` functions, grants |
| `supabase/migrations/20260930110000_shared_foods.sql` | D54 phase 2: `food_candidates`, `shared_foods`, `catalog_updates`, `admin_food_review`, `admin_food_candidate_decide`, `admin_shared_food_set` |
| `src/server/foods/label.ts` + `supabase/migrations/20260930120000_candidate_labels.sql` | D54 phase 4: the label reader (vision copy → our arithmetic → comparison), `food_candidates.label` |
| `src/server/foods/{sources,verify,research}.ts` | D54 phase 3: INDB / IFCT / USDA on the server, the shared checker for one food, the OpenAI research agent |
| `src/server/foods/schema.ts` | the gate before a shared food goes live (Zod `Food` + macro / portion rules + not a catalog id) |
| `supabase/migrations/20260930100000_food_requests.sql` | D54: `food_requests`, `food_request_users`, `food_request_add` (app), `admin_food_requests` + `admin_food_request_set`, audit action `food_request` |
| `src/server/admin/auth.ts` | admin check, errors (`not_migrated` when a function/table is missing), `audit()` |
| `src/server/admin/user.ts` | one member's rows from every table (paged; missing tables = empty) |
| `src/app/api/admin/{me,stats,users,user,reports,food-requests,food-review,research}/route.ts` | the API (all need an admin; Zod query/body) |
| `src/lib/admin/{api,types,userModel}.ts` | client fetch + 60 s cache + in-flight dedupe, `useIsAdmin`, CSV/JSON download; response types; the member model (reuses `rows.ts`, `streaks.ts`, `records.ts`) |
| `src/components/admin/` | `ui.tsx` (Panel, Stat, Segmented, BarList, SplitBar, Ring, ChartTip…), `AdminGate`, `AdminLink` (sidebar + Me card), `Overview`, `UsersTab`, `FoodTab`, `TrainingTab`, `SocialTab`, `SystemTab`, `RequestsTab` + `FoodReview` (D54), `UserDetail`, `UserDay`, `Corrections` |
| `src/app/admin/page.tsx`, `src/app/admin/u/[id]/page.tsx` | pages |

## Set up (owner)
1. `npm run db:push` (pushes this with the other pending migrations).
2. Host env: `ADMIN_EMAILS=you@gmail.com` (comma-separate more). Local: same line in `.env`.
3. Sign in with that Google account → Sidebar "Admin" / Me → "Admin panel".

## Tests (2026-09-27, scratchpad)
- **SQL on PGlite**, every migration replayed with a stub `auth` schema: growth numbers (DAU, deleted logs excluded, new vs previous window, next-day/week-4 come-back), food (on/under/over incl. the default goal, custom foods grouped case/space-insensitively), training (sets, routine, gym verification, located gyms), system (parse usage, cache hits, corrections with email, storage), Akhada (reports, `hidden`, resolve twice), users (sort orders, paging, search incl. `%` `_` literal and by id), lockout for `authenticated` + `anon`, audit rows.
- **Chrome** (production build; `/api/admin/*` answered by the real SQL functions on PGlite with 12 seeded members, ~2,000 food logs, ~500 workouts): every tab, search → member, day arrows, resolve (DB 3 → 2), Me card; 1440×900 + 390×844, dark + light; no page errors, no sideways scroll on phones. Real routes: no token / forged token → 401.
- Not run against the hosted DB yet (migration not pushed).

## Later
- Charts of cohorts (retention by signup week), funnels (sign-up → first log → 7-day streak).
- Moderation actions beyond resolve (hide a name, suspend from the Akhada), with an audit reason.
- Account deletion flow (DPDP erasure) for members and from here.
