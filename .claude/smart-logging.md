# Smart logging: barcode scan + thali photo (research, 2026-09-25)

Not built. Both wait for the owner's decisions below (they touch hard rules: sources of numbers, the LLM rule). Order: after the engagement features ([engagement.md](engagement.md)).

## Decisions needed (Proposed)
1. **Open Food Facts as a source for packaged foods?** It's volunteer-typed label data (ODbL), with the nutrition-panel photo per product; no accuracy guarantee. Proposal: allowed **only after the user confirms it against the pack/photo** ("Matches my pack?"), stored in a separate table with `source = off` + product URL, never logged silently.
2. **Reading numbers from a label photo** (vision model copies the FSSAI nutrition panel) bends "the LLM never produces nutrition numbers". Proposal: allowed as *transcription*, never estimation: photo shown beside every field, the user confirms each number, 4P + 4C + 9F check, `source = label_photo`. Or keep manual entry only.
3. **Thali photos go to OpenAI (US)**: one-time notice, never stored, EXIF stripped, `store: false` (+ apply for Zero Data Retention).

## Barcode
- **Scanning:** native `BarcodeDetector` only on Android Chrome (+ macOS/ChromeOS desktop Chrome); iOS Safari: disabled by default → needs a fallback. Use the **`barcode-detector`** ponyfill (MIT, native when present, else ZXing-C++ wasm ~1 MiB, self-host the wasm, lazy-load). `@zxing/*` is in maintenance mode, `html5-qrcode` unmaintained since 2023. Formats ean_13 / ean_8 / upc_a / upc_e; 2 identical reads + GTIN check digit; back camera ~720p, centre crop; fallbacks: still photo (`<input capture>`) and manual code entry. iOS home-screen apps: `getUserMedia` works since 13.4; permission may be re-asked (keep the camera on one route, no hash changes).
- **Data:** OFF India: 23,158 products, 9,817 (42%) with nutrition completed, 66 fully complete (live API, 2026-09-25). API limits 15 product reads/min/IP (shared on Vercel → server cache essential; bulk export nightly at scale), custom User-Agent required, attribution "Open Food Facts (ODbL)", keep OFF-derived rows in a separate table (share-alike). GS1 India DataKart (brand-uploaded, 42M+) needs company registration + fees, no public API. FSSAI: no public product database. USDA branded: US/NZ only. **FatSecret, Nutritionix, Edamam, Chomp: aggregators → against the rule.**
- **FSSAI labels** (Labelling & Display Regs 2020, reg 5(3)(b)): energy, protein, carbs, total + added sugar, fat, sat/trans fat, sodium per 100 g/ml (+ per serve); declared values may be ≤ 10 % below actual (5(3)(d)); small packs ≤ 100 cm² exempt.
- **Proposed flow:** scan → our `packaged_products` table → `/api/barcode/[code]` (OFF, cached) → confirm against pack → else label photo / custom food.

## Thali photo
- **Model:** `gpt-6-luna` takes images (text + image in, text out; Structured Outputs). Detail `high`, long edge 1024 px JPEG 0.8 ≈ 922 image tokens (multiplier for luna not published; 1.2 assumed) → **≈ $0.0005–0.0008 per photo**. `store` defaults to true: send `store: false`.
- **Accuracy (published):** dish recognition good (ChatGPT precision 93 %, recall 85 %, Nutrients 2025 PMC11858203); **portions weak: ~28–36 % weight error, mostly underestimated** (76 % of meals; CDN 2025 PMC12513282). Context helps (descriptions, time, location). No published LLM study on Indian thalis. → counts must be confirmed; card says "AI usually undercounts".
- **Capture:** `<input type="file" accept="image/*" capture="environment">` (camera or gallery, no permission prompt); always re-encode: `createImageBitmap(..., imageOrientation: "from-image")` → canvas → JPEG (strips EXIF/GPS; handles HEIC edge cases).
- **Rule kept:** schema `{is_food, items[{name, qty, unit (enum), confidence, alternatives}]}`: no field for kcal; ignore text in the image (prompt injection); mixed plates split into parts; device matches + computes as today; cache by image SHA-256 (never the image); stricter per-user quota than text.
- **Eval:** `npm run eval:photo` on 40–60 of the owner's labelled photos (+ non-food + injected text): item recall/precision, count error split over/under.
- **Privacy:** DPDP Rules 2025 duties apply from 13 May 2027; don't store photos; one-time notice.
