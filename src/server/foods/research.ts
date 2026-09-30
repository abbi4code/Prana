import "server-only";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import catalogJson from "@/data/foods.generated.json";
import type { ResearchFood } from "@/lib/research/check";
import type { Food } from "@/lib/types";
import { serverEnv } from "../env";
import { ifctSearch, indbSearch, usdaFood, usdaSearch } from "./sources";
import { verifyResearchFood } from "./verify";

// The food research agent (D54 phase 3, .claude/food-requests.md). One missing food name in, one answer out:
// a researched food (source REFERENCES in the research-batch format), "it's an existing food under another name",
// "no allowed source has it", or "not a food". It works like browser Claude with data/research/PROMPT.txt, but with
// tools over the real datasets, and it can run the checker on its draft before answering. It never supplies nutrient
// numbers (only a label's own numbers, copied, for MFR_LABEL); the checker re-reads everything (verify.ts).

const catalog = catalogJson as Food[];

// ── the answer ──
const Src = z.object({
  id: z.enum(["INDB", "IFCT2017", "USDA", "MFR_LABEL", "DERIVED", "FOOD"]),
  ref: z.string(),
  url: z.string().nullable(),
  image_url: z.string().nullable(),
  row_name: z.string().nullable(),
});
const Where = z.object({ url: z.string(), table: z.string() });
const ResearchSchema = z.object({
  id: z.string(),
  name: z.string(),
  name_hi: z.string().nullable(),
  category: z.enum(["breakfast", "roti_bread", "rice", "dal", "sabzi", "paneer", "egg", "non_veg", "snack", "sweet", "dairy", "fruit", "beverage", "condiment", "nuts", "soup", "supplement", "cereal", "alcohol"]),
  diet: z.enum(["vegan", "veg", "egg", "non_veg"]),
  form: z.enum(["cooked", "raw", "beverage", "packaged"]),
  aliases: z.array(z.string()),
  per_100g: z.object({ kcal: z.number().nullable(), protein_g: z.number().nullable(), carbs_g: z.number().nullable(), fat_g: z.number().nullable(), fiber_g: z.number().nullable() }).nullable(),
  units: z.array(z.object({ unit: z.string(), label: z.string(), grams: z.number(), basis: z.string() })),
  default_unit: z.string(),
  source: Src,
  recipe: z.object({
    ingredients: z.array(z.object({ name: z.string(), grams: z.number(), source: Src })),
    cooked_weight_g: z.number().nullable(),
    cooked_weight_basis: z.string().nullable(),
    frying: z.object({
      fat_ref: z.string().nullable(), fat_pct: z.number().nullable(), fat_basis: z.enum(["dry", "as_eaten"]).nullable(),
      fat_source: Where.nullable(), moisture_pct: z.number(), moisture_source: Where.nullable(),
    }).nullable(),
  }).nullable(),
  drink: z.object({ abv_pct: z.number().nullable(), abv_source: z.object({ url: z.string(), text: z.string() }).nullable() }).nullable(),
  confidence: z.enum(["high", "medium", "low"]),
  notes: z.string(),
});
export const Answer = z.object({
  outcome: z.enum(["food", "alias", "not_found", "not_food"]),
  alias_of: z.string().nullable(),
  reason: z.string(),
  searched: z.array(z.string()),
  food: ResearchSchema.nullable(),
});
export type Answer = z.infer<typeof Answer>;

