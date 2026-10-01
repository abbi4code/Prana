# Missing-food requests + research agent (D54, built)

Not built. **Decided by the owner (2026-09-30):**
- **Q8:** record both explicit "Request it" taps and failed searches / AI misses; signed-in users only; food name only.
- **Q11 = option B:** new foods go into a **Supabase table**, not the code file. The app downloads approved foods and adds them to search (like custom foods). The owner **approves each food in the admin panel**; approved = live for everyone, no deploy, no PR.
- **Q10 follows from B:** start with a "Run research" button in the admin panel; a daily Vercel Cron call can come later. GitHub Actions isn't needed.
- **Where the numbers come from:** the AI call returns only the *reference* (INDB code, IFCT code, USDA fdcId, recipe, label URL). Our server code then reads the numbers from the source itself: INDB.xlsx (file bundled with the server), IFCT CSV (download), USDA FoodData Central API (needs a free `USDA_API_KEY`). Those are data lookups, not AI. Only brand labels / chain PDFs have no dataset: there the numbers are transcribed from the label and the owner checks them against the image before approving (Q12).

- **Q9:** OpenAI. `gpt-6-luna` (used for parsing) isn't listed for the `web_search` tool, so research gets its own `RESEARCH_MODEL`; OpenAI's web-search examples use `gpt-6-astra`: confirm with a test call.
- **Q12:** yes, the AI may transcribe official label images / chain nutrition PDFs; always shown beside the image; the owner checks before Approve.

All decisions made. See **Build plan** below.

## Build plan (as decided, 2026-09-30)

**Flow:** user misses → `food_requests` → owner clicks "Run research" in admin → OpenAI (web search) returns a *reference* per food → the server reads the numbers from the source + runs the checker rules → `food_candidates` (pending) → owner reviews in admin (label image beside transcribed values) → **Approve** → `shared_foods` → every device downloads it and search finds it → the people who asked are told.

