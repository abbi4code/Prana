# Gym check-in with location verification

Status: **All four phases built 2026-09-25** (check-in/out + timer + offline/guest fallback; location consent, permission flow, server verification; gym location via current location + Leaflet/OSM map, radius); nearby banner, lazy auto-close, 20-min minimum, visits count as workout days). Migrations `…130000_gym_checkin`, `…140000_location_consent`, `…150000_gym_autoclose` pushed. Remaining: owner's real-device tests; native geofencing later. Decision: **D30** in [decisions.md](decisions.md).
Part 1 is the owner's spec (kept as given). Part 2 maps it onto Prana and lists the conflicts. Part 3 lists the open questions.

---

## Part 1: The owner's spec

### About the project
- Prana is a calorie + fitness tracker (website + PWA). It has natural-language food logging and a gym section where users log sets × reps × weight. **This task is only the gym check-in feature.**
- Stack: Next.js + Supabase (Postgres, Auth, RLS). PWA + website only; no native app yet. Users: Indian, a mix of Android and iPhone.

### How to work
- Explain reasoning from first principles in simple language (the *why*, not just code).
- Inspect the existing codebase and schema first; reuse what exists (auth, user settings, API patterns). If something conflicts, say so and ask before changing it.
- Build in phase order. Ask before adding dependencies (especially map libraries or paid APIs), enabling Postgres extensions, or setting up cron jobs.

### The feature
Users save their gym's location once. At the gym they tap **"I'm at the gym"**; the app checks their location against the saved gym, starts a session and shows a live timer. When they leave they tap **"Done"**. Completed visits feed a visit counter and streak.

### Why it's manual
A website can't detect gym entry automatically: browser geolocation only works while the page is open and visible, not in service workers; there is no web geofencing API; this is deliberate (privacy, battery). So: **no background tracking, ever.** Location is read only when the user taps a button (or opens the app, see the nearby banner). Automatic check-in needs a native app with OS geofencing, a later phase; design so it can plug in without a rewrite.

### Core rules
1. **The server decides.** Client JS can be edited and location spoofed (DevTools can override it). The client sends coordinates + accuracy; the server computes distance and decides verification.
2. **Server timestamps** for `started_at` / `ended_at`.
3. **Store visits, not location trails.** Don't store raw check-in coordinates; store only `distance_m` and `accuracy_m`. The gym's own coordinates (user chose to save them) are fine.
4. **Two layers of consent:** (a) app setting "Use my location to verify gym check-ins" stored in our DB, can be turned off anytime; (b) the browser's permission. If (a) is off, never call the geolocation API.
5. **Never block the user.** Location denied / unavailable / inaccurate → allow the check-in anyway, marked `unverified`.

### Data model (suggested; adapt to the existing schema)
- **`user_gyms`**: id, user_id, name, lat, lng, radius_m (default 150), created_at, updated_at. Ask whether users can save more than one gym; design so multiple are possible.
- **`gym_visits`**: id, user_id, gym_id, started_at, ended_at (null while active), status (`active` | `completed` | `auto_closed`), start_verification, start_distance_m, start_accuracy_m, end_verification, end_distance_m, end_accuracy_m, source (`web_manual` now; `native_geofence` later), created_at. Verification values: `verified` | `outside_radius` | `low_accuracy` | `permission_denied` | `unavailable` | `not_checked`. **Only one active visit per user**, enforced by a partial unique index on `user_id` where `ended_at is null`. Duration = `ended_at - started_at`, computed, never stored as an editable value.
- **`gym_events`** (append-only): id, user_id, gym_id, type (`check_in` | `check_out` | `auto_close` | `check_in_attempt_failed`), occurred_at, verification, distance_m, accuracy_m, source, created_at. Visits are derived state; events are the raw truth (native geofence ENTER/EXIT will land here later; visits can be rebuilt from events).
- **User settings**: `location_consent` (bool), `location_consent_at`.
- **RLS**: users read and write only their own rows in all of these tables.

### Verification logic (server)
- Haversine in TypeScript (ask before enabling PostGIS).
- `accuracy_m` > 200 → `low_accuracy` (UI offers "Try again" / "Check in anyway"); `distance_m` <= `radius_m` → `verified`; otherwise `outside_radius`.
- Thresholds in one config file (default radius 150 m, accuracy cutoff 200 m, auto-close 3 h, minimum visit 20 min): starting defaults, not sourced constants.
- Rate-limit check-in/out per user. Check-in is idempotent: an active visit is returned, not duplicated.

