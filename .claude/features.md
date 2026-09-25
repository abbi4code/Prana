# Features

Status: `planned` · `in progress` · `done` · `dropped`

Guiding rule: **logging fast beats everything.** People quit trackers because logging is tedious, not because the app looks plain.

## v1: Core daily use

| Feature | Notes | Status |
|---|---|---|
| Auth + sync | Google sign-in, login screen, guest mode, offline-first sync, sync status in Me/sidebar | done (owner confirmed sign-in works) |
| Today screen | Calories-left ring, macro bars, week date strip, meals listed below | done |
| Meal slots | Breakfast · Lunch · Chai & Snacks · Dinner (D10); defaults by time of day | done |
| Food search | Hinglish + aliases + Hindi names; category-aware ranking | done |
| Recent & frequent foods | Shown before typing; remembers your last portion per food | done |
| Visual katori picker | Brass katori fills and heaps past 1; glass for drinks; stack for pieces; kcal counts up live; grams input | done |
| Copy yesterday / "My usual" | "Same as yesterday" per meal + saved thalis (D25) | done |
| Daily goals | Manual, or suggested from profile (Mifflin–St Jeor) | done |
| Weight log | Daily entry, 7-day average trend line | done |
| Water | Tap to add a glass | done |
| PWA install | Manifest, icons, service worker, offline logging | built; owner verifies on a phone after deploying |

## v1.5: Features for Indian food (what makes it unique)

| Feature | Notes | Status |
|---|---|---|
| Thali builder | Illustrated steel thali, save a named meal, one-tap log from the add sheet or an empty meal card (D25) | done |
| Home vs restaurant toggle | Oil/ghee multiplier (~1.5–2×) for dhaba/restaurant food | planned |
| Hidden-calorie chips | "+ ghee on roti", "+ tadka", "+ sugar in chai" | planned |
| Chai counter | One-tap card on Today; home chai derived from IFCT milk + sugar (89 kcal/cup) | done |
| Year heatmap | 53-week grid, tap a day for details (D24) | done |
| Forgiving streaks | Flame badge on Today, streak card, freezes every 7 days (max 2) (D24) | done |
| Smart swaps | e.g. "2 phulka instead of puri saves ~140 kcal" | planned |

## v2: Engagement + AI

| Feature | Notes | Status |
|---|---|---|
| Weekly Wrapped | Swipeable recap cards every Sunday, shareable as images | planned |
| Weekly calorie bank | Save calories on weekdays for weekends/festivals | planned |
| Festival / shaadi mode | Celebration days don't break streaks | planned |
| Fasting mode | Navratri, Ekadashi, intermittent fasting; vrat foods first in search | planned |
| "Add anything" bar (D29) | One search on Today for food + workouts; + adds the shown portion / repeats last session with Undo; recents, thalis, sentences and voice in the same box | done |
| Hinglish voice + text logging | "2 roti aur dal for dinner", "bench 3x10 60kg aur 20 min walk", "kal raat…" → one confirm card (food + workouts, today/yesterday) → log; mic in both sheets (D26, nl-logging.md) | done (voice: verify on real phones) |
| Thali photo logging | Photo → suggested items + katori counts, confirm in one tap | planned |
| Barcode scan | Packaged foods | planned |

## v2.5: Workouts (D27, see workouts.md)

| Feature | Notes | Status |
|---|---|---|
| Exercise library | 211 exercises (200 with start/end photos from free-exercise-db), muscle + sub-muscle + equipment filters, alias search, recents | done |
| Workout log | Sets × reps × kg (seconds for holds), "last time" pre-fill, rest + pace, edit / swipe-delete + undo | done |
| Cardio & sports | 20 activities: walk/run by speed + incline (ACSM), bike/rower/elliptical/skipping/swim/cricket/badminton/football/yoga/surya namaskar/HIIT/zumba by effort | done |
| Calorie burn | Lifts: measured per-rep costs (weight × reps, v2); cardio + core: Compendium MET × time; minus resting burn; Burned card + optional daily burn goal; separate from food | done |
| Today: Eaten · Burned · Net · Goal | Goal kcal editable inline (default stays the goal calculator) | done |
| Workout week strip | 🔥 / 🌙 / ❄️ / 🥲 per day, streak band, weekly count; "Exercises" shows each day's exercises (list on phone, calendar on desktop) | done |
| Workout + global streaks | Rest days picked by the user; global "Prana streak" = food on target + workout done; heatmap Food/Workout/Both | done |
| Routines, rest timer, PRs, last-session beside each set | Phase 2 | planned |
| Weekly volume + body heatmap, measurements, progress photos | Phase 3 | planned |

