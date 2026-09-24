# Future Changes & Open Questions

## Open questions (need the owner's call)

| # | Question | Notes |
|---|---|---|
| ~~Q1~~ | ~~App name?~~ | **Resolved 2026-09-24: "Prana"** (D19) |
| Q2 | Sign off "Modern Masala" visual identity (D08)? | Built into the app, so it can be judged on a real phone |
| Q3 | Sign off meal slots (D10)? | Units (D07) are done |
| Q4 | How to handle fried foods (samosa, puri, pakora, jalebi, namkeen)? | INDB counts the *full* frying oil, not the absorbed amount. For now the app shows them with "~" and a "high estimate" note (D16). Options for a real fix: (a) use INDB value with a documented absorbed-oil adjustment, flagged `low`; (b) find a published absorbed-oil study; (c) manufacturer label for packaged namkeen. |
| Q5 | Food images: AI-generated illustrations vs photos? | D11 proposes illustrations |
| ~~Q6~~ | ~~Chai value~~ | **Resolved:** derived chai (80 g milk + 8 g sugar per 150 ml cup = 89 kcal) + no-sugar variant (D22) |
| ~~Q7~~ | ~~Missing basics~~ | **Resolved:** USDA values for dahi/sugar/honey/butter/bread/cheese/cola (D22); packaged items (toned milk, Parle-G…) via custom foods (D21) |

## Planned future changes

| Change | Why / notes |
|---|---|
| **Test real Google sign-in (owner)** | Backend is set up; restart `npm run dev`, sign in, log a food, check it appears in Supabase `food_logs` and on a second device |
| Realtime sync | Today sync runs on edit/focus/reconnect; Supabase Realtime could push changes instantly to other open devices |
| Deploy to Vercel | Needed to install the PWA on a phone (service worker requires HTTPS) |
| Real food illustrations (D11) | Category icon tiles are placeholders |
| Import the **full INDB.xlsx** (1,014 recipes) with a script | More reliable than having a chat copy rows. Source: github.com/lindsayjaacks/Indian-Nutrient-Databank-INDB- |
| Import the **full IFCT 2017** via `@ifct2017/compositions` (542 foods) | Raw ingredients, fruits, dairy |
| Add packaged foods from labels | Maggi, Parle-G, Amul butter, bread, cola, etc. |
| User-created custom foods | For anything missing, marked as user-sourced |
| Fill dataset gaps | See "Missing foods" in [data.md](data.md) |
| Capacitor wrapper | Only if App Store/Play Store presence or native features are needed |
| AI features | Hinglish voice logging, thali photo recognition (Claude vision) |

## Parked (not now)

- Social feed / friends
- Recipe pages
- Workout / step tracking (could add Google Fit / Apple Health import later)

## Change log

| Date | Change |
|---|---|
| 2026-09-24 | Project docs created; `foods.json` v1.0 (120 foods) reviewed |
| 2026-09-24 | `foods (1).json` (176 foods) reviewed: superset of `foods.json`, earlier issues not fixed. See data.md |
| 2026-09-24 | `foods_v2.json` (227 foods) reviewed: most v1 issues fixed; fried-food values, a few suspicious rows and ~25 missing items remain. Now the working file |
| 2026-09-24 | Moved to `data/foods.json`, old files deleted. v1 app built: Next.js 16, local-first, PWA; 224 foods in catalog |
| 2026-09-24 | Desktop/tablet layouts (D17). Google sign-in + sync built (D18) |
| 2026-09-24 | Supabase project `fitness` set up via CLI: migration pushed, Google provider + redirect URLs pushed |
| 2026-09-24 | Renamed to Prana (D19). Food data +41 (D22), custom foods (D21, migration `20260924120000_custom_foods` pushed), design pass: light theme, illustrations, gestures, celebrations (D20, D23) |
