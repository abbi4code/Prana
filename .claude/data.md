# Food Dataset

Exercise and calorie-burn data (free-exercise-db, Compendium 2024, ACSM, lifting energy studies in `data/lift-energy.json` + `data/lift-energy-2.json`) is documented in [workouts.md](workouts.md), not here.

## Files

| File | What |
|---|---|
| `data/foods.json` | Research dataset v2 (227 foods). Source of truth; edit this, not the generated file |
| `data/foods-extra.json` | 52 foods added later (INDB codes, USDA fdcIds, derived chai). Built by `node scripts/import-extra.mjs <INDB.xlsx>` (D22) |
| `data/foods-research.json` | Foods from browser-Claude research that passed `scripts/check-research.mjs` (numbers re-read from the sources; D52 fried rows with `replaces` take over an old id). Written by the checker with `--write`, never by hand |
| `data/research/` | `PROMPT.txt` (food), `PROMPT-ALCOHOL.txt`, `FOLLOWUP-*.txt`, the raw replies `batch-*.json`, `fdc-cache.json` (USDA answers kept for provenance) |
| Supabase `shared_foods` | Foods approved in the admin panel after the build (D54 phase 2, [food-requests.md](food-requests.md)); same source rules, same checker rules (server gate `src/server/foods/schema.ts`); downloaded by every device, no deploy |
| `src/data/foods.generated.json` | App catalog built by `npm run foods` from the three files above (329 foods on 2026-09-30) |

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
| Deep-fried items use full frying oil, so they're over-counted ~1.5–2.5× | samosa (346/pc), kachori (392), poori (221), **bhatura (635)**, medu vada (335), dahi vada (401), pakora, gulab jamun, fried fish (527), besan-kadhi-pakodi (605/katori) | ✓ Shown with "~" + "high estimate" note (D16). Real fix: D52 absorbed-oil model; samosa, kachori, bhatura rebuilt, the rest listed in future.md |
| Mislabeled "deep-fried" | `pav-bhaji` (96.5 kcal/100g), `onion-uttapam` (462/100g, not deep-fried; value suspicious) | ✓ pav-bhaji not badged; onion-uttapam excluded |
| Suspicious values | `plain-dosa` 381/100g (high), `paneer-tikka` 94/100g (paneer alone is ~258), `hot-tea` 24 kcal/cup (too low for home chai) | ✓ dosa + paneer-tikka excluded. Chai still open (Q6) |
| Stale caveat | `meta.caveats` still says packaged foods aren't included, but Maggi is | ✓ `meta` isn't shipped to the app |
| Inconsistent unit names | 33 names | ✓ D07 |

**Added 2026-09-24 (foods-extra):** jeera rice, matar pulao, bhindi… (see file). Chicken & mutton pulao were rejected (macros 30% off kcal). Recipe-yield servings (e.g. 668 g "plate") replaced with standard portions.

**Still missing (checked against the catalog 2026-09-30; use Create food for packaged ones):**
- **Basics:** toned milk (label only; aggregator values not allowed), papad
- **Dishes:** missi roti, plain lauki / palak / mixed-veg sabzi, paneer bhurji, chicken tikka (none in INDB)
- **Sweets:** jalebi
- **Packaged:** Parle-G and other brands → Create food
- Added since the v2 review: chicken biryani, aloo tikki, vada pav, pani puri, momos (research batches below); barfi exists as plain / besan burfi.

Most of the basics are single-ingredient IFCT items or printed on packet labels, so they're easy to fill (see future.md).

**Macro check with the source's own factors (2026-10-01):** the check (4P + 4C + 9F within 15 % of kcal) wrongly failed USDA SR Legacy foods whose energy USDA computes with food-specific factors: sweet corn (fdcId 169999) gives 111 kcal by 4 / 4 / 9 but USDA states 96, computed with corn's 2.44 / 3.57 / 8.37 kcal per g (protein / carbs / fat; carbs include fibre). Now the checker reads USDA's "Calories From Proximates" factors (API `nutrientConversionFactors`; local SR Legacy CSVs `food_calorie_conversion_factor.csv` + `food_nutrient_conversion_factor.csv`) and uses them when present (corn: 95.8 vs 96, passes); else 4 / 4 / 9 as before (FNDDS has none). Accepted rows keep them (`per_100g.energy_factors` → Food `ef`), and the shared-food gate (`server/foods/schema.ts`) rebuilds the energy the same way. Rows already in `data/research/fdc-cache.json` were cached without factors: delete a food's entry there to refetch it.

## Adding foods at scale: browser-Claude research (2026-09-28)

