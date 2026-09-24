# Food Dataset

## Files

| File | What |
|---|---|
| `data/foods.json` | Research dataset v2 (227 foods). Source of truth; edit this, not the generated file |
| `src/data/foods.generated.json` | App catalog built by `npm run foods` (224 foods after exclusions) |

Older files (`foods.json` v1, `foods (1).json`) were deleted on 2026-09-24.

All were produced by browser Claude from the research prompt. Schema: `meta` + `foods[]` with `per_100g`, `units[]`, `source`, `confidence`, `aliases`, `name_hi`, `notes`, `image_prompt`.

## Sources actually used
- **INDB** (188 foods): `INDB.xlsx` from github.com/lindsayjaacks/Indian-Nutrient-Databank-INDB- (1,014 recipes). Unit grams derived as per-serving kcal ÷ per-100g kcal × 100, or corrected to a realistic single portion (estimated, noted per food).
- **IFCT 2017** (38 foods): via npm `@ifct2017/compositions`, kJ → kcal ÷ 4.184. Pure fats (ghee, oil) have no energy in IFCT, so they are derived as 9 kcal/g fat.
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

**Still missing:**
- **Basics:** plain dahi, toned milk, sugar, honey, butter, bread slice, cheese slice, papad
- **Dishes:** jeera rice, chicken biryani, missi roti, plain bhindi/lauki/palak/mixed-veg sabzi, kadai paneer, paneer bhurji, chicken tikka
- **Street food & sweets:** aloo tikki, vada pav, pani puri, momos, jalebi, barfi
- **Packaged:** Parle-G, Amul butter, cola

Most of the basics are single-ingredient IFCT items or printed on packet labels, so they're easy to fill (see future.md).
