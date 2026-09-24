// Builds data/foods-extra.json: foods added after the v2 research dataset (see .claude/data.md).
// Every number is read from a source here, never typed in:
//   - INDB 2024 recipes: read from INDB.xlsx by food code
//   - USDA FoodData Central (SR Legacy): values fetched from the FDC API, recorded with their fdcId
//   - DERIVED: recipes computed from the sourced ingredients above (chai)
// Run: node scripts/import-extra.mjs /path/to/INDB.xlsx
//   (INDB.xlsx: github.com/lindsayjaacks/Indian-Nutrient-Databank-INDB-)

import { readFileSync, writeFileSync } from "node:fs";
import XLSX from "xlsx";

const INDB_URL = "https://github.com/lindsayjaacks/Indian-Nutrient-Databank-INDB-/blob/main/INDB.xlsx";
const fdcUrl = (id) => `https://fdc.nal.usda.gov/food-details/${id}/nutrients`;

const path = process.argv[2];
if (!path) throw new Error("usage: node scripts/import-extra.mjs /path/to/INDB.xlsx");
XLSX.set_fs({ readFileSync });
const rows = XLSX.utils.sheet_to_json(XLSX.readFile(path).Sheets["Nutrient Data"]);
const byCode = new Map(rows.map((r) => [r.food_code, r]));
// never re-add a recipe the main dataset already has
const existing = new Set(JSON.parse(readFileSync("data/foods.json", "utf8")).foods.filter((f) => f.source?.id === "INDB").map((f) => f.source.ref));

const r1 = (n) => (n == null ? null : Math.round(n * 100) / 100);
const std = (unit, label, grams, basis = "estimated standard household measure") => ({ unit, label, grams, basis });
const katori = std("katori", "1 katori (150 ml)", 150);
const bowl = std("bowl", "1 bowl (250 ml)", 250);
const plate = std("plate", "1 plate", 250);

// INDB servings above these weights are whole-recipe yields, not one portion
const MAX_SERVING = { plate: 350, bowl: 300, "curry bowl": 300, "tea cup": 200 };

