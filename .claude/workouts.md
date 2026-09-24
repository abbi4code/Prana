# Workouts & calorie burn

Status: **phase 1 built 2026-09-24** (library, set logger, cardio, burn, Today/Workout/Progress UI, streaks, sync). Migration `20260925120000_workouts` pushed. Decision: **D27** in [decisions.md](decisions.md). (The migration's SQL comment says "D26": renumbered after the NL-logging session took D26; pushed migrations aren't edited.)

## What the owner asked for
- A gym section: exercises with **photos** (so people can recognise a machine by sight), filtered by body part (chest, back, lats, biceps, triceps, abs, legs…) and equipment.
- Log each exercise as **sets × reps × weight (kg)**.
- From that, plus the person's body weight and height, estimate **calories burned**. A rough estimate is fine.
- Burn has its own bar and figure, **separate from food**; show burned vs an optional daily burn goal; net shown too.
- Food goal editable (current suggestion stays the default).
- Streaks per section (food, workout) plus a **global** one that lights when both are hit.
- Rest days: **the user picks them** (owner, 2026-09-24). Cardio in phase 1: yes.

## As built

**Screens**
- **Workout tab** `/workout` (4th nav tab; phone nav shows the label only on the active tab so four fit): week strip with the workout-streak flame, Burned card (big number, bar to burn goal, minutes, sets, rest-day badge), Exercise / Cardio buttons, Session list (photo thumb, sets summary, ~kcal; tap = edit, swipe left = delete + undo), Workout streak card, Workout goals card (daily burn goal + rest-day picker).
- **Workout sheet** (`components/workout/WorkoutSheet.tsx`, `useUI.gym`): bottom sheet on phones; on desktop a centred **two-pane modal** (D28): library left, logger right (before picking: today's session, tap to edit). Strength tab: search (aliases), muscle chips (+ sub-chips for Back/Legs, jamun), equipment chips, Recent row, 2-col photo grid. Cardio tab: activity list. Lift detail: start/end photos cross-fading (`animate-flip`), muscles, "Last time" (pre-fills sets), kg × reps steppers (typing works; kg step 2.5, 1 for dumbbell/kettlebell/bands; empty bar = 20 kg default), add/remove set, rest 60/90/120/180 s, pace Normal/Intense, "How to do it" (steps lazy-loaded), live ~kcal footer. Cardio detail: minutes (+ quick picks), speed/incline for walk/run (pace shown for runs), effort chips for the rest. Sheet stays open after logging ("Done · n") so a whole session can be logged in one go.
- **Today**: stats row Eaten · **Burned** · **Net** · **Goal (tap to edit kcal inline;** macros stay as set in Me), plus a Burned card under chai/water (opens /workout, + opens the sheet). Flame = **global streak** once any workout exists, else the food streak.
- **Progress**: "Prana streak" card (global; shows food + workout current streaks), "Food streak" card (was "Discipline streak"), heatmap with Food / Workout / Both toggle (toggle appears once workouts exist).
- Desktop: sidebar "Log workout" button, keyboard **W**. The FAB on the Workout tab opens the workout sheet (jamun gradient).
- Theme: new token **`jamun`** (purple) = workouts / burn in both themes.

**Data**
- `data/exercises.json` + `data/burn-model.json`: research (browser Claude), reviewed below.
- `data/exercises-extra.json`: 11 common exercises free-exercise-db lacks (no photo, brass dumbbell/kettlebell art).
- `data/free-exercise-db.json` + `public/exercises/<id>-0|1.webp` (400 photos, 480 px WebP, 5.5 MB): `node scripts/import-exercise-db.mjs` (pinned commit `a859101`, needs `cwebp`). Photos are fetched on first view and cached offline by `sw.js`.
- `npm run exercises` → `src/data/exercises.generated.json` (211 exercises, 20 activities, ~9 KB gzip) + `exercise-steps.generated.json` (how-to text, dynamic import). Every MET is looked up **by Compendium code** from burn-model.json; the build fails on unknown codes or missing photos.

**Model / sync**
- `Workout` = one exercise or cardio bout: `{ id, date, kind, refId, name, sets?, restSec?, intense?, minutes, speedKmh?, inclinePct?, optionCode?, met, kcal, createdAt }`. **kcal/minutes/met are snapshotted** at log time (like food, D05); editing recalculates.
- `Fitness` = `{ burnGoal: number | null, restDays: number[] }` (0 = Sunday, default `[0]`), stored in `user_goals.fitness` and pushed with goals (`goalsDirty`).
- Supabase: `workouts` table (jsonb doc, RLS own rows, soft delete) — same pattern as `saved_meals`. RLS verified (anon read `[]`, write rejected).
- Body weight for the estimate = latest weigh-in on or before the day, else profile weight; **if neither exists the sheet asks for it** (we never guess one). Without age/height the resting burn falls back to 1 MET and the footer says so.

**Streak rules** (`lib/streaks.ts`, pure, Node-tested)
- `runStreak(first, today, judge)` is the shared engine; `"rest"` days are skipped (neither add nor break). Food streak (D24) uses it unchanged.
- Workout day: burn goal set → hit when burned ≥ goal; no goal → hit when anything is logged. Otherwise a chosen rest day → rest, else miss. Freezes as D24.
- Global day: food on target **and** workout hit-or-rest. Workout + global streaks start on the first day a workout was logged.

Sentence / voice logging of workouts ("bench 3x10 60kg", "30 min walk") goes through the NL pipeline: see [nl-logging.md](nl-logging.md) Part 5. `defaultKg` now lives in `lib/nl/workoutDraft.ts` (re-exported from `lib/exercises.ts`); `weightOn` falls back to the nearest later weight when none is logged on or before the day.

## Research data (received + reviewed 2026-09-24)
Files: `data/exercises.json` (200 exercises, 20 activities, 12 "missing") and `data/burn-model.json` (142 Compendium METs, corrected-MET method, ACSM walking/running equations, 9 measured studies, 10 validation cases, timing, accuracy).

Checks done:
- All 200 `fedb_id`s exist in free-exercise-db (876 exercises); names match the intended exercise; every one has 2 photos. No duplicate ids.
- 25 METs spot-checked against pacompendium.com: all exact. Corrected-MET formula and Harris-Benedict constants: exact.
- Model vs published measurements (MET × 3.5 mL/kg/min × 5 kcal/L): bench/squat within 0–7 % at moderate loads; +20–29 % at heavy loads; −26 % to +25 % across machine exercises; whole session (Phillips 2003) −10 % men, −17 % women. So about ±25 %, as expected.
- ACSM running at 10 km/h = 10.5 MET, matching Compendium 12060 (6.7 mph = 10.5).

Gaps (known, accepted):
- Validation subjects are all men of 78–84 kg and 178–180 cm. There's no published open data for 60 kg, short/tall people or women.
- Bodyweight fractions only for push-up variants (Ebben 2011). Stored (`bwf`) but not used in kcal (the model is time × MET).
- ACSM cycling constant not sourced, so bikes use Compendium watt codes. Surya namaskar is per minute only (rounds→minutes isn't sourced).
- `mets[].description` is paraphrased; the UI uses our own labels (`OPTIONS` in the build script).

## Calculation (as built, `lib/burn.ts`)
- **Gross** kcal/min = MET × 3.5 × kg × 5 / 1000 (the Compendium's own conversion). **Net** = gross − resting burn/min from **Mifflin–St Jeor** (same equation as the food goal). Only net is counted, never below 0. This is where height, age and sex come in (~1 kcal per exercise; body weight is the big factor).
- The Compendium's corrected MET cancels out when converted back to kcal, so it isn't used.
- Weight lifted (kg) doesn't scale kcal: heavier sets burn *less* per minute (Mazzetti 2011, Scott 2011). kg is for progress (last time, later PRs).
- Lift time = Σ sets (reps × 3 s, or hold seconds, + rest). 3 s = midpoint of ACSM 2009's 1–2 s + 1–2 s tempo; default rest 90 s = midpoint of the hypertrophy range, 60–120 s.
- MET per exercise (`metFor` in the build script): squat/deadlift family 02052 (5.0); kettlebell swings 02058 (9.8); burpee/jumping jacks/battle ropes 02020 (7.5); jump squat/box jump/mountain climber 02057 (6.5); power clean, clean & press 02050 (6.0); other loaded lifts 02054 (3.5); abs bodyweight + timed holds 02024 (2.8); other bodyweight 02022 (3.8). **Intense** pace: 02050 (6.0) for loaded lifts, 02020 (7.5) for bodyweight.
- Cardio: walking/running = ACSM equations from speed (+ incline); everything else = the chosen Compendium code.
- Owner's example (bench 50 kg, 4×8, 90 s rest, 75 kg / 170 cm / 30 y male): 7.6 min → **~26 kcal**.

## Next (phases 2–3)
2. Routines ("thalis for the gym": Push/Pull/Legs), rest timer (would give real durations), PRs (estimated 1RM) with celebration, last-session numbers beside each set.
3. Weekly sets per muscle + body heatmap, body measurements, private progress photos.
