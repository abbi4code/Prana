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
| Weekly Wrapped (D42) | Story cards Monday–Sunday (from Sunday 6 pm; earlier weeks on Progress), persona, habits/training/wins, share image drawn on the device (habits only) | done |
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
| Week strip details (D35) | Hover a day to peek at its workouts, click to stretch it open; first-run doodle hint toward Exercises | done |
| Activity rings (D33) | Burn today · Move + Strength this week vs WHO 2020 targets (150 min, 2 days), one dial; fine print behind (i) | done |
| Routines (D34) | Cards with photo collage, muscles, ~kcal, last done, "Up next", done-today progress; checklist sheet (tick = logged, edit sets inline, ↑ overload hint, ring + burst when done); Log all; builder with drag reorder + multi-select picker; starters Push / Pull / Legs / Full body; "Save as routine" from a session | done |
| PRs (D36) | Auto-detected per exercise (heaviest, est. 1RM, best set, reps, hold, assistance, cardio time/speed/distance); trophy banner on log, live "New PR" chip in the logger, 🏆 on session + routine rows and week days, Personal records card (latest + best for every exercise) | done |
| Achievements + badges (D38) | Own menu: tiered badges (bronze → diamond) for streaks, training and habits + one-offs, unlock banner, detail sheets; PR list moved here | done |
| Rest timer + last session per set (D40) | Tick a set's number → rest countdown pill above everything (±15, skip, buzz + beep); "last 50 kg × 10 ▲ +2.5 kg" under each set | done |
| Muscles this week (D41) | Front/back body shaded by weekly sets per muscle (fractional), bars with a 10-set mark | done |
| Body: measurements + progress photos (D39) | Progress → Body: 6 tape spots (synced), waist ÷ height, photos only on this device with before/after slider | done |

## v2.6: Gym check-in (D30, see gym-checkin.md)

| Feature | Notes | Status |
|---|---|---|
| Save your gym + "I'm at the gym" / Done with live timer | Server visits, one active per user, offline + guest fallback, live pill on Today | done (phase 1) |
| Location verification | Consent + explainer, permission states, server distance check, iOS notes, verified / not verified tags | done (phase 2) |
| Gym location | Current location + map picker (Leaflet/OSM, dark tiles), radius 100–300 m, gym settings sheet | done (phase 3) |
| Nearby banner, auto-close (+ fix end), 20-min minimum, visit counts as workout day, recent visits | Nearby check on the phone; lazy auto-close on the server | done (phase 4) |
| Edit / switch / remove your gym (D37) | Edit in place; switch keeps old visits with the old gym; "Edit" on the Gym card + Me → Your gym | done |
| Gym place search (D37) | Area or gym name + "Gyms nearby" (Geoapify via our server, cached, rate limited), then confirm/drag the pin | built; needs `GEOAPIFY_API_KEY` |

## Also built
| Feature | Status |
|---|---|
| Today greeting (D31): desi hype/funny line picked for the moment, tap for another | done (1,940 lines, all times of day + moments) |
| Multi-add: log several foods in one go, "Done · 3" | done |
| Edit / delete a logged item (tap it) | done |
| Calorie history chart (14 days) + days on target | done |
| Backup download (JSON) | done |
| "High estimate" badge for deep-fried items | done |
| Desktop + tablet layouts (sidebar, multi-column; Today: summary left, tiles + meals right from 1280 px, D32), keyboard shortcuts N (food), W (workout), / or ⌘K (add anything) | done |
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
- **Achievements** `/achievements` (D38; phone tab "Awards"): summary hero, Badges tab (12 tiered families + 9 one-offs, detail sheet per badge), Records tab (every PR, best for every exercise).
- **Me** `/me`: "Your energy" (D45: live resting burn, goal breakdown, refresh nudge), then goal calculator, daily goals, appearance, my foods, account/sync, backup.
- **Login** `/login`, **OAuth return** `/auth/callback`.
- **Weekly Wrapped** (D42): banner on Today (Sunday evening → Tuesday), card on Progress, full-screen stories.

## v3: Akhada (D46, D47, see social.md)

| Feature | Notes | Status |
|---|---|---|
| Opt-in profile | Consent card (what's shared / never shared), display name + @handle (live check, abuse filter), avatar presets, listed or friends-only, 18+ | built |
| Friends | @handle requests, invite links (friends at once), search, block, report, inbox | built |
| Leaderboard | Friends / Everyone × this/last week, this/last month; active days → effort → verified days; streak shown; trust gate; server-computed | built |
| Challenges | Lift target, gym days, active minutes, team goal; invite / link / open; ✓ verified, big-jump flag, disputes | built |
| Weekly duels (D48) | 1v1, 7 days, best 6 days of effort, day-by-day face-off, rematch | built |
| Results + badges (D49) | Settle 3 days after the end, podium + your place, notifications, Finisher / Champion / Duel master / Shabaash badges, share cards | built |
| Kudos + nudges (D49) | 🔥 Shabaash on a friend's active day, 👋 nudge after 3 quiet days (opt-out) | built |
| Leagues, squads, gym boards, video proof, push notifications, moderation screen | Next phases | planned |

## Explicitly not building (for now)

Social feed (Akhada has boards + challenges, no feed) · recipe pages. See [future.md](future.md).