**Database (one migration):**
- `food_requests`, `food_request_users` (section 1; RPC `food_request_add(name, via)` for signed-in users, rate limited with `consume_api_rate`; `food_request_mine()`).
- `food_candidates`: request, status `pending · approved · rejected`, the food in catalog shape (jsonb), source (id, ref, url, image_url), checker warnings, the AI's raw reply, model, created / reviewed at + by. Service role only.
- `shared_foods`: id, data (the `Food` shape the app already uses), approved_at, updated_at, deleted_at (retract). **Readable by everyone incl. guests** (foods aren't personal); written only by the service role; `touch` trigger.
- Every approve / reject / retract → `admin_audit`.

**Device:**
- `lib/foods.ts` gets a shared-foods registry next to the custom-foods one (`setSharedFoods`): `getFood`, `searchFoods` and the AI-logging matcher see them.
- Download `shared_foods` rows changed since the last download on app open (signed in or guest), keep them in their own localStorage key (not `ct-v1`, not the sync queue: nobody edits them on the device). Offline = the last downloaded copy.
- Logged entries snapshot as always (D05); a retracted food disappears from search, old logs keep their numbers.
- Ids: research ids are refused if they exist in the catalog or `shared_foods`; `build-foods.mjs` fails if a later catalog food reuses a shared id.

**Server:**
- **One set of checker rules:** move the rules out of `scripts/check-research.mjs` into a shared module used by both the script (browser-Claude batches) and the server, so D52 fried, D53 alcohol, macro check, forbidden sources, 1,200 kcal cap behave the same.
- Number sources on the server: **INDB.xlsx downloaded from the INDB GitHub at run time** and cached (their repo has no licence file, so we don't commit it); IFCT CSV from jsDelivr (as the script does); **USDA FoodData Central API** with a free `USDA_API_KEY` (the big CSV downloads stay local-only).
- `server/foods/research.ts`: Responses API + `web_search` (allowlisted domains) → the batch schema (Zod). No numbers asked for, except `MFR_LABEL`: then a second call transcribes the label image / PDF page into the per-100 g fields, and the image URL is kept for the review screen.
- Routes (admin-only, `requireAdmin`): run research for the top N requests (N ≤ 20 per click, `maxDuration` 300 s on Hobby: process in small chunks), list / approve / reject / retract candidates. Plus `food_request_add` from the app (RPC).
- New env: `USDA_API_KEY`, `RESEARCH_MODEL`. Split `serverEnv()` per feature while here (known issue: one missing key breaks every route).

**Admin panel:** new "Food requests" tab: demand queue (name, people, signals, status), "Run research", candidate cards (name, kcal / 100 g, macros, units + default serving kcal, source link, checker warnings; label image beside the numbers for `MFR_LABEL`), Approve / Reject (+ reason) / edit the default serving, the list of shared foods with Retract, cost per run.

**App UI:** no-match state = Did you mean → **Request it** (+ "N people asked · status") → Create food. Misses logged automatically (signed in, name only). Later: "X is in Prana now" + "use the checked one instead of your custom food?".

**Phases:**
1. **Requests:** migration, RPCs, Request it + automatic miss logging, admin queue (no AI yet). Useful alone: shows what people miss.
2. **Shared foods:** table + device download/merge + Approve / Retract in admin (tested with a hand-made candidate).
3. **Research:** checker module, OpenAI call (confirm `RESEARCH_MODEL` with one test call first), candidates, alias suggestions.
4. **Labels:** image / PDF transcription + side-by-side review.
5. **Close the loop:** notifications, custom-food swap; a daily Vercel Cron call to "Run research" once it's trusted.

### Phase 1 as built (2026-09-30)

- **Migration `20260930100000_food_requests`** (not pushed): `food_requests` (one row per `name_norm` = lower case, ASCII punctuation + danda → space; status `new · alias · researching · found · not_found · junk`), `food_request_users` (request, user, signal, `times`, `notified_at` for phase 5). RLS on, no policies. `food_request_add(name, via)` for `authenticated`: sign-in, 2–60 characters with a letter, 20 a minute / 150 a day (`consume_api_rate`, bucket `food_request`), returns `{ people, status }`. `admin_food_requests(days, filter)` + `admin_food_request_set(id, status, food_id, reason)` for the service role (found / researching can't be set by hand); `admin_audit` action `food_request`.
- **App** (`lib/foodRequests.ts`, `components/log/MissingFood.tsx`):
  - End of a food search (add sheet + "Add anything"): no result → "No match… Ask us to add it, or add it yourself" + a prominent **Request "X"** + Create; with results → a quiet "Not in the list? Request "X"" row. States: Requested (+ "N people want this"), Saved for later (offline, sent on reconnect), daily limit, failed (tap again). Guests see only Create.
  - Signals: `request` (the tap), `search` (a no-result query **looked at for 1.5 s, then given up**: cleared, replaced by something unrelated, or the sheet closed; typing on doesn't count), `ai` (confirm-card items with no usable match), `custom` (a custom food created). One send per name + signal per session; offline → `prana-food-requests` queue.
  - Dish names with spaces: signed-in search treats any query with a space as a sentence (AI row only). `looksLikeFoodName` (≤ 4 words, no digits, no aur / and / with / kal / dinner… ) keeps Request + Create for "kulfi falooda", "gajar ka halwa". Known misses: "bread and butter", "chicken 65" (go to the AI, which records its own miss).
- **Admin → Requests tab** (admin.md): most wanted first, signals per food, closest catalog food from the app's matcher: one-tap **Same as** only at ≥ 85 % (exact alias hits: "fulka", "anda curry", "rasmalai"); 60–85 % is a hint only, because one shared word carries fuzzy scores ("missi roti" → Chapati / Roti 71 %, "daal makhni" → Moti Mahal Dal 62 %). Dismiss, Reopen, filters.
- Aliases marked in admin aren't live yet: they're added to `data/aliases.json` in the next food update (phase 2 could make them live through `shared_foods`).
- **Tests:** SQL on PGlite (23 checks: sign-in, validation, spellings merge, Devanagari, RLS, admin-only functions, triage rules, audit constraint, rate limit, account deletion); browser (production build, Supabase answered by PGlite, fake session): request + "2 people", quiet row, sentence has no Request, looked-at miss on clear and on close, quick typing sends nothing, results send nothing, offline queue → reconnect, desktop "Add anything", guest, admin queue / Same as / Dismiss / Done; phone + desktop, both themes, no page errors.

### Phase 2 as built (2026-09-30)

- **Migration `20260930110000_shared_foods`** (not pushed): `food_candidates` (request, proposed `food_id`, `data` = the app's `Food` JSON, `source` {id, ref, url, image_url, row_name}, checker `warnings`, raw `research` + `model` for phase 3, status pending / approved / rejected + reason, decided at / by) and `shared_foods` (id, data, candidate, request, approved by / at, `deleted_at` = retracted). RLS on, no policies, no direct reads.
  - `catalog_updates(p_since)` (anon + authenticated): shared foods changed since `p_since` (retracted ones flagged `deleted`), the full alias list (requests marked alias or found: name → food id), `at` = newest `updated_at`.
  - `admin_food_review(status)`, `admin_food_candidate_decide(id, approve|reject, by, reason)` (approve upserts the shared food, marks the request found; returns approved / rejected / not_found / decided), `admin_shared_food_set(id, live)`; audit actions `food_candidate`, `shared_food`.
- **Server gate** `src/server/foods/schema.ts`: `FoodSchema` (strict Zod of `Food`: categories, unit kinds, `conf` high/medium/low, unit ids unique, default unit present, kcal ≤ 900/100 g) + the checker's rules (macros within ±15 % incl. 7 kcal/g alcohol, else all null; no unit > 1,200 kcal) + not an id of the built-in catalog. `/api/admin/food-review` runs it on GET (problems shown on the card) and again on Approve (422).
- **Device** `src/lib/sharedFoods.ts`: on start (after the store loads) and on focus / online at most every 15 min; stored in `localStorage["prana-shared-foods"]` ({at, foods, aliases}); each downloaded food shape-checked before use. `setSharedFoods()` in `lib/foods.ts` adds them to `getFood`, `searchFoods` and the AI-logging matcher, and merges the alias names into existing foods ("rotla" → Chapati / Roti). The built-in catalog wins an id clash. "Request it" coming back `found` triggers an immediate check.
- **Admin → Requests tab**: "Waiting for your check" (Waiting / Approved / Rejected): card per candidate with kcal / 100 g, macros, every portion with grams + kcal, source + ref + row name + link (label image link for phase 4), the request and how many asked, checker warnings, problems (Approve disabled: "Fails the check"), Approve for everyone / Reject with a reason. "Added for everyone": Retract / Restore.
- **Tests:** SQL on PGlite (22 checks: shapes, no direct access for anon / users, review list, approve / decided / not found, reject reason, aliases live and removed on reopen, retract / restore through `at`, re-approval replaces, audit); `FoodSchema` unit test (12 cases); browser: not searchable before approval, problems block Approve, Approve → live, Reject reason, user finds + logs it (1 glass = 570 kcal snapshot), alias search, saved copy with `at`, server down → saved copy, desktop Add anything by alias, guest, Retract → gone on the next check, device sends its `at`; phone + desktop, both themes, no page errors.
- Nothing fills the candidates yet: phase 3 (research) does. Until then the Waiting list is empty.

### Phase 3 as built (2026-09-30)

- **One rulebook:** the checker's per-food rules moved from `scripts/check-research.mjs` into `src/lib/research/check.ts` (`checkFood`, `acceptedRow`), the research-row → app-food shaping from `build-foods.mjs` into `src/lib/research/shape.ts` (`toAppFood`), CSV parsing into `csv.ts`. The script, the catalog build and the server all use them. Regression on all existing batches: identical report, identical `data/foods-research.json`, identical `foods.generated.json`. The REPLACES bug (a replacement whose target is missing was accepted) is fixed. `build-foods.mjs` also writes `src/data/food-refs.generated.json` (each food's source row).
- **Server sources** `src/server/foods/sources.ts`: INDB.xlsx downloaded from the INDB GitHub (no licence file, so not committed; ~1 MB, ~5 s cold, cached per instance), IFCT CSV from jsDelivr, USDA FoodData Central API (`USDA_API_KEY`); name search for the tools (names + codes, never nutrient values).
- **Verify one food** `verify.ts`: USDA refs normalised to "fdcId N"; ids taken = catalog + shared + pending candidates; rows already used = INDB / IFCT rows and USDA foods in the catalog (shared USDA style rows like beer, and labels, may repeat); `checkFood` → `acceptedRow` → `toAppFood` → the approve gate; what the user typed becomes a search name when nobody owns it; INDB candidates carry the raw-weight warning.
- **The agent** `research.ts`: `RESEARCH_MODEL` (default `gpt-6-astra`) through the Responses API with `web_search` (calorie apps in `blocked_domains`) and tools `search_catalog`, `search_indb`, `search_ifct`, `search_usda`, `usda_portions`, `check_food` (the checker on its draft, so it fixes problems before answering); instructions = PROMPT.txt's rules for one food; strict answer `{ outcome: food | alias | not_found | not_food, alias_of, reason, searched, food }`; at most 10 steps, 240 s budget.
- **Route** `POST /api/admin/research { requestId }` (admin, `maxDuration` 300, `RESEARCH_PER_DAY` default 40, 6 a minute): request → researching; food → candidate (with the AI's answer, steps, tools, tokens, time), the request stays "in review"; alias → the request stays open with the suggested food (`food_id`) until the owner taps Same as; not found → `not_found` + reason; not a food → `junk`; failed checks / errors → back to `new` with the reason. Refuses a request with a candidate waiting (409 `in_review`) or already decided. Rejecting a candidate reopens its request with "Rejected: …". Every run audited (`food_request`, with model + tokens).
- **Admin:** Research, Research top N, Research again (no source, or stuck in review), the AI's suggestion with Same as, each run's result under its row; in-review rows hide Same as / Dismiss.
- **Real runs (gpt-6-astra, 2026-09-30):** daal makhni → INDB OSR139 "Dal makhani", 74 kcal/100 g, 1 katori (39 s, 5 steps, ~37k input tokens); fulka → alias of Chapati / Roti (8 s); asdfgh → not a food (9 s); kulfi → INDB ASC321, 98 kcal/100 g (reads low: the raw-weight trap → warning + prompt rule); Amul Kool Kesar → MFR_LABEL from Rajkot Milk Union's official product table, 89 kcal/100 g, 200 g pack (58 s, 5 web searches, ~78k tokens); jalebi → not found (the fried model has no syrup step; future.md).
- **Tests:** checker regression (above); verify with real INDB / IFCT / USDA (a new INDB dish passes; catalog rows, USDA ids and catalog ids refused; a wrong row name refused; chicken biryani reproduces 185.2 kcal); route integration on PGlite with canned AI answers (every outcome, in-review guard, decided / unknown, reject → reopen → research again → approve → found, audit); browser: stuck row, Research → card, Research top N with progress, suggestion → Same as; phone + desktop, both themes; phases 1–2 suites still pass.
- **Not yet:** a daily automatic run (Vercel Cron) once research is trusted.

### Phase 4 as built (2026-09-30): label images beside the numbers

- **Reader** `src/server/foods/label.ts`: a vision model (`LABEL_MODEL`, default `gpt-6-luna`, `store: false`) COPIES the nutrition panel into fixed fields (per-100 column, per-serve column, serving size, column headings, notes); it never estimates or calculates, "<1.0" → null + note, a non-panel image → `is_nutrition_label: false`, text in the image is data. Our code does the arithmetic (`labelPer100`: per-100 column as printed, else per-serve × 100 / serving size; kJ-only ÷ 4.184), compares field by field (`compareLabel`: same within 0.1 or 1 %), and `applyLabel` takes the label's numbers with the checker's macro rule (±15 % → macros null, confidence low).
- **Model test (2026-09-30):** four Yogabar labels with known values (3–4 columns each: per 100 g, per serve, with milk, RDA %): luna 20/20, astra 20/20, both refused an FSSAI-licence image. A blurred, tilted, heavily compressed label whose numbers sit one row below their names: luna 5/5 twice, astra 3/5 once (protein null, fat 12). → luna.
- **Migration `20260930120000_candidate_labels`** (not pushed): `food_candidates.label` jsonb {image, reading, per100, error, model, read_at, read_by}; `admin_food_review` returns it.
- **Research** reads the label image of an MFR_LABEL food as it creates the candidate (~10 s).
- **Review route** (`/api/admin/food-review`): GET adds `problems` (every value that differs from the label, not a nutrition panel, nothing to compare), `labelNotes`, `labelChecks`; POST `label` {id, image: https link or an uploaded photo ≤ 4 MB as a data URL} reads and stores (an https panel becomes the food's `source.image_url`; a photo stays in the admin panel only); `use_label` takes the label's numbers (re-checked); Approve of a label food refuses a differing label (422) and needs `labelChecked: true` (the owner's tick, audited).
- **Card:** the label image (tap to zoom full screen, Esc closes) next to a per-100 table Label | This food | ✓ / ≠, what was read (model, basis, columns, serving), a link box + **Read**, **Photo** (camera or gallery, redrawn in the browser to ≤ 1,600 px JPEG, EXIF / location dropped), **Use the label's numbers** when something differs, and the **"I checked these numbers against the label"** tick that Approve waits for.
- **Tests:** label reader on real labels (above); route integration on PGlite with canned readings (per-serve and kJ maths, macro rule, tick required, https label → image_url, differing label blocks → use the label's numbers → approve → live with the label's values, non-panel image, uploaded photo kept only in the panel, http / other schemes refused, decided candidates closed, research reads the label, reject reopens the request); browser with the real route code and real Yogabar images: images load, 5 ✓, Approve waits for the tick, zoom + Esc, tick → live, 2 ≠ → Use the label's numbers → 408 kcal → live, paste a link → Read, photo upload (74 KB); phone + desktop, both themes, no page errors.

### Phase 5 as built (2026-09-30): "your food is in Prana now"

- **Who hears:** people who tapped "Request it" or made the food themselves (signals `request`, `custom`), when the request becomes `found` (a candidate approved) or `alias` (Same as). Silent signals (a search that found nothing, an AI miss) don't: nobody was promised anything. A default, easy to widen.
- **Migration `20260930130000_food_request_news`** (not pushed): `food_request_news()` (the caller's unseen news, 60 days, newest first, `custom` flag) and `food_request_seen(ids)` (sets `food_request_users.notified_at` for the caller's rows), both for `authenticated` only.
- **Device** `src/lib/foodNews.ts`: loaded once per sign-in + app start, after `refreshSharedFoods()` so the food is on the device; news for a food the device can't resolve (retracted, not downloaded yet) waits. `ownVersion()` finds the person's custom food by the server's name key; `swapToChecked()` moves every thali from their version to the checked food at the same grams (unit `g`) and removes their version from My foods; past logs keep their snapshots; returns an undo.
- **Today** `components/today/FoodNews.tsx`: a card per piece of news under the greeting (2 shown, "and N more"): "**Kulfi Falooda** is in Prana now · checked against <source>" or "“fulka” now finds **Chapati / Roti**"; **Log it** (the add sheet opens on that food: `openAdd(meal, foodId)`), **Use it instead of mine** (only with their own version; toast with Undo), ×. Any of the three marks it seen.
- **Store fix:** `addCustomFood` now drops the id from `deletedFoods` (undoing a delete used to leave it queued, so the next push deleted it again). Not reachable before (no undo existed), needed for the swap's Undo.
- **Tests:** SQL on PGlite (requesters hear about found + alias with the custom flag; silent signals and open requests don't; seen per person, idempotent; guests locked out; 60-day window); browser (production build, RPCs on PGlite): two cards, swap only where they made their own, thali 1.5 × 200 g → 300 g, roti untouched, own version out + sync queued, yesterday's log untouched, Undo restores (and leaves the delete queue), seen on the server, no cards on the next open, Log it → add → 570 kcal, guests nothing; phone + desktop, both themes, no page errors.

Verification per phase: `tsc`, lint, build; SQL on PGlite (RLS: guests can read `shared_foods`, nobody but the service role writes); UI in Chrome at phone + desktop, both themes; `npm run eval:parse` after the matcher learns shared foods. Sections 4, 7, 9 and 10 below were written before B was picked: where they say PR / GitHub Actions, read "admin approval / admin button + Vercel Cron".

## Owner's ask (2026-09-30)
"When user searches for some food which we don't have, user has the option to manually add it. What I want: a scheduler, an agent that gets the official docs for food, searches them for what the user wanted, and if it gets the data, populates it in the db in the form we store the others. Think from all the wide angles, what else we can do, how to do it better, and whether a better approach exists."

## What exists today (checked in the code, 2026-09-30)
- No match in the add sheet (`LogSheet`) or "Add anything" (`QuickAdd`): "No match for "X". Try another name, or add it yourself" → `CreateFood`. The AI confirm card says "No match. Try another word."
- **Failed searches are not recorded anywhere.** The only demand signals are `custom_foods` (the admin panel's "catalog gaps" groups them by name) and `parse_corrections` (the user fixed an AI match).
- The catalog is static JSON built into the app (D13); new foods reach users with a deploy.
- Research today is manual: browser Claude + `data/research/PROMPT.txt` → `batch-*.json` → `scripts/check-research.mjs` re-reads every number → `npm run foods` → commit.

## The shape

```
miss: search with no pick · AI item with no match · custom food created · "Request it" tap
   → food_requests (Supabase: one row per food name, who asked)
   → weekly job
       1 triage      normalize, merge spellings, drop junk, "is it just a missing alias?"
       2 research    agent per request: kind → source plan → dataset lookup tools → batch JSON (refs, no numbers)
       3 gate        check-research.mjs re-reads every number · npm run foods · eval:parse · tsc
       4 PR          ready foods · "needs your eyes" (labels) · alias adds · not found + why
   → owner reviews + merges → deploy → in the catalog
   → requests marked found → the people who asked get "X is in Prana now" (+ swap their custom food)
```

The agent is a **researcher, not a source**: it only has to name *where* the numbers are. That keeps D03 and "the LLM never produces nutrition numbers", and reuses the checker that already gates browser-Claude batches.

## 1. Capturing demand

| Signal | Where | Strength |
|---|---|---|
| "Request it" tap (new, in the no-match state) | LogSheet, QuickAdd, AI confirm card | strongest; also tells us whom to notify |
| Custom food created | `custom_foods` (already stored) | strong: they cared enough to type a label |
| Search with no pick | last query (≥ 3 letters) when the sheet closes with nothing added | medium, noisy |
| AI item with no match, or "Did you mean" rejected | `ConfirmParse` | medium; often an alias gap |
| AI correction | `parse_corrections` | alias signal |

- **Tables:** `food_requests` (name_norm unique, display name, first/last seen, distinct users, counts per signal, kind, status `new · alias · researching · found · not_found · junk`, reason, food_id, next_try_at) and `food_request_users` (request, user, signal, created_at, notified_at). RLS on, no policies; writes through a security-definer `food_request_add(name, via)` granted to `authenticated`, limited with the existing `consume_api_rate`; `food_request_mine()` for the user's own statuses.
- Not a synced entity (nothing to pull back per row): fire-and-forget when online, a small device list retried later.
- **Privacy (DPDP):** food name text only (≤ 60 characters), no other context; signed-in users only (guests see "sign in to request"); rows cascade on account deletion; the privacy policy says it. The public repo only ever gets food names, never user ids or per-user counts.

## 2. Triage (cheap, no numbers involved)
1. Normalize with `canon` (`lib/nl/match.ts`) and merge near-duplicates ("daal makhni" / "dal makhani").
2. **Alias gap first:** if `matchFood` finds an existing food with a good score, it's a missing *name*, not a missing food → an `aliases.json` add (same ownership rules as the checker's `alias_suggestions`). Likely a large share of misses, and it needs no nutrition data at all.
3. Junk / not food / abuse → `junk` (text-only LLM classification + banned terms).
4. Kind: raw ingredient · home dish · street / fried · restaurant chain item · packaged brand · alcohol · supplement · unknown regional.
5. Priority = distinct users in the last 30 days (explicit requests count 3×), newest first; each run takes the top N (budget).

## 3. The research agent
**What makes it better than browser Claude: lookup tools over the real datasets.** In batch 1, 19 dishes came back "not found", mostly because browser Claude couldn't reach USDA (or they were fried, since fixed by D52). Tools (deterministic, local; they return names, codes and serving units, not nutrient values):
- `indb_search(name)`, `indb_recipe(code)` (ingredients from the recipes sheet), `ifct_search(name)`, `usda_search(name)` over the FNDDS + SR Legacy downloads, `catalog_search(name)` (duplicates, `FOOD` refs for combos)
- `web_search` limited to an allowlist (brand / chain / excise / government / USDA domains) + `fetch(url)` for label pages and nutrition PDFs
- `run_checker(batch)`: the agent sees the report and may fix rejections itself (at most 2 rounds)

| Kind | Source plan (same order as PROMPT.txt) |
|---|---|
| Raw ingredient | IFCT code → USDA SR Legacy / Foundation |
| Home dish | INDB recipe code (mind D52 fried rows and raw-weight rice dishes) → DERIVED recipe from IFCT/USDA ingredients with a cooked-weight basis (like chicken biryani) |
| Street / fried | DERIVED + `recipe.frying` (D52) |
| Packaged brand | brand's own site / Shopify `products/<handle>.json` / nutrition-facts image → `MFR_LABEL` (owner checks) |
| Chain item | the chain's official nutrition page or PDF → `MFR_LABEL` (owner checks) |
| Alcohol | D53 flow (brand ABV + USDA style row) |

**Output:** `data/research/batch-auto-<date>.json` in the existing schema, plus `not_found` with a reason per food and `alias_suggestions`.
**Guardrails:** schema-only output; page text is data, never instructions (prompt injection); allowlisted domains; the checker's forbidden-source rule; a per-run budget (requests, tool calls, money); the agent never merges or deploys.

## 4. Gate and publish
- Checker ACCEPT with INDB / IFCT / USDA / DERIVED sources → **ready**.
- `MFR_LABEL` → **needs your eyes**: the PR lists the label URL / image per food.
- Extra checks for automatic batches: kcal per 100 g inside a range for the category, the default serving's kcal, "is this a duplicate of an existing food" by name similarity (the macro check and the 1,200 kcal unit cap already exist).
- CI runs `npm run foods`, `npm run eval:parse`, `npx tsc --noEmit`.
- PR body: food · kcal / 100 g · default serving · source link · confidence · asked by N people. The job pushes a branch and opens a PR; the owner merges (the owner-commits rule holds). GitHub needs "Allow GitHub Actions to create pull requests" + `pull-requests: write`.

## 5. Closing the loop
- After a merge + deploy, the job marks requests `found` with the food id (matched in `foods.generated.json`).
- On app open, `food_request_mine()` → "Kulfi falooda is in Prana now" (toast / Today card) → opens the food.
- If they made a custom food with that name: "Use the checked one from now on?". Future logs use the catalog food; past logs keep their snapshots (D05).
- `not_found`: "No official source for X yet. Add it from the pack?" with the reason; retried after 30 / 90 days.
- In the no-match state, show the request's status ("3 people asked · checking this week").

## 6. At the moment of the miss (UX)
The research takes days, so the user still needs to log now. The no-match state, in order:
1. "Did you mean" fuzzy results (exists when there are fewer than 4 hits).
2. **Request it** (one tap).
3. **Build it from parts** (new, independent of the agent): pick catalog foods + amounts ("maggi + 1 egg", "poha + peanuts") → logged as a combo with sourced numbers right away; reuses `ThaliBuilder`.
4. Create food from the pack (exists) for packaged items.
5. Later: barcode scan ([smart-logging.md](smart-logging.md)).

## 7. Where it runs (checked 2026-09-30)

| Option | Facts | Fit |
|---|---|---|
| Vercel Cron | Hobby: once a day, fires anywhere in the hour; function max 300 s (Pro 800 s); bundle 250 MB | Light jobs only; the datasets and a PR don't fit |
| Supabase pg_cron | SQL inside the DB | Housekeeping: priorities, pruning `parse_cache` / `place_cache` / `api_rate` (already a backlog item) |
| **GitHub Actions `schedule`** | min every 5 min; can be delayed or dropped at busy times (start of the hour); in a public repo, auto-disabled after 60 days without repo activity | **Recommended**: repo checkout, Node, datasets cached between runs, `gh pr create`; free on a public repo |
| Claude Code routine | scheduled cloud agent that works in the repo and opens a PR | Same shape; the agent is Claude, like today's browser research |
| Local command | `npm run food:requests` | The first step in every option |

Datasets in CI: INDB.xlsx from the INDB GitHub repo, USDA FNDDS + SR Legacy zips from fdc.nal.usda.gov (public domain), IFCT CSV from jsDelivr (what the checker already uses). Secrets: `SUPABASE_SECRET_KEY` (read requests, mark found) + the LLM key, as repository secrets.

## 8. Model (Q9)
- **OpenAI** Responses API: built-in `web_search` tool, answers carry URL citations and a `sources` list, domain filters (up to 100 allowed / blocked domains). Same vendor and key as `/api/food/parse`.
- **Claude**: Agent SDK or a Claude Code routine; `PROMPT.txt` / `PROMPT-ALCOHOL.txt` were written for Claude.
- Both pass the same checker, so decide on cost and accept rate: run both once on the same 20 real requests and compare.

## 9. Other approaches considered
- **Research while the user waits:** no. Minutes per food, per-request cost, abuse, and label values need review.
- **Let the model estimate numbers:** no (hard rule).
- **Publish user-typed custom foods to everyone:** no (not a source). Use them as demand and as a cross-check: flag when the official value differs by > 20 %.
- **Proactive beats reactive for home dishes:** INDB's 1,014 recipes + batches 2–12 cover most everyday food; the request queue matters most for brands, chains, regional names and aliases. Keep both.
- **Live catalog table (no deploy), Q11:** public-read `catalog_additions` with checker-accepted rows only; the device pulls deltas and merges them into `FOODS`, search and the matcher, cached for offline. Faster (hours), but a second catalog path; worth it only if PR review becomes the bottleneck.
- **Open Food Facts:** at most a lead (brand + product name) for packaged items; the numbers still come from the brand's own label (smart-logging.md decision 1 is open).
- **Admin panel:** a "Food requests" section: queue, statuses, reasons, last runs, cost.

## 10. Phases
1. **Demand + triage:** migration + RPCs, "Request it", miss logging, admin section, alias triage command. Small, useful on its own.
2. **Agent as a local command** (lookup tools + checker loop) → batch file; try it on 20 real requests.
3. **Schedule it** (GitHub Actions weekly, off the hour) → PR.
4. **Close the loop:** notifications, custom-food swap, request status in the no-match state.
5. Maybe: live catalog additions. "Build it from parts" can ship any time.

## Sources (2026-09-30)
- Vercel cron limits: https://vercel.com/docs/cron-jobs/usage-and-pricing · function limits: https://vercel.com/docs/functions/limitations
- GitHub Actions `schedule`: https://docs.github.com/en/actions/writing-workflows/choosing-when-your-workflow-runs/events-that-trigger-workflows
- OpenAI web search tool: https://developers.openai.com/api/docs/guides/tools-web-search

## Who asked (2026-10-01)
In the admin Requests tab, "N people" opens the list of members behind a request (name, email, @handle, how each asked: Request it / search / AI / made own, how often, first and last time) with a link to their member page. Read through `admin_food_request_people(p_id)` (service role only, migration `20261001100000_food_request_people`); every open writes an `admin_audit` row (`food_request`, `viewed: people`), as for any member data (D51).