// [code, id, name, hindi, aliases, category, diet, extra units, default unit, rename serving unit]
const INDB = [
  ["BFP134", "jeera-rice", "Jeera Rice (Cumin Pulao)", "जीरा राइस", ["jeera pulao", "zeera rice", "cumin rice"], "rice", "vegan", [katori], "katori"],
  ["BFP136", "matar-pulao", "Matar Pulao", "मटर पुलाव", ["peas pulao", "peas rice"], "rice", "vegan", [katori], "katori"],
  ["ASC226", "kadhai-paneer", "Kadhai Paneer", "कढ़ाई पनीर", ["kadai paneer", "karahi paneer"], "paneer", "veg", [katori], "katori"],
  ["ASC155", "mixed-dal", "Mixed Dal", "मिक्स दाल", ["panchmel dal", "dal", "mix dal"], "dal", "vegan", [katori], "katori"],
  ["ASC156", "sabut-moong-dal", "Whole Moong Dal", "साबुत मूंग दाल", ["moong ki dal", "green moong dal"], "dal", "vegan", [katori], "katori"],
  ["ASC159", "sabut-urad-dal", "Whole Urad Dal", "साबुत उड़द दाल", ["kaali dal", "urad ki dal", "maa ki dal"], "dal", "vegan", [katori], "katori"],
  ["BFP170", "khatti-dal", "Khatti Dal", "खट्टी दाल", ["sour dal", "tamarind dal"], "dal", "vegan", [katori], "katori"],
  ["ASC487", "veg-khichdi", "Vegetable Khichdi", "वेज खिचड़ी", ["khichdi", "khichri", "masala khichdi"], "rice", "veg", [katori, plate], "katori"],
  ["BFP556", "palak-khichdi", "Palak Khichdi", "पालक खिचड़ी", ["spinach khichdi"], "rice", "veg", [katori], "katori"],
  ["ASC244", "chilli-chicken", "Chilli Chicken", "चिली चिकन", ["chili chicken", "indo chinese chicken"], "non_veg", "non_veg", [katori], "katori"],
  ["BFP214", "shahi-chicken-masala", "Shahi Chicken Masala", "शाही चिकन मसाला", ["chicken masala", "chicken gravy"], "non_veg", "non_veg", [katori], "katori"],
  ["BFP090", "chicken-stew", "Chicken Stew", "चिकन स्टू", ["kerala chicken stew"], "non_veg", "non_veg", [katori], "katori"],
  ["BFP194", "mutton-korma", "Mutton Korma", "मटन कोरमा", ["mutton curry", "lamb korma"], "non_veg", "non_veg", [katori], "katori"],
  ["BFP223", "bengali-fish-curry", "Bengali Fish Curry", "बंगाली मछली करी", ["macher jhol", "fish jhol"], "non_veg", "non_veg", [katori], "katori"],
  ["ASC057", "fried-egg", "Fried Egg", "फ्राइड अंडा", ["egg fry", "sunny side up", "half fry"], "egg", "egg", [], null],
  ["ASC058", "poached-egg", "Poached Egg", "पोच्ड अंडा", ["egg poach"], "egg", "egg", [], null],
  ["ASC335", "plain-burfi", "Burfi", "बर्फी", ["barfi", "milk burfi", "khoya burfi"], "sweet", "veg", [], null],
  ["ASC340", "besan-burfi", "Besan Burfi", "बेसन बर्फी", ["besan barfi", "gram flour burfi"], "sweet", "veg", [], null],
  ["ASC285", "seviyan-kheer", "Seviyan Kheer", "सेवइयां खीर", ["vermicelli kheer", "semiya payasam", "sheer khurma"], "sweet", "veg", [katori], "katori"],
  ["ASC286", "suji-kheer", "Suji Kheer", "सूजी खीर", ["rava kheer", "semolina kheer"], "sweet", "veg", [katori], "katori"],
  ["ASC275", "pudina-raita", "Pudina Raita", "पुदीना रायता", ["mint raita"], "dairy", "veg", [katori], "katori"],
  ["ASC276", "aloo-raita", "Aloo Raita", "आलू रायता", ["potato raita"], "dairy", "veg", [katori], "katori"],
  ["ASC260", "green-salad", "Green Salad", "सलाद", ["salad", "tossed salad", "kachumber"], "sabzi", "vegan", [katori], "katori"],
  ["ASC265", "fruit-salad", "Fruit Salad", "फ्रूट सलाद", ["fruit chaat", "mixed fruit"], "fruit", "veg", [katori], "katori"],
  ["ASC103", "matar-paratha", "Matar Paratha", "मटर पराठा", ["peas paratha", "pea parantha"], "roti_bread", "veg", [], null],
  ["BFP108", "pyaaz-paratha", "Pyaaz Paratha", "प्याज़ पराठा", ["onion paratha", "onion chilli paratha"], "roti_bread", "veg", [], null],
  ["ASC002", "instant-coffee", "Coffee with Milk", "कॉफ़ी", ["instant coffee", "nescafe", "milk coffee"], "beverage", "veg", [std("cup", "1 cup (150 ml)", 150)], "cup", true],
  ["ASC028", "chicken-sandwich", "Chicken Sandwich", "चिकन सैंडविच", ["chicken sandwich"], "snack", "non_veg", [], null],
  ["ASC024", "egg-sandwich", "Egg Sandwich", "एग सैंडविच", ["anda sandwich", "egg sandwich"], "snack", "egg", [], null],
  ["ASC032", "veg-club-sandwich", "Veg Club Sandwich", "वेज क्लब सैंडविच", ["veg sandwich", "club sandwich"], "snack", "veg", [], null],
  ["BFP241", "veg-coconut-curry", "Vegetable Curry with Coconut", "नारियल सब्ज़ी करी", ["veg kurma", "vegetable stew", "avial"], "sabzi", "vegan", [katori], "katori"],
];