The catalog had 276 foods; the owner wants the thousands of everyday dishes it lacks (chicken biryani, pani puri, ice cream, fries, chaat, air-fried chicken…). Same idea as greetings.md:
1. Paste **`data/research/PROMPT.txt`** into browser Claude; one batch per reply ("next" / "continue"). Refresh its EXISTING FOODS list before a new round (generated from the data files).
2. Save each reply as `data/research/batch-N.json` (parts: `batch-N-2.json`).
3. `FDC_DIRS="<fndds dir>:<sr legacy dir>" node --env-file-if-exists=.env scripts/check-research.mjs /path/to/INDB.xlsx` → report; add `--write` to write `data/foods-research.json` (read by `build-foods.mjs`) and merge `alias_suggestions` into `data/aliases.json`. Then `npm run foods` and `npm run eval:parse`.

**Source files on this machine:** none since 2026-09-30. `INDB.xlsx` and the FNDDS / SR Legacy CSV folders lived in a temporary session folder (`/private/tmp/…`) that has since been wiped. For the laptop checker, download them again (INDB: `github.com/lindsayjaacks/Indian-Nutrient-Databank-INDB-/raw/main/INDB.xlsx`; USDA: fdc.nal.usda.gov/download-datasets, the FNDDS survey and SR Legacy CSV zips) into a permanent folder outside the repo, e.g. `~/files/datasets/`. The server research agent doesn't need them (it downloads INDB and uses the USDA API). `USDA_API_KEY` is in `.env`.

**Conventions the checker understands:** `fat_ref: "JPS2024:<food>:<temp>:<cycle>"` for the D52 anchor study (browser Claude can't open it; the table is in the checker), ingredient `source.id: "FOOD"` = another research food (listed earlier) or a catalog food by id (combos: pani puri from golgappa shells), `frying` inside or next to `recipe`, file names `batch-<anything>.json`. **Replies over ~50,000 characters don't fit in the chat: save them straight into the file.**

**Where the rules live (2026-09-30):** `src/lib/research/check.ts` (one food) + `shape.ts` (research row → app food), shared by this script, `scripts/build-foods.mjs` and the server research agent (D54 phase 3, [food-requests.md](food-requests.md)); a refactor must leave the report and `data/foods-research.json` identical on all batches. On the server the same rules read INDB from its GitHub, IFCT from jsDelivr and USDA through the API (`USDA_API_KEY`: 1,000+ an hour; DEMO_KEY: 30 an hour, 50 a day per IP).

**What the checker does:** never keeps a number from the research file. INDB rows re-read from INDB.xlsx by code (row name must match), IFCT from the @ifct2017/compositions CSV (jsDelivr) by code (kJ ÷ 4.184; pure fats 9 kcal/g fat), USDA from the FDC API by fdcId or `search: <exact description>` (POST search, exact match, else lists the closest names), DERIVED recomputed from its ingredients and cooked weight, fried foods through the D52 model; macro check (±15 % → macros null), unit > 1,200 kcal refused, ids / source rows already in the catalog refused, aliases another food already owns dropped, forbidden sources refused. MFR_LABEL values can't be fetched: kept as given, flagged for a check against the label image. `USDA_API_KEY` (free, fdc.nal.usda.gov/api-key-signup) is in `.env` (2026-09-30; the key's own limit shows 3,600 an hour); DEMO_KEY allows 30 an hour, 50 a day per IP.

**Batch 1 (street food, 2026-09-28):** 12 foods sent; every INDB value matched the spreadsheet and every recipe recomputed. 7 accepted (paneer kathi roll, egg roll, kala chana chaat, masala sweet corn, khajoor / poondu / schezwan chutney), 5 deep-fried INDB rows refused (bhel 510, bread pakora 711, aloo bonda 633 kcal/100 g…) → D52. 19 dishes not found, mostly because browser Claude can't reach USDA (now: `search:` refs) or they're fried (now: D52). 12 alias sets merged (e.g. chole → "pindi chole", pav bhaji → "pao bhaji"). "Chickpea Curry" renamed "Chole (Chickpea Curry)" (old logs keep their snapshot name).