### API routes (suggested)
`GET/POST /api/gyms`, `PATCH/DELETE /api/gyms/:id`; `POST /api/gym/check-in` `{ gymId, lat?, lng?, accuracy?, locationStatus }` → visit + verification; `POST /api/gym/check-out` (same shape); `GET /api/gym/active` → active visit or null + **server time** (for clock-skew correction); `POST /api/gym/nearby` `{ lat, lng, accuracy }` → near any saved gym? (creates nothing, stores nothing).

### Frontend
- **Saving the gym:** 1) "I'm at my gym right now, use my current location" (one high-accuracy reading); 2) pick on a map (ask first: Leaflet + OSM is free, Google Maps costs money); 3) search by gym name (needs a places API, later, ask first). Radius adjustable, e.g. 100–300 m.
- **Permission flow:** never prompt on page load. First tap on "I'm at the gym" shows our own explainer ("We use your location only to confirm you're at your gym. Nothing is tracked in the background. You can turn this off anytime."), then `getCurrentPosition()` after Continue. Check state with `navigator.permissions.query({ name: 'geolocation' })` in try/catch, falling back to just calling `getCurrentPosition`. Options `{ enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }`. Errors: 1 denied, 2 unavailable, 3 timeout, each with a clear message + "Check in without location". Denied: plain re-enable steps + unverified check-in.
- **iPhone:** every iOS browser is WebKit, so treat iPhone as one platform. iOS may re-ask for permission; never assume it's remembered. Chrome on iOS also needs iPhone Settings → Chrome → Location (mention in one line when it fails). Installed PWAs use Safari's location settings.
- **Active session:** live timer = `now - started_at`, `now` corrected with server time; correct after closing and reopening (stored timestamp, not a counter). "Done" checks out with one reading if consent is on (`end_verification`). On app open, fetch the active visit and restore the timer.
- **Nearby banner:** on app open / `visibilitychange`, only if consent is on and permission is already `granted`: one reading → `/api/gym/nearby` → "Looks like you're at [gym name]. Start workout?" one-tap check-in. Never when permission is `prompt`. Don't re-show for the same gym for a few hours after dismissal.
- **Auto-close:** still active after 3 h → `auto_closed` + `auto_close` event. ended_at choice: ask (started_at + default duration, or last app activity). Lazy close on the next API read, or pg_cron (ask before cron).
- **Streak/counter:** counts if `completed` or `auto_closed` and ≥ minimum duration. Unverified visits count, with a small "unverified" marker (ask if they should be treated differently). Day boundaries in the user's timezone (default IST).

### Relationship to workout logging
A visit = "was at the gym from X to Y"; a workout log = "did these sets × reps × kg". Logs may optionally reference `gym_visit_id`. **Never estimate calories from visit duration.**

