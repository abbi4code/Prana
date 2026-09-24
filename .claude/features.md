# Features

Status: `planned` · `in progress` · `done` · `dropped`

Guiding rule: **logging fast beats everything.** People quit trackers because logging is tedious, not because the app looks plain.

## v1: Core daily use

| Feature | Notes | Status |
|---|---|---|
| Auth + sync | Google sign-in, login screen, guest mode, offline-first sync, sync status in Me/sidebar | built + backend live; needs a real sign-in test |
| Today screen | Calories-left ring, macro bars, week date strip, meals listed below | done |
| Meal slots | Breakfast · Lunch · Chai & Snacks · Dinner (D10); defaults by time of day | done |
| Food search | Hinglish + aliases + Hindi names; category-aware ranking | done |
| Recent & frequent foods | Shown before typing; remembers your last portion per food | done |
| Visual katori picker | Brass katori fills and heaps past 1; glass for drinks; stack for pieces; kcal counts up live; grams input | done |
| Copy yesterday / "My usual" | "Same as yesterday" per meal: done. "My usual" saved meals: planned | partly done |
| Daily goals | Manual, or suggested from profile (Mifflin–St Jeor) | done |
| Weight log | Daily entry, 7-day average trend line | done |
| Water | Tap to add a glass | done |
| PWA install | Manifest, icons, service worker, offline logging | done (verify on a real phone after deploy) |

## v1.5: Features for Indian food (what makes it unique)

| Feature | Notes | Status |
|---|---|---|
| Thali builder | Drop roti/dal/sabzi/rice into an illustrated thali; save as a named thali; log in one tap. **Signature feature.** | planned |
| Home vs restaurant toggle | Oil/ghee multiplier (~1.5–2×) for dhaba/restaurant food | planned |
| Hidden-calorie chips | "+ ghee on roti", "+ tadka", "+ sugar in chai" | planned |
| Chai counter | One-tap card on Today; home chai derived from IFCT milk + sugar (89 kcal/cup) | done |
| Year heatmap | GitHub-style grid of on-target days | planned |
| Forgiving streaks | Streak freezes included | planned |
| Smart swaps | e.g. "2 phulka instead of puri saves ~140 kcal" | planned |

## v2: Engagement + AI

| Feature | Notes | Status |
|---|---|---|
| Weekly Wrapped | Swipeable recap cards every Sunday, shareable as images | planned |
| Weekly calorie bank | Save calories on weekdays for weekends/festivals | planned |
| Festival / shaadi mode | Celebration days don't break streaks | planned |
| Fasting mode | Navratri, Ekadashi, intermittent fasting; vrat foods first in search | planned |
| Hinglish voice logging | "do roti, ek katori dal" → parsed and logged | planned |
| Thali photo logging | Photo → suggested items + katori counts, confirm in one tap | planned |
| Barcode scan | Packaged foods | planned |

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

## Screens

- **Today**: ring, macros, meal sections, chai counter, water
- **Log sheet** (from the + button): search, recents, katori picker, thali builder
- **Progress**: weight trend, calorie history, heatmap, Wrapped
- **Me**: goals, profile, units, settings

## Explicitly not building (for now)

Social feed · recipe pages · workout tracking. See [future.md](future.md).
