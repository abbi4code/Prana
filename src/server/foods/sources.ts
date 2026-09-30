import "server-only";
import * as XLSX from "xlsx";
import { parseCsv } from "@/lib/research/csv";
import type { SourceRef, SourceRow } from "@/lib/research/check";
import { serverEnv } from "../env";

// Where the research agent's numbers come from on the server (D54 phase 3). Same sources as the laptop checker
// (scripts/check-research.mjs), fetched instead of read from disk: INDB.xlsx from the INDB GitHub (no licence file, so
// it isn't committed; downloaded and kept in memory per server instance), the IFCT 2017 CSV from jsDelivr, USDA
// FoodData Central through its API (USDA_API_KEY; DEMO_KEY otherwise: 30 an hour).
// The search helpers feed the agent's tools: they return names + codes only, never nutrient values.

const INDB_URL = "https://github.com/lindsayjaacks/Indian-Nutrient-Databank-INDB-/raw/main/INDB.xlsx";
const IFCT_URL = "https://cdn.jsdelivr.net/npm/@ifct2017/compositions/index.csv";
const FDC = "https://api.nal.usda.gov/fdc/v1";

type IndbRow = { food_code: string; food_name: string; energy_kcal: number; protein_g: number; carb_g: number; fat_g: number; fibre_g: number; servings_unit?: string; unit_serving_energy_kcal?: number };
type IfctRow = { code: string; name: string; kJ: number | null; p: number | null; c: number | null; f: number | null; fib: number | null };

let indb: Promise<Map<string, IndbRow>> | null = null;
let ifct: Promise<Map<string, IfctRow>> | null = null;