// Fetched from api.nal.usda.gov/fdc/v1 (SR Legacy), 2026-09-24. Per 100 g.
const USDA = [
  { fdcId: 171284, id: "dahi", name: "Dahi (Plain Curd)", hi: "दही", aliases: ["curd", "yogurt", "yoghurt", "plain dahi"], cat: "dairy", diet: "veg",
    kcal: 61, p: 3.47, f: 3.25, c: 4.66, fib: 0, units: [katori, std("tbsp", "1 tbsp", 15)], du: "katori",
    note: "USDA whole-milk plain yogurt as a proxy for homemade full-fat dahi. Toned-milk dahi is lower in fat." },
  { fdcId: 169655, id: "sugar", name: "Sugar", hi: "चीनी", aliases: ["cheeni", "shakkar", "sugar"], cat: "condiment", diet: "vegan",
    kcal: 387, p: 0, f: 0, c: 100, fib: 0, units: [std("tsp", "1 tsp", 4), std("tbsp", "1 tbsp", 12)], du: "tsp" },
  { fdcId: 169640, id: "honey", name: "Honey", hi: "शहद", aliases: ["shahad", "madhu"], cat: "condiment", diet: "veg",
    kcal: 304, p: 0.3, f: 0, c: 82.4, fib: 0.2, units: [std("tsp", "1 tsp", 7), std("tbsp", "1 tbsp", 21)], du: "tsp" },
  { fdcId: 173410, id: "butter", name: "Butter", hi: "मक्खन", aliases: ["makhan", "amul butter", "salted butter"], cat: "condiment", diet: "veg",
    kcal: 717, p: 0.85, f: 81.1, c: 0.06, fib: 0, units: [std("tsp", "1 tsp", 5), std("tbsp", "1 tbsp", 14)], du: "tsp" },
  { fdcId: 174924, id: "white-bread", name: "White Bread", hi: "ब्रेड", aliases: ["bread", "bread slice", "sandwich bread"], cat: "roti_bread", diet: "vegan",
    kcal: 266, p: 8.85, f: 3.33, c: 49.4, fib: 2.7, units: [std("slice", "1 slice", 25)], du: "slice" },
  { fdcId: 172688, id: "brown-bread", name: "Brown Bread (Whole Wheat)", hi: "ब्राउन ब्रेड", aliases: ["atta bread", "whole wheat bread", "brown bread"], cat: "roti_bread", diet: "vegan",
    kcal: 252, p: 12.4, f: 3.5, c: 42.7, fib: 6, units: [std("slice", "1 slice", 30)], du: "slice" },
  { fdcId: 170853, id: "cheese-slice", name: "Cheese Slice", hi: "चीज़ स्लाइस", aliases: ["processed cheese", "amul cheese", "cheese"], cat: "dairy", diet: "veg",
    kcal: 366, p: 18.1, f: 30.7, c: 4.78, fib: 0, units: [std("slice", "1 slice", 20)], du: "slice" },
  { fdcId: 173180, id: "whey-protein", name: "Whey Protein Powder", hi: "व्हे प्रोटीन", aliases: ["whey", "protein powder", "whey protein", "scoop", "muscleblaze", "on whey", "gold standard"], cat: "supplement", diet: "veg",
    kcal: 352, p: 78.1, f: 1.56, c: 6.25, fib: 0, units: [std("scoop", "1 scoop (30 g)", 30), std("tbsp", "1 tbsp", 8)], du: "scoop",
    note: "USDA generic whey-based protein powder. Brands differ (scoop 30–36 g, 24–27 g protein): for exact values, create your brand from its label." },
  { fdcId: 174852, id: "cola", name: "Cola (Soft Drink)", hi: "कोल्ड ड्रिंक", aliases: ["coke", "pepsi", "thums up", "cold drink", "soda"], cat: "beverage", diet: "vegan",
    kcal: 42, p: 0, f: 0.25, c: 10.4, fib: 0, units: [std("glass", "1 glass (250 ml)", 250), std("can", "1 can (300 ml)", 300)], du: "glass" },
];

const out = [];
const withKatoriNote = (units) => (units.some((u) => u.unit === "katori") ? "katori weight is estimated, not sourced." : "");