// ── instructions (the rules of data/research/PROMPT.txt, shortened for one food at a time) ──
const INSTRUCTIONS = `You research ONE food for "Prana", a calorie tracker for Indian users. A user searched for it and the app didn't have it. Find where its nutrition numbers are in an allowed source and answer with the reference. You never supply nutrient numbers yourself: our checker re-reads every value from the source by your reference.

STEP 1 · Is it already in Prana? Call search_catalog with the name and its common spellings. If the same dish is there under another name (Hinglish spelling, English name, a regional name), answer outcome "alias" with alias_of = that food's id. A different dish that merely shares a word is NOT an alias.
If the text isn't a food or drink (gibberish, a person, an exercise, abuse), answer "not_food".

STEP 2 · Find a source, in this order of preference:
1. INDB (Indian Nutrient Databank 2024, ~1,014 cooked Indian recipes): search_indb. Best for cooked Indian dishes. Reference = food_code, row_name = its name exactly.
2. IFCT 2017 (raw ingredients: grains, dals, milk, fruit, meat, fish…): search_ifct. Reference = code.
3. USDA FoodData Central (FNDDS survey foods, SR Legacy, Foundation): search_usda. Reference = "fdcId <n>", row_name = its description. Good for non-Indian foods (pizza, ice cream, fries) and basics.
4. MFR_LABEL: the brand's OWN site / nutrition page / label image, or a restaurant chain's official nutrition page or PDF (McDonald's India, Domino's India…). Copy the per-100 g (or per-100 ml) values EXACTLY as printed into per_100g; give source.url (the page) and source.image_url (the label image) when there is one. Shops, marketplaces (Amazon, BigBasket, Blinkit), blogs and review sites don't count.
5. DERIVED: a dish none of the above has, computed from sourced ingredients: recipe.ingredients with raw grams for the whole recipe, each with its own INDB / IFCT / USDA reference (or FOOD = an existing Prana food id for combos), cooked_weight_g and cooked_weight_basis (say "assumed" if it is; then confidence "low").
NEVER use or cite: HealthifyMe, FatSecret, MyFitnessPal, Nutritionix, CalorieKing, Cronometer, Edamam, Wikipedia numbers, recipe blogs or their nutrition widgets, "average" aggregator values, AI-generated nutrition sites. If only those have it: outcome "not_found".

RULES
- Deep-fried foods (samosa, pakora, puri, bhatura, vada, bonda, jalebi, kachori, fried momos…): never the INDB row (it counts the whole pan of oil). Use DERIVED with recipe.frying: ingredients = dough / batter / filling BEFORE frying (no frying oil); fat_ref "JPS2024:<food>:<temp>:<cycle>" with food = poori | bread pakora | mathri | french fries | potato chips (closest kind of food), temp 180 (mathri 160), cycle 1 for home food, 32 for street / shop food, fat_pct null, fat_basis null; moisture_pct from a study if you find one (moisture_source), else your best figure with moisture_source null, confidence "low", notes starting "Fried (absorbed-oil model). ". cooked_weight_g null.
- Alcohol: category "alcohol", form "beverage", source = the USDA row for the style (e.g. "Alcoholic beverage, beer, regular, all"), drink.abv_pct from the brand's own label / site / a state excise list with drink.abv_source {url, text}. Units in ml as grams (100 ml = 100 g): peg 60, pint 330, bottle_650 650, can_500 500.
- INDB values are per 100 g of RAW ingredients (no cooking loss or water gain). For dishes that cook down a lot (kulfi, rabdi, basundi, halwa, khoa / mawa sweets) or absorb water (rice dishes, biryani, khichdi) prefer DERIVED with a sourced cooked weight when you can support one; if you still use the INDB row, say so in notes.
- per_100g: null for everything except MFR_LABEL.
- Units (grams per 1 unit): use these ids when they fit: katori (150 g), bowl (250 g), plate, glass (250 ml), cup (150 ml), tbsp, tsp, handful (~30 g), pack (label serve), scoop, slice; countable things by name (piece, puri, roll, momo, tikki, ladoo, bar…). basis = where the grams come from ("INDB serving size", "USDA portion: <text>" — call usda_portions — "label serving size", "recipe", or "estimated standard household measure"). One person's normal portion; never a whole recipe yield (checker refuses a unit over 1,200 kcal). default_unit = the one people say ("1 katori", "2 roti").
- id: kebab-case English name ("dal-makhani"). name: the usual name ("Dal Makhani"). name_hi: in Devanagari, or null. aliases: other names people type (Hinglish, regional, English), lower case, max 8.
- confidence: high = exact source row + a sourced serving; medium = sourced values, estimated serving or a close stand-in row; low = DERIVED with assumptions, fried model, or a failed macro check.
- notes: one or two plain sentences: which row / recipe and anything the owner should know.

STEP 3 · Before answering with a food, call check_food with it. Fix what it reports (wrong code, row name mismatch, unit too big) and check again; if it can't pass, answer "not_found" with the reason. Keep it quick: a few searches, then answer.

Answer: outcome, alias_of (a Prana food id, only for "alias"), reason (one sentence for the admin), searched (where you looked), food (only for "food", else null).`;