**Batch 1b (street food redo, 2026-09-28):** 36 foods, all DERIVED or USDA. 34 passed on the first run: golgappa shells, papdi, sev, batata vada, bhatura / samosa / khasta kachori (D52), crispy corn, pani puri, sev / dahi puri, papdi / tikki / samosa / kachori chaat, raj kachori, ragda pattice, aloo tikki, jhalmuri, bhel, corn + khakhra chaat, chicken kathi roll, veg frankie, egg chowmein, chole kulche, chole bhature plate. Pav, momos, bread pakora (and vada pav / dabeli / misal pav, which need pav) waited on the USDA hourly limit (DEMO_KEY). Fried foods: moisture is assumed for all of them (flagged); e.g. samosa 577 → 321 kcal/100 g, pani puri plate of 6 ≈ 174 kcal, bhel plate ≈ 297.
- **Replacements (D52):** `REPLACES` in the checker maps a rebuild to the old id (`bhatura-fried` → `bhatura`, `aloo-samosa-fried` → `samosa`, `khasta-kachori-fried` → `kachori`). The research row takes over the id, keeps the old row's units (old logs point at `piece_medium`) and aliases; `build-foods.mjs` drops the replaced catalog row. Old logs keep their snapshot kcal; editing one recomputes with the new values.
- **USDA answers are cached** in `data/research/fdc-cache.json` (keep it: provenance + DEMO_KEY allows ~10 requests an hour).
- **USDA without the API (preferred):** download the FNDDS survey foods and SR Legacy CSVs from fdc.nal.usda.gov/download-datasets (`FoodData_Central_survey_food_csv_2024-10-31.zip`, `FoodData_Central_sr_legacy_food_csv_2018-04.zip`), unzip anywhere outside the repo, run the checker with `FDC_DIRS="<fndds dir>:<sr dir>"`. ~13,000 foods load in ~1 s; exact-description search and fdcIds come from the files, the API is only a fallback. (FNDDS files store nutrient numbers like 208 in `nutrient_id`; SR Legacy stores ids like 1008: both handled.) macOS has no `timeout` command.
- **Momos (batch 1b, corrected):** USDA "Dumpling, no meat" (2708344) is a plain flour-milk dough dumpling and USDA has no vegetable-filled dumpling (its "no meat" potsticker is built from the pork one), so veg momos (steamed 130, fried 300 kcal/100 g) are DERIVED from a standard recipe with IFCT maida, cabbage, carrot, onion; chicken momos use USDA potstickers 2708708 (steamed, 113) / 2708705 (fried, pan-fried in 5 g oil, 192) as pork-and-vegetable stand-ins, confidence low.
- **Alcohol:** `data/research/PROMPT-ALCOHOL.txt` (batches A1–A7: beer, whisky, other spirits, wine, RTD/liqueurs, mixers, cocktails). Needs app work before import: an `alcohol` category + drink art, `alcohol_g` (7 kcal/g) in the catalog and the checker's macro check, peg / quarter / pint units.
- **Batch A1 (beer, 2026-09-29):** 12 accepted: Bira 91 White / Blonde / Boom Classic / Boom Super Strong / Plus Super Strong, Godfather Super 8 / Legendary / Luxury Lager, generic regular lager (~5 %), strong (~8 %), light (USDA's own alcohol), draught / craft. Carbs etc. from USDA "Alcoholic beverage, beer, regular, all" / "…, light"; a 5 % lager computes to 43.7 kcal / 100 ml (USDA measured regular beer: 43). 650 ml: regular ≈ 284 kcal, strong ≈ 391. Aliases "strong", "pint", "tight beer" dropped (too generic). Not found (ABV only on shop / rating sites): Kingfisher (all), Budweiser (+ Magnum), Heineken, Carlsberg, Tuborg, Simba, Hoegaarden, Corona, Stella, Beck's, Haywards, Knock Out, Kotsberg, 0.0 beers. Heineken USA publishes an official product sheet (PDF) → allowed; a photo of a real label (owner's own bottle) also counts as MFR_LABEL.

**Chicken biryani (2026-09-28, researched in Claude Code, `data/research/batch-x1-chicken-biryani.json`):** 185 kcal, P 4.9, C 15.1, F 11.6 g / 100 g; 1 plate (~350 g) ≈ 648 kcal. INDB has no chicken biryani; the lab study (J Meat Sci 2019, Hyderabad) is dry-basis and paywalled (moisture unknown), the 2018 JAA paper takes its values from MyFitnessPal (refused), USDA FNDDS 27243100 "Biryani with chicken" is an American recipe (more baked potato than rice, basil, jalapeño, 28 g butter). So: INDB's own mutton biryani recipe (ASC122, `recipes.xlsx`) with IFCT chicken thigh for the mutton, cooked weight by dry-matter balance from USDA SR Legacy water contents (rice ×3.04, chicken ×0.74, onion ×0.90, tomato ×0.97), oil 4 tbsp as the original recipe says. Cross-check: the lab's dry-basis numbers at 55–60 % moisture give ~175–195 kcal as eaten. Protein is on the low side (INDB's recipe: 100 g meat per 100 g raw rice; restaurant plates usually carry more chicken).
- **Found on the way:** (1) INDB's per-100 g values are per 100 g of RAW ingredients (INDB.do: total nutrients ÷ raw weight, no cooking water), so rice dishes without water in the recipe read denser than on the plate (INDB mutton biryani 191). (2) IFCT N001 chicken leg is internally inconsistent (384 kcal from energy, 192 from its protein + fat): the checker now refuses IFCT rows whose energy and macros disagree by more than max(40 kcal, 20 %). (3) USDA FNDDS + SR Legacy are also free full downloads (no key, no rate limit): worth reading them locally instead of the API.