/** INDB "Nutrient Data" by food_code (1,014 recipes). A failed download is retried on the next call. */
export function indbRows() {
  indb ??= (async () => {
    const res = await fetch(INDB_URL, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(`INDB download: HTTP ${res.status}`);
    const wb = XLSX.read(Buffer.from(await res.arrayBuffer()), { type: "buffer" });
    const rows = XLSX.utils.sheet_to_json<IndbRow>(wb.Sheets["Nutrient Data"]);
    return new Map(rows.map((r) => [r.food_code, r]));
  })().catch((e) => {
    indb = null;
    throw e;
  });
  return indb;
}

/** IFCT 2017 compositions by code (the npm package's CSV; kJ, protein, available carbs, fat, fibre). */
export function ifctRows() {
  ifct ??= (async () => {
    const res = await fetch(IFCT_URL, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(`IFCT download: HTTP ${res.status}`);
    const rows = parseCsv(await res.text());
    const head = rows[0].map((h) => h.split(";").pop()!.trim());
    const col = (k: string) => head.indexOf(k);
    const out = new Map<string, IfctRow>();
    for (const r of rows.slice(1)) {
      const num = (k: string) => (r[col(k)] === "" || r[col(k)] == null ? null : Number(r[col(k)]));
      out.set(r[col("code")], { code: r[col("code")], name: r[col("name")], kJ: num("enerc"), p: num("protcnt"), c: num("choavldf"), f: num("fatce"), fib: num("fibtg") });
    }
    return out;
  })().catch((e) => {
    ifct = null;
    throw e;
  });
  return ifct;
}

const fdcKey = () => serverEnv().USDA_API_KEY ?? "DEMO_KEY";
const fdcCache = new Map<number, SourceRow & { name: string; dataType: string; portions: string[] }>();

/** One USDA food by fdcId: per 100 g values (FNDDS energy 208, or the Atwater rows), alcohol, household portions. */
export async function usdaFood(fdcId: number) {
  const hit = fdcCache.get(fdcId);
  if (hit) return hit;
  const res = await fetch(`${FDC}/food/${fdcId}?api_key=${fdcKey()}`, { signal: AbortSignal.timeout(20_000) });
  if (res.status === 404) throw new Error(`USDA ${fdcId} doesn't exist`);
  if (!res.ok) throw new Error(`USDA ${fdcId}: HTTP ${res.status}`);
  type N = { amount?: number; nutrient?: { number?: string } };
  const d = (await res.json()) as { description: string; dataType: string; foodNutrients?: N[]; foodPortions?: { portionDescription?: string; amount?: number; measureUnit?: { name?: string }; modifier?: string; gramWeight: number }[] };
  const by = (...nums: string[]) => {
    for (const n of nums) {
      const x = d.foodNutrients?.find((fn) => String(fn.nutrient?.number) === n);
      if (x && x.amount != null) return x.amount;
    }
    return null;
  };
  const v = {
    name: d.description, dataType: d.dataType, fdcId,
    kcal: by("208", "958", "957"), p: by("203"), c: by("205"), f: by("204"), fib: by("291"), alc: by("221"),
    portions: (d.foodPortions ?? []).map((p) => `${p.portionDescription || `${p.amount ?? ""} ${p.measureUnit?.name ?? ""} ${p.modifier ?? ""}`.trim()} = ${p.gramWeight} g`),
  };
  fdcCache.set(fdcId, v);
  return v;
}

export type UsdaHit = { fdcId: number; description: string; dataType: string };
/** USDA search over FNDDS (survey foods), SR Legacy and Foundation. */
export async function usdaSearch(query: string, pageSize = 10): Promise<UsdaHit[]> {
  const res = await fetch(`${FDC}/foods/search?api_key=${fdcKey()}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(20_000),
    body: JSON.stringify({ query, dataType: ["Survey (FNDDS)", "SR Legacy", "Foundation"], pageSize }),
  });
  if (!res.ok) throw new Error(`USDA search: HTTP ${res.status}`);
  const d = (await res.json()) as { foods?: UsdaHit[] };
  return (d.foods ?? []).map((f) => ({ fdcId: f.fdcId, description: f.description, dataType: f.dataType }));
}

const norm = (x: string) => x.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** "search: <exact description>" → its fdcId (exact match only, like the laptop checker), else the closest names. */
export async function usdaExact(desc: string): Promise<number> {
  const hits = await usdaSearch(desc, 25);
  const hit = hits.find((f) => norm(f.description) === norm(desc));
  if (!hit) throw new Error(`USDA "${desc}" not found exactly; closest: ${hits.slice(0, 3).map((f) => `"${f.description}" (${f.fdcId})`).join(", ")}`);
  return hit.fdcId;
}

// ── name search for the agent's tools: every query word must appear (prefix match), best first ──
function rank<T>(items: T[], name: (t: T) => string, query: string, limit: number): T[] {
  const words = norm(query).split(" ").filter((w) => w.length > 1);
  if (!words.length) return [];
  const scored: { t: T; s: number }[] = [];
  for (const t of items) {
    const n = ` ${norm(name(t))} `;
    let s = 0;
    for (const w of words) {
      if (n.includes(` ${w} `)) s += 3;
      else if (n.includes(` ${w}`)) s += 2;
      else if (n.includes(w)) s += 1;
    }
    if (s) scored.push({ t, s: s - n.length / 200 });
  }
  return scored.sort((a, b) => b.s - a.s).slice(0, limit).map((x) => x.t);
}

export async function indbSearch(query: string, limit = 8) {
  const rows = [...(await indbRows()).values()];
  return rank(rows, (r) => r.food_name, query, limit).map((r) => ({ code: r.food_code, name: r.food_name, serving: r.servings_unit ?? null }));
}

export async function ifctSearch(query: string, limit = 8) {
  const rows = [...(await ifctRows()).values()];
  return rank(rows, (r) => r.name, query, limit).map((r) => ({ code: r.code, name: r.name }));
}

// ── the checker's `sourced()` for INDB / IFCT / USDA references (FOOD refs are resolved by the caller) ──
export async function sourcedRef(src: SourceRef): Promise<SourceRow> {
  if (src.id === "INDB") {
    const r = (await indbRows()).get(String(src.ref));
    if (!r) throw new Error(`INDB code ${src.ref} not found`);
    return { name: r.food_name, kcal: r.energy_kcal, p: r.protein_g, c: r.carb_g, f: r.fat_g, fib: r.fibre_g };
  }
  if (src.id === "IFCT2017") {
    const r = (await ifctRows()).get(String(src.ref));
    if (!r) throw new Error(`IFCT code ${src.ref} not found`);
    const kcal = r.kJ ? r.kJ / 4.184 : r.f != null && r.f > 90 ? r.f * 9 : null; // IFCT pure fats carry no energy: 9 kcal/g fat
    if (kcal == null) throw new Error(`IFCT ${src.ref} (${r.name}) has no energy value`);
    // a few IFCT rows contradict themselves (N001 chicken leg: 384 kcal from kJ, 192 from its own protein + fat)
    const fromMacros = 4 * (r.p ?? 0) + 4 * (r.c ?? 0) + 9 * (r.f ?? 0);
    if (r.kJ && Math.abs(kcal - fromMacros) > Math.max(40, kcal * 0.2))
      throw new Error(`IFCT ${src.ref} (${r.name}) is inconsistent: ${Math.round(kcal)} kcal from energy vs ${Math.round(fromMacros)} from its macros; use another row`);
    return { name: r.name, kcal, p: r.p, c: r.c, f: r.f, fib: r.fib };
  }
  if (src.id === "USDA") {
    const ref = String(src.ref ?? "");
    const id = /^search:/i.test(ref) ? await usdaExact(ref.replace(/^search:\s*/i, "")) : Number(ref.match(/\d{4,}/)?.[0]);
    if (!id) throw new Error(`USDA ref "${ref}" has no fdcId`);
    const v = await usdaFood(id);
    if (v.kcal == null) throw new Error(`USDA ${id} has no energy value`);
    return v;
  }
  throw new Error(`can't read source "${src.id}"`);
}