for (const [code, id, name, hi, aliases, cat, diet, extra, du, dropServing] of INDB) {
  const r = byCode.get(code);
  if (!r) throw new Error(`INDB code ${code} not found`);
  if (existing.has(code)) throw new Error(`INDB code ${code} is already in data/foods.json`);
  const units = [];
  const servingG = r.unit_serving_energy_kcal / r.energy_kcal * 100;
  const cap = MAX_SERVING[r.servings_unit];
  if (!dropServing && r.servings_unit && Number.isFinite(servingG) && (!cap || servingG <= cap)) {
    units.push({ unit: r.servings_unit.replace(/\s+/g, "_"), label: `1 ${r.servings_unit}`, grams: Math.round(servingG), basis: "INDB serving size (derived: per-serving kcal / per-100g kcal x 100)" });
  } else if (!dropServing && r.servings_unit === "plate") {
    units.push(plate);
  } else if (!dropServing && ["bowl", "curry bowl"].includes(r.servings_unit)) {
    units.push(bowl);
  }
  for (const u of extra) if (!units.some((x) => x.unit === u.unit)) units.push(u);
  const hasSourcedServing = units.some((u) => u.basis.startsWith("INDB"));
  out.push({
    id, name, name_hi: hi, aliases, category: cat, diet, form: cat === "beverage" ? "beverage" : "cooked",
    per_100g: { kcal: r1(r.energy_kcal), protein_g: r1(r.protein_g), carbs_g: r1(r.carb_g), fat_g: r1(r.fat_g), fiber_g: r1(r.fibre_g) },
    units, default_unit: du ?? units[0].unit,
    source: { id: "INDB", ref: code, url: INDB_URL },
    confidence: hasSourcedServing && !units.some((u) => u.basis.startsWith("estimated")) ? "high" : "medium",
    notes: withKatoriNote(units),
    image_prompt: `${name} as served in an Indian home`,
  });
}

for (const u of USDA) {
  out.push({
    id: u.id, name: u.name, name_hi: u.hi, aliases: u.aliases, category: u.cat, diet: u.diet, form: u.cat === "beverage" ? "beverage" : "packaged",
    per_100g: { kcal: u.kcal, protein_g: u.p, carbs_g: u.c, fat_g: u.f, fiber_g: u.fib },
    units: u.units, default_unit: u.du,
    source: { id: "USDA", ref: `fdcId ${u.fdcId}`, url: fdcUrl(u.fdcId) },
    confidence: "medium",
    notes: [u.note, "Unit weight is an estimated household measure."].filter(Boolean).join(" "),
    image_prompt: `${u.name}`,
  });
}

// Creatine: official label, Optimum Nutrition India (3 g scoop = 0 kcal, 0 carbs; 100% creatine monohydrate).
out.push({
  id: "creatine", name: "Creatine Monohydrate", name_hi: "क्रिएटिन", aliases: ["creatine", "creatine monohydrate", "creapure", "micronized creatine"],
  category: "supplement", diet: "vegan", form: "packaged",
  per_100g: { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 },
  units: [std("scoop", "1 scoop (3 g)", 3, "manufacturer serving (ON India label)"), std("tsp", "1 tsp (5 g)", 5)],
  default_unit: "scoop",
  source: { id: "MFR_LABEL", ref: "Optimum Nutrition Micronized Creatine, unflavoured (India)", url: "https://www.optimumnutrition.co.in/products/micronized-creatine-powder-unflavoured-100-g-1145331" },
  confidence: "high",
  notes: "Pure creatine monohydrate has no usable energy; labels show 0 kcal. Flavoured creatines can add sugar: check the label.",
  image_prompt: "A scoop of white creatine powder",
});

