# Workouts & calorie burn

Status: **plan agreed 2026-09-24; research received and reviewed (see "Research data"); no code yet.** Decision: D26 in [decisions.md](decisions.md).

## What the owner asked for
- A gym section: exercises with **photos** (so people can recognise a machine by sight), filtered by body part (chest, back, lats, biceps, triceps, abs, legs…) and equipment.
- Log each exercise as **sets × reps × weight (kg)**.
- From that, plus the person's body weight and height, estimate **calories burned**. A rough estimate is fine.
- Burn has its own bar and figure, **separate from food**.

## Agreed design
- **Exercise library:** curated ~150–200 exercises from **free-exercise-db** (github.com/yuhonas/free-exercise-db, Unlicense/public domain, 800+ exercises, 2 photos each: start + end position, primary/secondary muscles, equipment, level, mechanic, instructions), plus cardio machines, walking/running and sports (cricket, badminton, yoga, surya namaskar). Hinglish/gym-slang aliases like food search ("peck deck", "dand", "baithak").
- **Muscle filter:** 8 main chips (Chest · Back · Shoulders · Biceps · Triceps · Forearms · Abs · Legs); Back and Legs expand into sub-chips (lats, mid back, lower back, traps / quads, hamstrings, glutes, calves).
- **Photos:** not bundled (≈1,700 images). Loaded on demand, cached by the service worker. Per-exercise illustrations may replace them later (like D11 for food).
- **Burn model (a formula, not a lookup table):** time is taken from the rest timer, or estimated as sets × (reps × tempo + rest). Intensity comes from load, reps and compound/isolation, which picks a Compendium 2024 MET. The MET is corrected for the person (weight, height, age, sex, via the Compendium's corrected-MET method), then kcal = (MET − 1) × kg × hours. The −1 removes resting burn, which the daily goal already covers. Bodyweight exercises use a published body-weight fraction (push-up ≈ 64 %). Shown with "~". Realistic accuracy is about ±20–25 %; nobody (including ₹30k wearables) is 95 % accurate.
- The owner's ranges (**60–90 kg, 5'0–6'4**) are **validation cases** checked against published measurements, not a table of values.
- **Separate from food:** Today shows food eaten vs food goal (unchanged) and burned vs an **optional daily burn goal**. Burn does **not** raise the food budget.
- **Food goal:** the current default (Mifflin–St Jeor suggestion / manual in Me) stays. Add a quick **edit** on Today's goal as well.
- **Streaks:** food streak (D24, unchanged) and a workout streak, each in its own section. A **global streak** lights only on days both are hit.

## Open (Proposed, needs the owner)
- **Rest days:** a daily workout target would break the workout/global streak on every rest day. Proposal: the user picks gym days per week (default Mon–Sat). On a planned rest day the workout side counts as done. Freezes (D24) still cover missed gym days. Workout "hit" = burn goal met if one is set, else any workout logged.
- Is cardio part of phase 1? (Recommended: yes.)

## Research data (received + reviewed 2026-09-24)
Files: `data/exercises.json` (200 exercises, 20 activities, 12 "missing") and `data/burn-model.json` (142 Compendium METs, corrected-MET method, ACSM walking/running equations, 9 measured studies, 10 validation cases, timing, accuracy).

Checks done:
- All 200 `fedb_id`s exist in free-exercise-db (876 exercises); names match the intended exercise; every one has 2 photos. No duplicate ids.
- 25 METs spot-checked against pacompendium.com: all exact. Corrected-MET formula and Harris-Benedict constants: exact.
- Model vs published measurements (MET × 3.5 mL/kg/min × 5 kcal/L): bench/squat within 0–7 % at moderate loads; +20–29 % at heavy loads; −26 % to +25 % across machine exercises; whole session (Phillips 2003) −10 % men, −17 % women. So about ±25 %, as expected.

Gaps (known, accepted):
- Validation subjects are all men of 78–84 kg and 178–180 cm. There's no published open data for 60 kg, short/tall people or women.
- Bodyweight fractions only for push-up variants (Ebben 2011: 0.64 regular, 0.70/0.74 feet raised, 0.55/0.41 hands raised, 0.49 knees in "missing").
- ACSM cycling constant not sourced, so use Compendium watt codes. Surya namaskar is per minute only; rounds→minutes isn't sourced, so ask for minutes.
- 12 common exercises aren't in free-exercise-db (Bulgarian split squat, assisted pull-up machine, burpee, jumping jacks, wall sit, machine lateral raise…): add them without a photo (fallback art).
- `mets[].description` is paraphrased; use our own labels in the UI.

Calculation choices (from the review):
- **Gross** kcal/min = MET × 3.5 × kg × 5 / 1000 (the Compendium's own conversion). **Net** = gross − the person's resting burn per minute, using **Mifflin–St Jeor** (same equation as the food goal in `nutrition.ts`), not "MET − 1". This is where height, age and sex come in.
- The Compendium's corrected MET cancels out when converted back to kcal (noted in burn-model.json). It only matters for intensity labels, so it isn't used for kcal.
- Height changes the result by only ~1 kcal per exercise; body weight is the big factor. Weight lifted (kg) mainly matters for progress tracking: the studies show heavier sets burn *less* per minute (Mazzetti 2011, Scott 2011), so kg doesn't scale kcal directly.
- Time: rest-timer data if available, else sets × (reps × 3 s + 90 s rest). 3 s = midpoint of ACSM 2009's 1–2 s + 1–2 s tempo; 90 s = midpoint of the hypertrophy range, 60–120 s.
- MET per exercise (proposed): squat/deadlift family 02052 (5.0); kettlebell swings 02058 (9.8); bodyweight 02056 (3.0); other lifts 02054 (3.5); "intense / short rest / supersets" session 02050 (6.0) or circuit 02055 (5.8). Cardio: ACSM walking/running equations when speed (+ incline) is known, otherwise Compendium codes.

## Phases
1. Exercise library, workout log (kg × reps × sets), burn estimate, burned bar + burn goal on Today, quick food-goal edit, workout + global streaks.
2. Routines ("thalis for the gym": Push/Pull/Legs), last-session numbers beside each set, rest timer, PRs (estimated 1RM) with celebration.
3. Weekly sets per muscle + body heatmap, body measurements, private progress photos.

## Build notes
- New synced entities (`workouts`, later `routines`): follow the "Add a synced entity" checklist in [architecture.md](architecture.md).
- The natural-language logging work ([nl-logging.md](nl-logging.md)) also changes `store.ts`, `types.ts`, sync and migrations. Build this after that lands, or coordinate.
