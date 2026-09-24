# Prana (प्राण)

*Discipline, one katori at a time.*

A calorie tracker for Indian food. Log meals in katori, roti and plate, or in grams. Works on laptop and phone (installable PWA), even offline.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
```

Phone on the same Wi-Fi: open `http://<your-laptop-ip>:3000`. To install it to the home screen, deploy it first (e.g. Vercel), because the offline service worker needs HTTPS.

## Food data

- `data/foods.json`: researched dataset (INDB 2024 + IFCT 2017). Edit this file.
- `npm run foods`: rebuilds `src/data/foods.generated.json`, which the app uses.

## Docs

Project decisions, features, backlog and data notes are in [`.claude/`](.claude/CLAUDE.md).
