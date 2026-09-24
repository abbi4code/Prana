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
| Hinglish voice + text logging | "2 roti aur dal for dinner" → confirm card → log; mic fills the same box (D26, nl-logging.md) | done (voice: verify on real phones) |
| Thali photo logging | Photo → suggested items + katori counts, confirm in one tap | planned |
| Barcode scan | Packaged foods | planned |

## v2.5: Workouts (D26, see workouts.md)

| Feature | Notes | Status |
|---|---|---|
| Exercise library | ~150–200 exercises with photos (free-exercise-db), muscle + equipment filters, alias search; cardio + sports | planned |
| Workout log | Sets × reps × kg per exercise; bodyweight exercises by body-weight fraction | planned |
| Calorie burn | Compendium MET × time, corrected for the person; own bar + optional daily burn goal; separate from food | planned |
| Quick food-goal edit on Today | Default stays the goal calculator's suggestion | planned |
| Workout + global streaks | Global lights when food and workout are both hit | planned |
| Routines, last-session hints, rest timer, PRs | Phase 2 | planned |
| Weekly volume + body heatmap, measurements, progress photos | Phase 3 | planned |

## Also built
| Feature | Status |
|---|---|
| Multi-add: log several foods in one go, "Done · 3" | done |
| Edit / delete a logged item (tap it) | done |
| Calorie history chart (14 days) + days on target | done |
| Backup download (JSON) | done |
| "High estimate" badge for deep-fried items | done |
| Desktop + tablet layouts (sidebar, side panel, multi-column), keyboard shortcut N / | done |
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
- **Progress** `/progress`: streak card, year heatmap, weight (7-day avg), calories last 14 days.
- **Me** `/me`: goal calculator, daily goals, appearance, my foods, account/sync, backup.
- **Login** `/login`, **OAuth return** `/auth/callback`.
- Planned: Weekly Wrapped (Progress), voice logging (log sheet).

## Explicitly not building (for now)

Social feed · recipe pages · workout tracking. See [future.md](future.md).