// ── tools ──
type ToolCtx = { shared: Food[]; pendingIds: Set<string>; requestName: string };
const TOOLS: OpenAI.Responses.Tool[] = [
  { type: "function", name: "search_catalog", description: "Search Prana's own foods (built-in + added). Returns id, name, other names.", strict: true,
    parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"], additionalProperties: false } },
  { type: "function", name: "search_indb", description: "Search INDB 2024 recipes by name. Returns food_code, name, serving unit.", strict: true,
    parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"], additionalProperties: false } },
  { type: "function", name: "search_ifct", description: "Search IFCT 2017 foods by name. Returns code, name.", strict: true,
    parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"], additionalProperties: false } },
  { type: "function", name: "search_usda", description: "Search USDA FoodData Central (FNDDS, SR Legacy, Foundation). Returns fdcId, description, data type.", strict: true,
    parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"], additionalProperties: false } },
  { type: "function", name: "usda_portions", description: "Household portions (grams) USDA lists for one food.", strict: true,
    parameters: { type: "object", properties: { fdcId: { type: "integer" } }, required: ["fdcId"], additionalProperties: false } },
  { type: "function", name: "check_food", description: "Run Prana's checker on a draft food (the same object you'd answer with). Returns ok, or the problems to fix.", strict: false,
    parameters: { type: "object", properties: { food: { type: "object" } }, required: ["food"] } },
  { type: "web_search", filters: { blocked_domains: ["healthifyme.com", "fatsecret.com", "myfitnesspal.com", "nutritionix.com", "calorieking.com", "cronometer.com", "edamam.com", "wikipedia.org", "nutritionvalue.org", "eatthismuch.com", "carbmanager.com", "fitbit.com"] } } as OpenAI.Responses.Tool,
];

async function runTool(name: string, args: Record<string, unknown>, ctx: ToolCtx): Promise<unknown> {
  const q = String(args.query ?? "").slice(0, 100);
  switch (name) {
    case "search_catalog": {
      const words = q.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
      return [...catalog, ...ctx.shared]
        .map((f) => ({ f, s: words.filter((w) => `${f.name} ${f.aliases.join(" ")}`.toLowerCase().includes(w)).length }))
        .filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 8)
        .map(({ f }) => ({ id: f.id, name: f.name, other_names: f.aliases.slice(0, 6) }));
    }
    case "search_indb": return indbSearch(q);
    case "search_ifct": return ifctSearch(q);
    case "search_usda": return usdaSearch(q, 8);
    case "usda_portions": {
      const v = await usdaFood(Number(args.fdcId));
      return { description: v.name, portions: v.portions.slice(0, 12) };
    }
    case "check_food": {
      const parsed = ResearchSchema.safeParse(args.food);
      if (!parsed.success) return { ok: false, problems: parsed.error.issues.slice(0, 6).map((i) => `${i.path.join(".")}: ${i.message}`) };
      const v = await verifyResearchFood(toResearchFood(parsed.data), ctx);
      return v.ok
        ? { ok: true, warnings: v.warnings, default_unit_kcal: Math.round((v.food.kcal * (v.food.units.find((u) => u.id === v.food.du)?.g ?? 0)) / 100) }
        : { ok: false, problems: v.problems, warnings: v.warnings };
    }
  }
  return { error: `unknown tool ${name}` };
}

/** The strict-schema answer (nulls everywhere) → the checker's shape (absent = undefined). */
export function toResearchFood(f: z.infer<typeof ResearchSchema>): ResearchFood {
  const src = (s: z.infer<typeof Src>) => ({ id: s.id, ref: s.ref, ...(s.url ? { url: s.url } : {}), ...(s.image_url ? { image_url: s.image_url } : {}), ...(s.row_name ? { row_name: s.row_name } : {}) });
  return {
    ...f,
    source: src(f.source),
    per_100g: f.per_100g ?? null,
    recipe: f.recipe
      ? {
          ingredients: f.recipe.ingredients.map((i) => ({ name: i.name, grams: i.grams, source: src(i.source) })),
          ...(f.recipe.cooked_weight_g != null ? { cooked_weight_g: f.recipe.cooked_weight_g } : {}),
          ...(f.recipe.cooked_weight_basis ? { cooked_weight_basis: f.recipe.cooked_weight_basis } : {}),
          ...(f.recipe.frying
            ? { frying: {
                ...(f.recipe.frying.fat_ref ? { fat_ref: f.recipe.frying.fat_ref } : {}),
                fat_pct: f.recipe.frying.fat_pct,
                ...(f.recipe.frying.fat_basis ? { fat_basis: f.recipe.frying.fat_basis } : {}),
                ...(f.recipe.frying.fat_source ? { fat_source: f.recipe.frying.fat_source } : {}),
                moisture_pct: f.recipe.frying.moisture_pct,
                ...(f.recipe.frying.moisture_source ? { moisture_source: f.recipe.frying.moisture_source } : {}),
              } }
            : {}),
        }
      : undefined,
    drink: f.drink ? { ...(f.drink.abv_pct != null ? { abv_pct: f.drink.abv_pct } : {}), ...(f.drink.abv_source ? { abv_source: f.drink.abv_source } : {}) } : undefined,
  };
}

export type ResearchRun = {
  answer: Answer | null;
  error: string | null;
  model: string;
  turns: number;
  searches: number;
  tools: string[];
  usage: { input: number; output: number };
  ms: number;
};

let client: OpenAI | null = null;
const openai = () => (client ??= new OpenAI({ apiKey: serverEnv().OPENAI_API_KEY, timeout: 120_000, maxRetries: 1 }));

const MAX_TURNS = 10;
const BUDGET_MS = 240_000; // the route may run 300 s (Vercel Hobby)

/** Research one food name. Never throws for a model / tool problem: `error` says what went wrong. */
export async function researchFood(name: string, ctx: Omit<ToolCtx, "requestName">): Promise<ResearchRun> {
  const model = serverEnv().RESEARCH_MODEL;
  const started = Date.now();
  const run: ResearchRun = { answer: null, error: null, model, turns: 0, searches: 0, tools: [], usage: { input: 0, output: 0 }, ms: 0 };
  const toolCtx: ToolCtx = { ...ctx, requestName: name };
  const format = zodTextFormat(Answer, "research");
  try {
    let res = await openai().responses.create({
      model, instructions: INSTRUCTIONS, tools: TOOLS, text: { format }, max_output_tokens: 8000,
      input: `Food to research: "${name.slice(0, 60)}"`,
    });
    for (;;) {
      run.turns++;
      run.usage.input += res.usage?.input_tokens ?? 0;
      run.usage.output += res.usage?.output_tokens ?? 0;
      run.searches += res.output.filter((o) => o.type === "web_search_call").length;
      const calls = res.output.filter((o): o is OpenAI.Responses.ResponseFunctionToolCall => o.type === "function_call");
      if (!calls.length) break;
      if (run.turns >= MAX_TURNS || Date.now() - started > BUDGET_MS) {
        run.error = `stopped after ${run.turns} steps (${Math.round((Date.now() - started) / 1000)} s) without an answer`;
        break;
      }
      const outputs = await Promise.all(calls.map(async (c) => {
        run.tools.push(c.name);
        let out: unknown;
        try {
          out = await runTool(c.name, JSON.parse(c.arguments || "{}"), toolCtx);
        } catch (e) {
          out = { error: e instanceof Error ? e.message : String(e) };
        }
        return { type: "function_call_output" as const, call_id: c.call_id, output: JSON.stringify(out).slice(0, 12_000) };
      }));
      res = await openai().responses.create({
        model, instructions: INSTRUCTIONS, tools: TOOLS, text: { format }, max_output_tokens: 8000,
        previous_response_id: res.id, input: outputs,
      });
    }
    if (!run.error) {
      const parsed = Answer.safeParse(JSON.parse(res.output_text || "null"));
      if (parsed.success) run.answer = parsed.data;
      else run.error = `the answer didn't match the format: ${parsed.error.issues[0]?.message ?? "?"}`;
    }
  } catch (e) {
    run.error = e instanceof Error ? e.message.slice(0, 300) : String(e);
  }
  run.ms = Date.now() - started;
  return run;
}
