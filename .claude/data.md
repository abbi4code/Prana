# Food Dataset

## Files

| File | What |
|---|---|
| `data/foods.json` | Research dataset v2 (227 foods). Source of truth; edit this, not the generated file |
| `data/foods-extra.json` | 52 foods added later (INDB codes, USDA fdcIds, derived chai). Built by `node scripts/import-extra.mjs <INDB.xlsx>` (D22) |
| `src/data/foods.generated.json` | App catalog built by `npm run foods` from both files (276 foods after exclusions) |

Older files (`foods.json` v1, `foods (1).json`) were deleted on 2026-09-24.

All were produced by browser Claude from the research prompt. Schema: `meta` + `foods[]` with `per_100g`, `units[]`, `source`, `confidence`, `aliases`, `name_hi`, `notes`, `image_prompt`.

## Sources actually used
- **INDB** (188 foods): `INDB.xlsx` from github.com/lindsayjaacks/Indian-Nutrient-Databank-INDB- (1,014 recipes). Unit grams derived as per-serving kcal ÷ per-100g kcal × 100, or corrected to a realistic single portion (estimated, noted per food).
- **IFCT 2017** (38 foods): via npm `@ifct2017/compositions`, kJ → kcal ÷ 4.184. Pure fats (ghee, oil) have no energy in IFCT, so they are derived as 9 kcal/g fat.
- **USDA FoodData Central, SR Legacy** (7 foods in foods-extra): dahi (171284), sugar (169655), honey (169640), butter (173410), white bread (174924), brown bread (172688), cheese slice (170853), cola (174852). Fetched from the FDC API; unit weights are estimated household measures.
- **USDA 173180** "Protein powder, whey based": Whey Protein Powder (352 kcal, 78 g protein per 100 g; scoop 30 g = 106 kcal, 23 g protein). Brand scoops vary (30–36 g): users can create their brand from its label.
- **DERIVED** (4): chai with / without sugar = IFCT whole cow milk (L002) + USDA sugar, per 150 ml cup; whey shake with water (1 scoop + 250 ml = 106 kcal) and with milk (1 scoop + 250 ml whole milk ≈ 258 g = 294 kcal, 32 g protein). Creatine adds 0 kcal, so "whey + creatine" searches land on the shakes.
- **Manufacturer label** (creatine): Optimum Nutrition Micronized Creatine, India site: 3 g scoop, 0 kcal, 0 carbs.
- **Manufacturer label, read from the official nutrition-facts images** (Yogabar / Sproutlife Foods, yogabars.in): Choco Almond Protein Muesli, Dark Chocolate & Filter Kaapi Protein Oats, Dark Choco Cranberry Muesli, plus "with milk" rows from the label's own per-serve-with-milk column. The pasted research had kcal = null (panel only exists as images); the label images were downloaded from the Shopify CDN and transcribed. Corrections vs that research: muesli serving is 50 g (not 40), the Dark Choco Cranberry muesli *does* have added sugar (8.8 g/100 g). Method for other brands: `yogabars.in/products/<handle>.json` → nutrition-facts image → read.
- New category `cereal` ("Oats & muesli", cereal-bowl art).
- **Manufacturer label** (1 food): Maggi, from maggi.in. Amul, Parle, Coca-Cola and Haldiram's pages couldn't be read, so those items were omitted.
- Not accessible: the ICMR-NIN household-measures table, so **all katori/serving weights are estimates**.

## Rules for data (see D03 in decisions.md)
- Values per 100 g. Unknown = `null`, never `0`.
- Every food has `source` + `confidence` (`high` / `medium` / `low`).
- Macro check: `4P + 4C + 9F` within ±15% of `kcal`. If not, macros are set to `null` and the food is marked `low`.
- Unit names are normalized by the seed script (D07).

## v2 review (2026-09-24)

**Summary:** 227 foods (48 high, 155 medium, 24 low confidence). Valid JSON, no duplicate ids, every `default_unit` exists, every food has aliases and a specific `image_prompt`. New `soup` category.

**Fixed since v1:**
- Soups: macros that didn't match kcal are now `null`, and the foods are marked `low`.
- Murmura and chiwda: re-sourced from IFCT dry values (~355 kcal/100g).
- Serving weights corrected: chilla, pesarattu, omelette (2 eggs), pulao, soups, rasam.
- Katori unit added to poha, upma and chowmein.
- `khaman-dhokla` removed (bad INDB row).
- Chai and lassi kept at the INDB value, but marked `low` with an explanatory note.

**Still needs handling** (✓ = handled by `scripts/build-foods.mjs` / the app):

| Issue | Foods | Proposed handling |
|---|---|---|
| Deep-fried items use full frying oil, so they're over-counted ~1.5–2.5× | samosa (346/pc), kachori (392), poori (221), **bhatura (635)**, medu vada (335), dahi vada (401), pakora, gulab jamun, fried fish (527), besan-kadhi-pakodi (605/katori) | ✓ Shown with "~" + "high estimate" note (D16). Real fix still open (Q4) |
| Mislabeled "deep-fried" | `pav-bhaji` (96.5 kcal/100g), `onion-uttapam` (462/100g, not deep-fried; value suspicious) | ✓ pav-bhaji not badged; onion-uttapam excluded |
| Suspicious values | `plain-dosa` 381/100g (high), `paneer-tikka` 94/100g (paneer alone is ~258), `hot-tea` 24 kcal/cup (too low for home chai) | ✓ dosa + paneer-tikka excluded. Chai still open (Q6) |
| Stale caveat | `meta.caveats` still says packaged foods aren't included, but Maggi is | ✓ `meta` isn't shipped to the app |
| Inconsistent unit names | 33 names | ✓ D07 |

**Added 2026-09-24 (foods-extra):** jeera rice, matar pulao, bhindi… (see file). Chicken & mutton pulao were rejected (macros 30% off kcal). Recipe-yield servings (e.g. 668 g "plate") replaced with standard portions.

**Still missing (use Create food for packaged ones):**
- **Basics:** toned milk (label only; aggregator values not allowed), papad
- **Dishes:** chicken biryani, missi roti, plain lauki/palak/mixed-veg sabzi, paneer bhurji, chicken tikka (none in INDB)
- **Street food & sweets:** aloo tikki, vada pav, pani puri, momos, jalebi, barfi
- **Packaged:** Parle-G and other brands → Create food

Most of the basics are single-ingredient IFCT items or printed on packet labels, so they're easy to fill (see future.md).