// Yogabar (Sproutlife Foods): values transcribed from the official nutrition-facts label images on yogabars.in,
// 2026-09-24. Per 100 g of the dry product; "with milk" rows use the label's own per-serve-with-milk column
// (the label itself uses IFCT whole cow milk), converted to per 100 g of the finished bowl.
const YB = "https://www.yogabars.in/products/";
const YB_IMG = "https://cdn.shopify.com/s/files/1/0267/5245/files/";
const MILK_G = (ml) => Math.round(ml * 1.03); // whole milk density
const yogabar = [
  {
    id: "yogabar-protein-muesli-choco-almond", name: "Choco Almond Protein Muesli (Yogabar)", hi: "योगाबार प्रोटीन म्यूसली",
    aliases: ["yogabar muesli", "protein muesli", "choco almond muesli", "yoga bar muesli", "muesli"],
    per100: { kcal: 386, p: 23.0, c: 53.1, f: 10.7, fib: 7.5 }, serve: 50,
    milk: { ml: 200, kcal: 339, p: 18.5, c: 36.6, f: 14.4 },
    page: "choco-almond-high-protein-muesli-850g", img: "yogabar-high-protein-muesli-850g-nutrition-facts.jpg",
    note: "Label: serving 50 g, added sugar 15 g/100 g (chocolate, dates, jaggery, cranberry). 350 g packs may differ slightly.",
  },
  {
    id: "yogabar-protein-oats-dark-chocolate", name: "Dark Chocolate Protein Oats (Yogabar)", hi: "योगाबार प्रोटीन ओट्स",
    aliases: ["yogabar oats", "protein oats", "dark chocolate oats", "yoga bar oats", "oats"],
    per100: { kcal: 364, p: 26.0, c: 57.3, f: 5.9, fib: 11.1 }, serve: 50,
    milk: { ml: 250, kcal: 364, p: 21.2, c: 41.0, f: 14.2 },
    page: "26g-high-protein-oats-dark-chocolate", img: "yogabar-26g-protein-oats-dark-chocolate-nutrition-facts.jpg",
    note: "Label: serving 50 g, no added sugar. Dry values; cooked-with-milk is a separate entry.",
  },
  {
    id: "yogabar-protein-oats-filter-kaapi", name: "Filter Kaapi Protein Oats (Yogabar)", hi: "योगाबार प्रोटीन ओट्स फ़िल्टर कॉफ़ी",
    aliases: ["yogabar oats", "filter kaapi oats", "filter coffee oats", "coffee protein oats", "protein oats"],
    per100: { kcal: 364, p: 26.0, c: 53.4, f: 7.6, fib: 11.2 }, serve: 50,
    milk: { ml: 250, kcal: 364, p: 21.2, c: 39.1, f: 15.0 },
    page: "26g-high-protein-oats-filter-kappi", img: "yogabar-high-protein-oats-nutritional-facts-calories.jpg",
    note: "Label: serving 50 g, no added sugar. Dry values; cooked-with-milk is a separate entry.",
  },
  {
    id: "yogabar-super-muesli-dark-choco-cranberry", name: "Dark Choco Cranberry Muesli (Yogabar)", hi: "योगाबार सुपर म्यूसली",
    aliases: ["yogabar super muesli", "super muesli", "dark chocolate muesli", "chocolate cranberry muesli", "muesli"],
    per100: { kcal: 408, p: 12.0, c: 69.0, f: 11.6, fib: 10.0 }, serve: 40,
    page: "dark-chocolate-cranberry-muesli-400g", img: "yogabar-super-muesli-400g-nutrition-facts.jpg",
    note: "Label: serving 40 g, added sugar 8.8 g/100 g. Not the high-protein line (12 g vs 23 g protein). Log milk separately.",
  },
];
for (const y of yogabar) {
  const source = { id: "MFR_LABEL", ref: `Yogabar official nutrition label (${y.img})`, url: YB + y.page };
  out.push({
    id: y.id, name: y.name, name_hi: y.hi, aliases: y.aliases, category: "cereal", diet: "veg", form: "packaged",
    per_100g: { kcal: y.per100.kcal, protein_g: y.per100.p, carbs_g: y.per100.c, fat_g: y.per100.f, fiber_g: y.per100.fib },
    units: [std("serve", `1 serve (${y.serve} g)`, y.serve, "manufacturer serving size (label)"), std("katori", "1 katori dry (150 ml)", 50)],
    default_unit: "serve", source, confidence: "high", notes: `${y.note} Image: ${YB_IMG}${y.img}`,
    image_prompt: `${y.name} in a bowl`,
  });
  if (y.milk) {
    const total = y.serve + MILK_G(y.milk.ml);
    const per = (v) => r1((v / total) * 100);
    out.push({
      id: `${y.id}-with-milk`, name: `${y.name.replace(" (Yogabar)", "")} with milk (Yogabar)`, name_hi: y.hi,
      aliases: [...y.aliases, "with milk", `${y.aliases[0]} milk`],
      category: "cereal", diet: "veg", form: "cooked",
      per_100g: { kcal: per(y.milk.kcal), protein_g: per(y.milk.p), carbs_g: per(y.milk.c), fat_g: per(y.milk.f), fiber_g: null },
      units: [std("bowl", `1 bowl (${y.serve} g + ${y.milk.ml} ml milk)`, total, "manufacturer per-serve-with-milk values (label)")],
      default_unit: "bowl", source, confidence: "high",
      notes: `Label's own "${y.serve} g with ${y.milk.ml} ml cow milk" column (whole milk). With toned milk it's lower in fat.`,
      image_prompt: `${y.name} with milk in a bowl`,
    });
  }
}