### Build order
1. Gyms + plain check-in (no location): tables, RLS, check-in/out with `not_checked`, timer, one-active-visit constraint. The fallback forever.
2. Location verification: consent, explainer, permission handling, server Haversine, error states, iOS messaging.
3. Gym setup with current location, radius adjustment, then a map picker if approved.
4. Nearby banner, auto-close, streaks.
- Future (don't build, stay compatible): Expo `expo-location` geofencing + TaskManager sending ENTER/EXIT to `gym_events` (`source = native_geofence`); a session builder that merges flapping events (EXIT→ENTER within ~10 min), drops very short visits, dedupes repeats.

### Testing
DevTools → Sensors → Location for inside/outside. Before done: one real Android phone + one real iPhone (first-time permission, denied, inaccurate indoor reading, close mid-session and reopen, double-tap check-in). Unit tests for Haversine + verification rules (exact radius boundary, accuracy greater than the radius).

---

## Part 2: Mapping onto Prana (review, 2026-09-25)

### Already exists (reuse)
| Need | Existing |
|---|---|
| Auth on API routes | `src/server/auth.ts` `requestUser()` (verifies the Supabase JWT from `Authorization: Bearer`) |
| Server writes that bypass RLS | `src/server/supabase-admin.ts` (service role, server only) |
| Route pattern | `src/app/api/food/parse/route.ts` (nodejs runtime, `no-store`, Zod body, typed errors) |
| Per-user rate limit | `consume_parse_quota` Postgres fn + `parse_usage` table (atomic per-minute/day counters) → generalise |
| Server env validation | `src/server/env.ts` (Zod) |
| User settings | `user_goals` row (`profile`, `fitness` jsonb) synced via `goalsDirty` |
| Local-first data + sync | zustand store + sync queue + pull by `updated_at` (architecture.md) |
| Day keys in local time | `lib/dates.ts` `dayKey()` (device timezone, so IST for Indian users) |
| Streak engine | `runStreak()` with rest days, workout + global streaks (D27) |
| Workouts | `Workout` jsonb docs (can get an optional `visitId`) |

Nothing location-related exists yet (no geolocation, permissions or maps code).

### Conflicts and suggested changes
1. **RLS "read and write own rows" contradicts "the server decides".** If users can write `gym_visits`/`gym_events` directly, anyone can insert `verified`. Fix: users **select only** on visits/events; all writes go through API routes (service role). `user_gyms` stays user-writable.
2. **What "verified" can prove.** The browser supplies the coordinates, and the user places the gym point, so "verified" means "the phone reported a spot near the place you saved". Server-side checking still matters (the verdict can't be forged), but no further anti-cheat is worth building unless visits ever feed leaderboards/rewards.
3. **Local-first vs server-only check-in.** Every other action in Prana works offline; check-in as specified needs the network, and gyms (often basements) have poor signal. Needs a decision (Q9).
4. **Guest mode.** API routes need sign-in; guests currently use everything locally. Needs a decision (Q8).
5. **Streak count.** Prana already has food, workout and global streaks with user-picked rest days (D27). A fourth "visit streak" dilutes them. Suggest: no separate visit streak; a counted visit also makes that day a workout day; plus a visit counter/calendar (Q7).
6. **Nearby check can run on the device.** The gyms are the user's own data; comparing distance locally sends nothing anywhere, works offline and saves a request. The server check stays where a verdict is stored (check-in/out). Suggest dropping `/api/gym/nearby` (Q12).
7. **Verification rule edge.** With accuracy 180 m and distance 160 m (radius 150), the rule says `outside_radius`, but the phone could be inside. Suggest: `verified` if distance ≤ radius; `outside_radius` only if distance − accuracy > radius (surely outside); anything in between with accuracy > radius → `low_accuracy`. Unit-tested.
8. **Atomic check-in/out.** Do check-in/out/auto-close as Postgres functions (one transaction: lazy auto-close → insert visit on conflict do nothing → event), called from the route with the service role. Server `now()`, the partial unique index and idempotency all live in one place.
9. **Visits on the device.** Pull `gym_visits` read-only through the existing sync pull (never pushed), so the counter/streak/heatmap work offline; the active visit is also cached in the store so the timer survives a reload offline.
10. **Timezone:** streaks are computed on the device in local time already, so no server-side day logic is needed; the DB stores `timestamptz`.
11. **Consent storage:** `location_consent_at timestamptz` on `user_goals` (null = off) instead of a bool + timestamp; synced like fitness goals. Guests: local only.
12. **Nearby on iOS:** WebKit rarely keeps web location "granted" between sessions, so the banner will mostly appear on Android. For the banner use a cheaper reading (`maximumAge` of a few minutes, no high accuracy) to spare battery.

---

## Part 3: Open questions (owner)

| # | Question | Answer (owner, 2026-09-25) |
|---|---|---|
| Q1 | More than one gym per user? | **One gym**, editable. (Table stays multi-gym capable; the app allows one.) |
| Q2 | Map picker? | **Yes: map picker (Leaflet + OpenStreetMap) + "use my current location"**, "make the UI cool" |
| Q3 | Places search by gym name (paid API)? | Not now |
| Q4 | Auto-close `ended_at` | User ends with Done; a visit still open after **3 h** closes on the next app open, ending at the **last sign of activity** during the visit, else **start + 1:30** (owner's default), never past 3 h |
| Q5 | Lazy auto-close vs pg_cron | **Lazy** (on the next app open / API call) |
| Q6 | Unverified visits count? | **Yes**, with a small "unverified" tag |
| Q7 | Separate visit streak? | **No**: a counted visit makes the day a workout day; show a visit counter |
| Q8 | Guests (no account) | **Sign in for verified visits**; guests get the phone-only timer |
| Q9 | Offline at the gym | **Online by default**; offline fallback = saved on the device with the phone's time, marked unverified + offline, sent when back online |
| Q10 | Gyms: API CRUD or synced? | **Synced** like other data |
| Q11 | PostGIS | **No**: Haversine distance formula in TypeScript |
| Q12 | Nearby check | **On the phone** (no `/api/gym/nearby`); the server still verifies the actual check-in |

---

## Part 4: As built

### Phase 1 (2026-09-25)
- **Migration** `20260925130000_gym_checkin.sql`: `user_gyms` (user-owned, synced, lat/lng nullable until phase 3, radius 100–300), `gym_visits` (server-written; RLS **select only**; partial unique index = one active visit; status/ended_at consistency checks), `gym_events` (append-only via trigger; select only), `gym_rate` + `consume_gym_rate` (12/min, 120/day). Functions `gym_check_in` (idempotent: returns the active visit; offline uploads bring their own uuid + phone time, max 24 h old), `gym_check_out` (no active → `{visit:null}`), `gym_record_visit` (whole offline visit, ≤ 30 days old). All `security definer`, executable only by `service_role`.
- **API** (`src/app/api/gym/{check-in,check-out,active}`, helpers `src/server/gym/visits.ts`): sign-in required, Zod bodies (`src/lib/gym/schema.ts`), rate limit, every reply carries `serverNow`. Phase 1 always records `not_checked`.
- **Device**: `lib/gym/config.ts` (all thresholds), `visits.ts` (pure: active visit, finished visits, clock), `api.ts` (fetch + clock skew + `flushGym` for offline/guest uploads, run by the sync engine after push), `actions.ts` (checkIn/checkOut/refreshActive/initGym). Store: `gyms` (synced via `dirtyGyms`), `visits` (read-only copy pulled from `gym_visits`), `localVisits` (offline/guest), `pendingCheckout`, `useUI.clockSkew`. Workouts logged today during a visit get `visitId`.
- **Rules as built:** signed in + online → server visit (server clock). Network failure → saved on the phone (phone clock, `web_offline`), uploaded on the next sync. Guests → always on the phone, uploaded after sign-in. Timer = `now + skew − started_at` (stored timestamp, survives reloads). Double taps are harmless on both sides.
- **UI**: Gym card at the top of the Workout tab (name your gym → "I'm at the gym" → live timer + Done; rename; "N visits this month"; offline tag), live "At the gym 0:42" on Today's Burned card.
- **Tests:** Node (pure helpers + row mapping); 20 SQL checks run against the real DB in a rolled-back transaction (idempotency, one-active index, other users' gyms, offline ids/times, append-only events, RLS: can't insert/update visits or call the functions); Chrome (guest flow, double tap, reload mid-visit, phone + desktop, both themes).

### Phases 2 + 3 (2026-09-25)
- **Consent (layer 1)**: `user_goals.location_consent` (null never asked / false off / true on) + `location_consent_at` (migration `20260925140000_location_consent`), synced with goals (`goalsDirty`). The server **re-reads it** and ignores coordinates unless it's true. Toggle in the gym sheet.
- **Verification** (`lib/gym/verify.ts`, pure): Haversine (mean Earth radius); `judge()` = consent + status + reading + gym → verdict; rule: accuracy > 200 m → `low_accuracy`; distance ≤ radius → `verified`; outside even with the accuracy → `outside_radius`; otherwise `low_accuracy`. Unit-tested (boundary at exactly the radius, accuracy > radius, consent off, gym without a location, denied/unavailable).
- **API**: check-in body `{ gymId, location?, locationStatus, force }`; the server reads consent + gym, judges, and for `outside_radius` / `low_accuracy` (without `force`) logs a `check_in_attempt_failed` event and returns `{ visit: null, verdict }` so the user can "Try again" / "Check in anyway". Denied/unavailable start an unverified visit directly. Check-out judges the end too (never blocks). Coordinates are used once and dropped; only distance + accuracy are stored.
- **Browser** (`lib/gym/location.ts`): `permissionState()` (Permissions API in try/catch, never prompts), `readLocation()` (`enableHighAccuracy`, 15 s, `maximumAge 0`; codes 1/2/3 → denied/unavailable/timeout), iPhone / iPhone-Chrome detection, plain unblock steps per platform (iPhone Settings → Chrome → Location; Safari Websites; Android lock icon).
- **Check-in flow** (all inside the Gym card, `GymCard.tsx`): first time → **our explainer** (Continue / Check in without location / Don't use location) before the browser ever asks → Finding you… → server verdict → verified ✓ / "You look about 420 m from …" / "Your location is fuzzy (±420 m)" / "Location is blocked" with steps / "Couldn't get a fix". Every problem panel has **Check in anyway**. Live timer shows a **location verified** or **not verified** tag. Done takes one reading (10 s, 30 s cache) when consent is on. Pre-check-in sync is capped at 4 s so a slow network never leaves the button spinning.
- **Gym sheet** (`GymSheet.tsx`, lazy-loaded): name, **"I'm at my gym right now"** (one high-accuracy reading; turns the setting on), **Leaflet + OpenStreetMap map** (`GymMap.tsx`: tap or drag the jamun pin, radius circle, dashed accuracy circle, tiles inverted in dark mode, attribution kept, `data-vaul-no-drag`), radius slider 100–300 m, consent toggle. Leaflet (~42 KB gzip) loads only when the sheet opens.
- **Tests**: Node (verify/judge); Chrome with simulated GPS (setup via current location, radius, blocked permission → map fallback, both themes, phone + desktop); signed-in screens with a fake local session + mocked API (explainer → too far → check in anyway → not verified; verified; blocked; fuzzy). Real-device tests (Android + iPhone) still to do by the owner.

### Phase 4 (2026-09-25)
- **Lazy auto-close** (no cron): `gym_auto_close(user, 180, 90)` runs at the start of every gym API call (`/active` on every app open, check-in, check-out). A visit open > 3 h ends at the **last exercise logged during it** (`workouts.data.visitId`, synced), else **start + 1:30**, never past 3 h; status `auto_closed`, `auto_close` event. "Done" tapped after 3 h uses this rule instead of the late tap. Replies carry `autoClosed` → toast "Your gym visit from 7:04 pm was closed automatically (1 h 30 min)" with **Fix end**.
- **Fix end**: `PATCH /api/gym/visit` → `gym_set_end` (auto-closed visits only; after the start, within 3 h, not in the future; `end_corrected` event, new type in migration `…150000_gym_autoclose`). UI: pencil on the visit row → "Left at [time]" → Save.
- **Phone-only visits** (offline/guest) follow the same rule locally (`closeStaleLocal`, on app open/foreground).
- **Minimum 20 min** (`MIN_VISIT_MINUTES`): shorter visits don't count (struck through, "under 20 min, doesn't count").
- **Counted visit = workout day** (Q7): `workoutDay(..., visited)`; visit days also start the workout/global streaks and get dots on the Workout week strip. No separate visit streak.
- **Nearby banner** (`lib/gym/nearby.ts`, `NearbyBanner.tsx`): on app open / foreground, only if consent is on, a gym location exists, no active visit, not snoozed (4 h per gym), not within 60 min of a finished visit, and the permission is already **granted** (never on "prompt"/"unknown"). One cheap reading (no high accuracy, ≤ 5 min old), distance worked out **on the phone**; nothing is sent. "Check in" snoozes, opens the Workout tab and runs the normal server-verified check-in.
- **Recent visits** on the Gym card: last 3 with day, duration, times, verified / not verified / auto-closed / on this phone tags; "N visits this month" counts only 20+ min visits.
- **Tests**: SQL (11 checks, rolled back: 1 h left open, no exercise → +1:30, last exercise at 55 min → 55, cap at 3 h, idempotent, events, fix end valid/future/before start/real check-out refused); Node (visited workout day, 20-min rule, visit tags, streak from visits alone); Chrome (banner → check in → timer; zero geolocation calls on "prompt" or consent off; stale phone visit closed at 50 min; auto-close toast → Fix end → PATCH; 3-day workout streak from visits alone).

### Editing, switching and place search (2026-09-25, D37)
**Why:** a gym saved once couldn't really be changed: the only way in was a faint ⚙, and editing overwrote the gym, so old visits would silently point at the new place.

- **Entry points:** "Edit" pill on the Gym card (with "HSR Layout, Bengaluru · 150 m radius" / "Location saved" / "No location yet" under the name) and **Me → Your gym** (`YourGymCard.tsx`). Both open `GymSheet.tsx`.
- **Sheet modes:** `setup` (first gym), `edit` (same id: pin, name, radius), `switch` (fresh form, map opens at zoom 14 around the old gym, note "Your N visits there stay in your history"). Edit shows **Changed gyms?** → *Switch to a new gym* / remove (inline confirm). Both disabled while checked in ("Tap Done on your current visit first"). Moving the pin while checked in warns that Done is judged against the new spot.
- **Store:** `saveGym` (create/edit), `switchGym(next)` (gyms = [next]; old ids → `deletedGyms`), `removeGym(id)`. `currentGym(gyms)` (`lib/gym/gyms.ts`, newest `createdAt`, ties by id) replaces `gyms[0]` everywhere (card, sheet, nearby banner). Switch/remove/moved pin call `resetNearby(id)` (clears the banner's "not now").
- **Server:** migration `20260925170000_gym_switch.sql`: `gym_check_in` (offline uploads only, i.e. `p_id` set) and `gym_record_visit` accept your own soft-deleted gym. `flushGym`'s fallback (retry with `gymId: null` on `gym_not_found`) stays for older servers.

**Place search**
- **Research (2026-09-25):** see D37 for why Geoapify and who is ruled out. OSM gym coverage: 2,357 `leisure=fitness_centre` in India (taginfo), e.g. Bengaluru ~251, Delhi ~198, Mumbai ~86 (Overpass, rough city boxes): name search will often miss; areas work well. Alternatives kept open: Ola Maps (India POIs; get storage terms in writing first; its terms forbid use with ML/AI systems, so never near `/api/food/parse`), Stadia Standard ($80/mo, Foursquare OS Places), LocationIQ, self-hosted Photon (India dump).
- **Route** `POST /api/places/search` (`src/app/api/places/search/route.ts`): auth (401) → Zod body (400) → provider configured? (503 `not_configured`) → `consume_api_rate(user, "places", 30/min, 300/day)` (429) → `place_cache` → provider → cache write → `{ places, provider, attribution, cached }`. Any provider error → 503 `unavailable`.
  - `{mode:"search", q (3–80 chars), near}` → Geoapify autocomplete, `filter=countrycode:in`, `bias=proximity:<map centre>`, 8 results; kinds `gym` / `area` / `place`.
  - `{mode:"nearby", near}` → Geoapify Places `categories=sport.fitness` within 3 km, named only, park "fitness stations" dropped.
- **Provider interface** `src/server/places/provider.ts` (`search`, `nearby`, `attribution`); `geoapify.ts` is one adapter (key never logged: it's in the URL). New provider = one adapter + `PLACES_PROVIDER`.
- **Cache** `place_cache` (server only): key = provider | mode | normalized text | position rounded to ~1 km (search) or ~110 m (nearby); 30 days, empty answers 1 day. **Rate limit** `api_rate` + `consume_api_rate(user, bucket, …)`: generic, use it for any new route. Migration `20260925171000_place_search.sql` (also adds `user_gyms.place jsonb`).
- **Device:** `lib/gym/places.ts` (shared Zod contract + `placeStillFits`, `readGymPlace`; Node-runnable), `placesApi.ts` (fetch + per-session memo), `components/workout/PlaceSearch.tsx`: 300 ms debounce, ≥ 3 chars, aborts stale requests, skeleton rows, ↑↓ Enter, Esc clears (keeps the sheet open: `data-escape-clears` + `Sheet.tsx`), distance from the map centre, attribution under results. **Area** pick → map flies there (`GymMap` `focus`) and lists gyms nearby; **gym/place** pick → pin (+ name if empty), "Map data can be a little off: drag the pin onto the building". Guests see "Sign in to search…"; offline / limited / not configured / down each say so and point to the map.
- **Tests:** Node (request contract incl. https-only attribution links, normalize, 1 km rule, stored-place check, sync round trip, `currentGym` ties); Chrome with mocked API (guest edit → switch → remove, queue contents, old visits untouched, lock while checked in, Me row, signed-in search → area → nearby → pick → save, one request per settled query, Esc; phone light/dark + desktop). **Not yet run against the real Geoapify API** (no key): smoke-test once `GEOAPIFY_API_KEY` is set.

### Still to do
- Owner: real Android + iPhone tests (first permission, denied, indoor reading, close mid-visit and reopen, double tap, nearby banner after granting).
- Future (not now): native app geofencing into `gym_events` (`native_geofence`) + a session builder.
- Owner: test on one Android phone and one iPhone (first-time permission, denied, indoor reading, close mid-session and reopen, double tap).
