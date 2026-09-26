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
- **Workout tab** `/workout` (4th nav tab; phone nav shows the label only on the active tab so four fit): **week strip** (`WorkoutWeek`, full width on desktop) where each day shows how it went for the workout streak: 🔥 workout day, 🌙 rest day, ❄️ saved by a freeze, 🥲 missed, dashed ring = today, not yet; a band joins neighbouring streak days; "3/6 workout days · ~kcal" for the week; an **Exercises** toggle (remembered per device, `localStorage["prana-week-exercises"]`) opens what was done each day: phone = a list (emoji, muscle groups, exercises, photo stack, ~kcal; tap = that day), desktop = a week calendar with up to 4 exercises per day. Then Burned card (big number, bar to burn goal, minutes, sets, rest-day badge), Exercise / Cardio buttons, Session list (photo thumb, sets summary, ~kcal; tap = edit, swipe left = delete + undo), Workout streak card, Workout goals card (daily burn goal + rest-day picker).
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
- **Since 2026-09-25 (step 1 of v2):** the rest you pick only changes the time shown; kcal are always charged with the standard 90 s rest (Farinatti 2011: rest length doesn't change total energy). Weight still doesn't count until v2 lands.
- **Gross** kcal/min = MET × 3.5 × kg × 5 / 1000 (the Compendium's own conversion). **Net** = gross − resting burn/min from **Mifflin–St Jeor** (same equation as the food goal). Only net is counted, never below 0. This is where height, age and sex come in (~1 kcal per exercise; body weight is the big factor).
- The Compendium's corrected MET cancels out when converted back to kcal, so it isn't used.
- Weight lifted (kg) doesn't scale kcal: heavier sets burn *less* per minute (Mazzetti 2011, Scott 2011). kg is for progress (last time, later PRs).
- Lift time = Σ sets (reps × 3 s, or hold seconds, + rest). 3 s = midpoint of ACSM 2009's 1–2 s + 1–2 s tempo; default rest 90 s = midpoint of the hypertrophy range, 60–120 s.
- MET per exercise (`metFor` in the build script): squat/deadlift family 02052 (5.0); kettlebell swings 02058 (9.8); burpee/jumping jacks/battle ropes 02020 (7.5); jump squat/box jump/mountain climber 02057 (6.5); power clean, clean & press 02050 (6.0); other loaded lifts 02054 (3.5); abs bodyweight + timed holds 02024 (2.8); other bodyweight 02022 (3.8). **Intense** pace: 02050 (6.0) for loaded lifts, 02020 (7.5) for bodyweight.
- Cardio: walking/running = ACSM equations from speed (+ incline); everything else = the chosen Compendium code.
- Owner's example (bench 50 kg, 4×8, 90 s rest, 75 kg / 170 cm / 30 y male): 7.6 min → **~26 kcal**.

## Lifting burn model v2 (decided 2026-09-25, research pending)
Owner found two real flaws in the v1 time × MET model for lifting: **weight lifted doesn't change kcal**, and **longer rest adds kcal** (3 × 3 min rest ≈ 41 kcal vs 60 s ≈ 21 kcal for the same sets). Both come from treating a set like cardio: Compendium weight-lifting METs are session averages, so every minute (rest included) is charged at the same rate, and load isn't an input.
Decision (owner: "do A, long-term plan"): replace lifting kcal with a **per-set mechanical-work model**: work = load × g × vertical displacement × reps (bodyweight exercises: body-mass fraction), energy = work × a published energy-per-work factor that includes recovery (Scott 2011, Knausenberger 2014 found set energy tracks work, r 0.87–0.997). Rest length no longer drives kcal (only what the research supports). Cardio stays time × MET.
Research prompt given to browser Claude → expected file `data/lift-energy.json`. Until it lands, v1 stays.

**Research received 2026-09-25 (`data/lift-energy.json`), reviewed:**
- **Rest length doesn't change total energy** (Farinatti 2011: leg press 5×10 at 15RM, 1-min vs 3-min rest = 88.7 vs 91.1 kcal incl. 90 min recovery; chest fly 50.3 vs 54.1). So kcal must not grow with the rest chosen.
- **Within one exercise, set energy tracks mechanical work** (Scott/Knausenberger 2014, 40 measured sets incl. recovery + anaerobic part): slopes in kJ per kg·m of bar travel (Scott's "J" are kg·m, the unit check holds: incline press 208.6/(40.8×10) = 0.51 m): bench 0.0937 (Scott 2009, r 0.97), incline 0.0911, squat 0.0942, deadlift 0.102 (3 points only), shrug 0.246, calf raise 0.296. Big-range lifts cost ~0.09–0.10 kJ per kg·m; short-range ones (~0.12 m) ~3× more per unit of work.
- **Bar travel per rep** measured only for squat 0.71 / front squat 0.68 / overhead press 0.56 / stiff-leg deadlift 0.55 (Hornsby 2018, weightlifters) and implied by the Smith-machine data (incline 0.43, deadlift 0.60, squat 0.36 self-selected depth, shrug 0.12, calf 0.11). **Missing:** bench, rows, pulldown, pull-up, curls, triceps, raises, hip thrust, lunge, leg press, cables, machines.
- **One pooled formula doesn't transfer** to exercises it hasn't seen: fitting on 4 exercises and predicting the 5th misses by 25–117% (pooled in-sample error ~30–41%). Farinatti's chest fly (≈50 kcal for 5×10) is far above what the bench slope would give, i.e. isolation/machine work costs more per unit of work.
- **Validation:** 40 of 49 cases are the same Knausenberger sets (not independent); the rest lack loads in kg. No independent check yet.

**Plan (owner, 2026-09-25):** step 1 done: rest no longer changes kcal (`liftBurn` charges `DEFAULT_REST`; the UI says rest changes the time, not the calories). Step 2: second research pass for bar travel per movement, energy of machine/cable/isolation exercises with loads in kg, and independent sessions. (Prompt given 2026-09-25 → expected `data/lift-energy-2.json`.)

**Second research received (`data/lift-energy-2.json`), reviewed 2026-09-25:**
- **Reis 2017** (14 men, 78.7 kg): 8 machine exercises at 12/16/20/24 % 1RM **with loads in kg**, continuous reps at 15/min, exercise O2 only (no recovery). Net per-rep cost (gross − 1 MET, ÷ 15) is linear in load: bench 0.107 + 0.0055·kg kcal/rep, incline 0.171 + 0.0082·kg, half squat 0.461 + 0.0090·kg, leg press 0.112 + 0.0039·kg, leg extension 0.206 + 0.0086·kg, lat pulldown 0.040 + 0.0074·kg, curl 0.021 + 0.0155·kg, triceps 0.011 + 0.0193·kg. Doubling the load at the same pace raises energy only 18–48 % (elasticity 0.24–0.55): **weight matters, but the exercise (muscle mass) matters more.**
- **Cross-lab check** where Reis and Scott overlap: bench 22.7 kg × 15 = 3.5 vs 3.9 kcal, bench 40 × 10 = 3.3 vs 4.5, incline 20.4 × 15 = 5.1 vs 3.6, squat 28.3 × 15 = 10.7 vs 8.3 → agreement within about ±30 %.
- **Bar travel:** only Smith bench 0.415 m (SD 0.052) and Smith squat 0.501 m (Montoro 2025, 40 people) added. Rows, pulldowns, curls, raises, leg press, hip thrust, lunges, cables still unmeasured; pulley ratios not found (only blogs/sellers).
- **Rustaden 2020:** total kg lifted did not predict session energy across formats (BodyPump 19,485 kg ≈ 302 kcal vs heavy 8RM 15,616 kg ≈ 289 kcal). Bodyweight fractions (squat/lunge 0.9, push-up 0.65, dip 0.5, sit-up 0.4) are the authors' pilot constants (medium confidence).
- **Excluded:** Adeel 2021 (180–290 kcal for 3 × 10 dumbbell sets, 680–840 kcal for 9 sets: implausible, marked low confidence).
- Implication: a displacement-based model can't cover most exercises; a **per-rep model by movement group** (per-rep cost = a + b × kg, from Reis/Scott) needs no bar travel and covers the library once every exercise is mapped to its nearest measured movement.
 Step 3: switch all lifts to the per-set work model and validate before shipping. **Done 2026-09-25 (see "v2 as built").** Past logs keep their snapshot kcal (D05).


### v2 as built (2026-09-25)
- **Formula** (`repBurn` in `lib/burn.ts`, one entry point `exerciseBurn` in `lib/exercises.ts` used by the workout sheet, the confirm card and "Add anything"): kcal = Σ sets [reps × (a + b × load_kg) + set]. Rest length and pace don't change it; the rest you pick only changes the time shown.
- **Coefficients are computed in `scripts/build-exercises.mjs`** from the research files (never typed in) and shipped as `repGroups` in `exercises.generated.json`:

| Group | Per rep | Per set | Source |
|---|---|---|---|
| bench | 0.00929·kg | 0.757 | Scott 2009 regression × 0.415 m (Montoro 2025 Smith bench) |
| incline (incl. overhead presses) | 0.00928·kg | 0.767 | Knausenberger 2014 × 0.426 m (their data) |
| squat (loaded squats, lunges, split squats, step-ups) | 0.00817·kg | 3.569 | Knausenberger 2014 × 0.363 m |
| deadlift / hinge | 0.01457·kg | 13.526 | Knausenberger 2014 × 0.598 m (**3 sets only, medium confidence**) |
| shrug | 0.00698·kg | 0.011 | Knausenberger 2014 × 0.119 m |
| calf | 0.00791·kg | 0.465 | Knausenberger 2014 × 0.112 m |
| legpress (incl. hip thrust, bridges, pull-through) | 0.1117 + 0.00394·kg | 0 | Reis 2017, net of 1 MET |
| legext (incl. leg curls, adductor/abductor, cable kickback) | 0.2065 + 0.00858·kg | 0 | Reis 2017 |
| pulldown (incl. all rows, pull-ups) | 0.0399 + 0.00737·kg | 0 | Reis 2017 |
| curl (incl. wrist curls, raises, rear-delt, face pull, upright rows) | 0.0211 + 0.01546·kg | 0 | Reis 2017 |
| triceps (extensions, pushdowns, kickbacks, skull crushers) | 0.0111 + 0.01927·kg | 0 | Reis 2017 |

- **Loads:** dumbbells/kettlebells in both hands: kg is per dumbbell (UI says "kg each") and doubled; single-arm moves aren't. Bodyweight moves: body mass × share (push-up 0.64 / feet raised 0.70 / hands raised 0.55 / knees 0.49, Ebben 2011; dips 0.5, Rustaden 2020 pilot; pull-up 0.956 = body minus both forearms + hands, Winter) + added kg, or minus the counterweight when assisted.
- **Still on time × MET (54 exercises):** core and ab moves, planks/timed holds, conditioning (burpees, jumping jacks, kettlebell swings/cleans, battle ropes, box/jump squats), carries, bands, bodyweight squats/lunges/bridges, inverted rows, back extensions: no per-rep data. Their Pace chip still shows.
- **Checks:** reproduces the sets it came from within 2–29 % (deadlift 2 %, calf 9 %, incline 12 %, squat 17 %, shrug 29 %); against Reis's independent measurements: bench +3 %, incline −35 %, squat −37 %. Owner's bench sets = 29 kcal at any rest, 35 kcal with +10 kg each. Workouts store `burn: "rep"`; past logs keep their snapshot.
- **Known weak spots:** deadlift per-set cost (3 measured sets) makes hinges high (3 × 5 @ 80 kg ≈ 58 kcal); Reis coefficients are extrapolated beyond their 12–24 % 1RM loads; mapped exercises (rows→pulldown, raises→curl, hip thrust→leg press…) are judgement.

## Routines (D34, built 2026-09-25)
- **Model:** `Routine = { id, name, items: { kind: "lift" | "cardio"; refId }[], createdAt, starter? }` in the store (`routines`, synced via `dirtyRoutines`/`deletedRoutines` → `routines` table). Logged workouts get `routineId` (kept on edits, like `visitId`).
- **Numbers (Option B):** `draftFor()` in `lib/routines.ts` = exact sets of your last session of that exercise (`lastTime`, before today's routine logs), else `liftValues`/`cardioValues` defaults. Burn via `draftWorkout()` → `exerciseBurn`/`cardioBurn`, same as the logger.
- **Overload hint:** `overloadHint()`: the last two sessions both "complete" (≥ 2 sets, same kg, no set below the first set's reps) at the same weight → +`kgStep` (bodyweight at 0 kg: +1 rep). Timed and assisted moves: none. Source: ACSM position stand on progression (Ratamess et al. 2009), simplified because target reps aren't known. Only applied when tapped.
- **UI:** `components/workout/Routines.tsx` (section at the top of the Workout tab's right column: cards / starter cards / new card; `useRoutinePlan`, `logRemaining`) and `RoutineSheet.tsx` (run checklist, builder with `Reorder`, picker). "Save as routine" on the Session card. Week strip shows the routine name for the day.
- **One tap never blind:** the card's ⚡ Log all appears only when every remaining exercise has a last session and a body weight is known; else Start opens the checklist.

## PRs (D36, built 2026-09-25)
- `lib/records.ts` (pure, Node-tested in the scratchpad: baseline, ties, heavier-fewer-reps, Brzycki values, bodyweight, assisted, holds, cardio, delete restores the old best): `metrics(workout, info)` → `computeRecords(workouts, infoOf)` → `{ byRef, hitsByWorkout, recent }`; `wouldBreak()` for the live chip; `formatPr` / `formatGain`. `lib/useRecords.ts`: `refInfo` (catalog lookup), `useRecords`, `usePrDays`.
- Kinds, in headline order: weight, e1rm, added, reps, assist, hold, set, distance, speed, minutes.
- UI: `components/PrCelebration.tsx` (banner, mounted in AppShell; store watcher, 20 s freshness, each log celebrated once), `components/workout/RecordsCard.tsx`, PR chip in `WorkoutList`, "Best: … · est. 1-rep max" + live chip in `LiftDetail`, PR chips in the routine checklist, 🏆 in the week strip.

## Next (phases 2–3)
2. ~~Routines~~ (built, D34), ~~PRs~~ (built, D36), ~~rest timer~~ (built, D40), ~~last-session numbers beside each set~~ (built, D40).
3. ~~Weekly sets per muscle + body heatmap~~ (built, D41), ~~body measurements, private progress photos~~ (built, D39).

## Activity rings (D33, built 2026-09-25)
The Workout tab's hero card (`components/workout/ActivityRings.tsx`), replacing the old "Burned" card (`BurnSummary`, removed).
- **Burn** (outer): today's kcal vs `fitness.burnGoal`; no goal → full once anything is logged (matches the workout-streak rule). Burst + toast at the goal (unchanged).
- **Move** (middle): this week's moderate-equivalent minutes vs 150. **Strength** (inner): days this week with a lift vs 2. Both from `lib/activity.ts` (PURE, Node-tested): cardio only for Move; `met ≥ 6` counts double, `met < 3` counts nothing; any `kind: "lift"` entry makes its date a strength day.
- Source: WHO guidelines on physical activity and sedentary behaviour 2020 (Bull et al., Br J Sports Med 2020;54:1451–62; https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7719906/): adults 150–300 min moderate or 75–150 min vigorous aerobic activity a week (or an equivalent mix), plus muscle-strengthening on 2+ days a week. We use the lower bound, 150.
- Known simplifications: a gym visit alone doesn't count for Strength (it could be cardio); METs come from the snapshotted `met` of each entry; lifting minutes never count for Move (the guideline treats them as a separate recommendation).
- Layout: one card on every screen; container query puts the legend beside the dial from 22 rem wide, under it (3 columns) on narrow phones. Empty tracks are tinted in each ring's colour. Streak notes on this tab sit behind an (i) (`StreakShell noteBehindInfo`).

## Week strip details (D35, built 2026-09-25)
`components/workout/WorkoutWeek.tsx`. Desktop: hovering / focusing a day (with logs, or a rest / missed / freeze verdict) shows `Peek`, a floating card (spans only: it lives inside the day's button; edge days align to their side). Clicking a day selects it and stretches just that tile (`focus`; grid `items-start` so the others stay compact); clicking it again folds it. Days with workouts show a chevron. First-run hint: `DoodleHint` (hand-drawn SVG arrow, path drawn with `pathLength`, italic caption) on tablet/desktop, a ping ring on phones; gone for good after "Exercises" or a day has been opened (`prana-week-hint`).

## Rest timer + last session per set (D40, built 2026-09-25)
`lib/restTimer.ts` (zustand, persisted end time `prana-rest`, rehydrated on the client), `components/workout/RestTimer.tsx` (mounted in AppShell), `LiftDetail` in `WorkoutSheet.tsx` (set-number tick, `LastSet` under each row). Gotcha: a vaul/Radix modal sheet disables pointer events outside itself and treats outside presses as dismiss, so the pill has `pointer-events-auto` + `data-float-ui`, and `Sheet` ignores interactions on `[data-float-ui]`.

## Muscles this week (D41, built 2026-09-25)
`lib/muscles.ts` (PURE: `musclesOf`, `weeklySets`, `band`; 16 muscles from free-exercise-db names; extras without muscle data fall back to sub/group), `components/workout/MuscleMap.tsx` (stylised front/back SVG on a 100×220 grid, left shapes mirrored; hover/tap links figure ↔ list). Sources: Pelland et al., Sports Med 2025 (fractional sets); Schoenfeld, Ogborn & Krieger, J Sports Sci 2017 (< 5 / 5–9 / 10+).

## Body (D39, built 2026-09-25)
Progress → Body. `components/progress/BodyCards.tsx`: `MeasurementsCard` (site tiles with sparkline + change since first, waist ÷ height, history chips, add sheet with WHO measuring tips) and `PhotosCard` (IndexedDB via `lib/photos.ts`, before/after drag slider). Measurements sync like saved meals (jsonb doc; store `measurements`, queue `dirtyMeasurements`/`deletedMeasurements`). Photos never leave the device.