## v2.6: Gym check-in (D30, see gym-checkin.md)

| Feature | Notes | Status |
|---|---|---|
| Save your gym + "I'm at the gym" / Done with live timer | Server visits, one active per user, offline + guest fallback, live pill on Today | done (phase 1) |
| Location verification | Consent + explainer, permission states, server distance check, iOS notes, verified / not verified tags | done (phase 2) |
| Gym location | Current location + map picker (Leaflet/OSM, dark tiles), radius 100–300 m, gym settings sheet | done (phase 3) |
| Nearby banner, auto-close (+ fix end), 20-min minimum, visit counts as workout day, recent visits | Nearby check on the phone; lazy auto-close on the server | done (phase 4) |

## Also built
| Feature | Status |
|---|---|
| Today greeting (D31): desi hype/funny line picked for the moment, tap for another | done (batches 1–4, 1,125 lines; moment batches 5–7 to generate) |
| Multi-add: log several foods in one go, "Done · 3" | done |
| Edit / delete a logged item (tap it) | done |
| Calorie history chart (14 days) + days on target | done |
| Backup download (JSON) | done |
| "High estimate" badge for deep-fried items | done |
| Desktop + tablet layouts (sidebar, multi-column), keyboard shortcuts N (food), W (workout), / or ⌘K (add anything) | done |
| Desktop log sheets as centred modals; workout picker two-pane (library + logger side by side) (D28) | done |
| Create your own food (from a packet label; per serving or per 100 g), synced; "My foods" in Me | done |
| ~40 more foods: dahi, sugar, bread, butter, honey, jeera rice, kadhai paneer, khichdi, raitas, burfi, sandwiches… | done |
| Light theme + Appearance setting (System / Light / Dark) | done |
| Category illustrations (katori, kulhad, roti stack, samosa, laddoo…) | done |
| Swipe-to-delete with Undo toast | done |
| Drag the katori to change amount | done |
| Odometer numbers, shared icon transition, new-item glow, page transitions | done |
| Celebrations: protein goal, water goal | done |
| Supplements: whey protein (scoop), creatine, whey shake with water / milk (whey + creatine findable) | done |
| Packaged breakfast: Yogabar protein oats (Dark Chocolate, Filter Kaapi) + muesli (Choco Almond protein, Dark Choco Cranberry), dry and with milk | done |

## Screens (as built)

- **Today** `/`: week strip + streak flame, calorie ring (rolling digits), macro bars, chai + water cards, 4 meal cards (swipe rows, save-as-thali, ⚡ thali chips, "same as yesterday").
- **Log sheet** (+ button, or N / on desktop): meal chips, search, My thalis, recent/frequent/popular, create food → food detail (drag katori, units, meal) · thali builder · create food.
- **Workout** `/workout`: week strip + workout flame, Burned card, Exercise/Cardio buttons, session list, workout streak, workout goals (burn goal, rest days). Sheet: library → lift / cardio detail.
- **Progress** `/progress`: bento grid: Prana, food and workout streak cards in one row (equal heights), full-width year heatmap (Food/Workout/Both; tapping a day lists its workouts), weight (7-day avg) | calories last 14 days (equal heights, goal line always visible).
- **Me** `/me`: goal calculator, daily goals, appearance, my foods, account/sync, backup.
- **Login** `/login`, **OAuth return** `/auth/callback`.
- Planned: Weekly Wrapped (Progress), voice logging (log sheet).

## Explicitly not building (for now)

Social feed · recipe pages. See [future.md](future.md).
