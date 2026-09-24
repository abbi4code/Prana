# Prana (प्राण)

*Discipline, one katori at a time.*

A calorie tracker for Indian food. Log meals the way you actually eat them: by katori, roti, plate or scoop (or in grams). Works as a website on desktop and as an installable app on your phone, even offline, and syncs between them with Google sign-in.

## What it does

- **Fast logging:** Hinglish search over ~280 Indian foods, recent and frequent foods, a brass katori you can drag to set the amount, and **thalis** (saved meals) logged in one tap.
- **Real numbers:** values come from INDB 2024, IFCT 2017 (ICMR-NIN), USDA and official pack labels. Never made up.
- **Discipline:** a daily streak with forgiving freezes, a year heatmap, protein and water goals, and a weight trend.
- **Your data:** saved on the device first (works offline), synced to Supabase when signed in. You can also use it without an account.
- Dark and light themes; phone, tablet and desktop layouts.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
```

Without Supabase keys the app runs local-only. To enable sign-in and sync, see [`.claude/setup-auth.md`](.claude/setup-auth.md).

## Food data

- `data/foods.json` (researched dataset) and `data/foods-extra.json` (INDB/USDA/label additions): the sources.
- `npm run foods`: rebuilds `src/data/foods.generated.json`, which the app uses.

## Docs

Everything about how and why it's built this way lives in [`.claude/`](.claude/CLAUDE.md): start with `CLAUDE.md`, then `architecture.md`.