// DERIVED: protein shakes = USDA whey (173180) + water or IFCT whole cow milk (L002). Creatine adds 0 kcal, so
// "whey + creatine" shakes are the same numbers (aliases below make them findable).
const whey = USDA.find((u) => u.id === "whey-protein");
const milkIFCT = { kcal: 73, p: 3.3, f: 4.5, c: 4.9 }; // IFCT L002 per 100 g
for (const [id, name, liquid, milkG, waterG] of [
  ["whey-shake-water", "Whey Shake with Water", "water", 0, 250],
  ["whey-shake-milk", "Whey Shake with Milk", "milk", 258, 0], // 250 ml whole milk ≈ 258 g
]) {
  const scoop = 30, total = scoop + milkG + waterG;
  const sum = (k) => whey[k] * scoop / 100 + milkIFCT[k] * milkG / 100;
  const per100 = (k) => r1((sum(k) / total) * 100);
  out.push({
    id, name, name_hi: "प्रोटीन शेक", aliases: ["protein shake", "whey shake", `whey with ${liquid}`, `protein shake ${liquid}`, "whey creatine shake", "whey + creatine", "post workout shake", "shake"],
    category: "supplement", diet: "veg", form: "beverage",
    per_100g: { kcal: per100("kcal"), protein_g: per100("p"), carbs_g: per100("c"), fat_g: per100("f"), fiber_g: 0 },
    units: [std("shaker", `1 shaker (1 scoop + 250 ml ${liquid})`, total, "derived recipe")],
    default_unit: "shaker",
    source: { id: "DERIVED", ref: `USDA 173180 whey ${scoop} g${milkG ? ` + IFCT L002 whole milk ${milkG} g` : ` + ${waterG} ml water`}`, url: "" },
    confidence: "medium",
    notes: `1 scoop (30 g) whey in 250 ml ${liquid === "milk" ? "whole milk (toned milk is lower in fat)" : "water"}. Creatine adds 0 kcal. 2 scoops: log the shake plus 1 scoop of Whey Protein.`,
    image_prompt: `A protein shake in a shaker bottle made with ${liquid}`,
  });
}

// DERIVED: home chai, computed from IFCT 2017 whole cow milk (L002) + USDA sugar (169655).
// One cup = 80 g milk + 70 g water + sugar, boiled down to ~150 g. Tea leaves: negligible energy.
const milk = { kcal: 73, p: 3.3, f: 4.5, c: 4.9 }; // IFCT L002 per 100 g, kJ → kcal
const sugar = USDA.find((u) => u.id === "sugar");
for (const [id, name, sugarG, aliases] of [
  ["chai", "Chai (milk + 2 tsp sugar)", 8, ["chai", "tea", "masala chai", "doodh wali chai", "cutting chai"]],
  ["chai-no-sugar", "Chai, no sugar", 0, ["tea without sugar", "sugar free chai", "phiki chai"]],
]) {
  const cup = 150, milkG = 80;
  const tot = (k) => (milk[k] * milkG + sugar[k] * sugarG) / 100;
  const per100 = (k) => r1((tot(k) / cup) * 100);
  out.push({
    id, name, name_hi: "चाय", aliases, category: "beverage", diet: "veg", form: "beverage",
    per_100g: { kcal: per100("kcal"), protein_g: per100("p"), carbs_g: per100("c"), fat_g: per100("f"), fiber_g: 0 },
    units: [std("cup", "1 cup (150 ml)", 150, "derived recipe"), std("cutting", "1 cutting (small, 90 ml)", 90)],
    default_unit: "cup",
    source: { id: "DERIVED", ref: `IFCT L002 milk ${milkG} g + USDA 169655 sugar ${sugarG} g, per 150 g cup`, url: "" },
    confidence: "medium",
    notes: `Recipe: ${milkG} g whole milk + 70 ml water${sugarG ? ` + ${sugarG} g sugar (2 tsp)` : ""}, boiled to one 150 ml cup. Toned milk or less milk makes it lower.`,
    image_prompt: "A cup of Indian milk tea",
  });
}

writeFileSync("data/foods-extra.json", JSON.stringify({ generated_on: new Date().toISOString().slice(0, 10), foods: out }, null, 1));
console.log(`data/foods-extra.json: ${out.length} foods`);
