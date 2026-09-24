// Name matching for natural-language logging and typo-tolerant search (nl-logging.md): foods, exercises, activities.
// PURE module: no app imports, no side effects, so it runs in the browser, on a server and in the
// eval script (node, type-stripping) alike. Matching is cheap → expensive:
//   1. exact name/alias (after Hinglish spelling canonicalisation)
//   2. word-prefix / containment
//   3. trigram similarity (typos)
// Scores are 0–1; callers treat < LOW_CONFIDENCE as "show alternatives".

/** Anything matchable: a food, an exercise, a cardio activity. */
export type Named = { id: string; name: string; aliases: string[] };

export const LOW_CONFIDENCE = 0.72;

/**
 * Lowercase, keep letters/digits (any script), and fold common Hinglish spelling variants so that
 * daal→dal, rotii→roti, paneer→panir, sabzi→sabji, chhole→chole. Applied to both
 * sides of every comparison, so it only has to be consistent, not linguistically perfect.
 */
export function canon(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, " ")
    .replace(/ee/g, "i")
    .replace(/oo/g, "u")
    .replace(/z/g, "j")
    .replace(/w/g, "v")
    .replace(/q/g, "k")
    .replace(/ph/g, "f")
    .replace(/chh/g, "ch")
    .replace(/([a-z])\1+/g, "$1") // doubled letters: daal, rotii, chilla
    .replace(/\s+/g, " ")
    .trim();
}

function trigrams(s: string): Set<string> {
  const out = new Set<string>();
  for (const word of s.split(" ")) {
    const w = `  ${word} `;
    for (let i = 0; i < w.length - 2; i++) out.add(w.slice(i, i + 3));
  }
  return out;
}

/** Jaccard similarity of padded word trigrams, like Postgres pg_trgm's similarity(). */
export function similarity(a: string, b: string): number {
  const ta = trigrams(a), tb = trigrams(b);
  if (!ta.size || !tb.size) return 0;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  return shared / (ta.size + tb.size - shared);
}

type Entry<T> = { item: T; names: string[]; grams: Set<string>[] };

export type Candidate<T extends Named = Named> = { item: T; score: number; via: "exact" | "prefix" | "fuzzy" };

export type Matcher<T extends Named> = {
  /** best candidates for one name, highest score first */
  match: (name: string, limit?: number) => Candidate<T>[];
};

export type MatcherOptions<T extends Named> = {
  /** tie-breaker for equal scores, e.g. staples or the user's own foods (keep it small, ≤ 0.05) */
  boost?: (item: T) => number;
  /** generic word → the food it means ("roti" → plain chapati); from data/aliases.json */
  prefer?: Record<string, string>;
};

/**
 * How sure we are about the top candidate, 0–1. A near-tie between the top two is ambiguous
 * ("dal" with no preference), so confidence drops below LOW_CONFIDENCE and the UI offers choices.
 */
export function confidenceOf(cands: Candidate[]): number {
  const [a, b] = cands;
  if (!a) return 0;
  if (b && a.score - b.score < 0.03) return Math.min(a.score, LOW_CONFIDENCE - 0.07);
  return a.score;
}

/**
 * Index a list of foods (catalog + custom foods). Build once per list; matching is then O(foods).
 * `boost` lets callers prefer foods (staples, the user's own foods) when scores tie.
 */
export function buildMatcher<T extends Named>(items: T[], { boost = () => 0, prefer = {} }: MatcherOptions<T> = {}): Matcher<T> {
  const preferred = new Map(Object.entries(prefer).map(([word, id]) => [canon(word), id]));
  const entries: Entry<T>[] = items.map((item) => {
    const names = [...new Set([item.name, item.name.replace(/\s*\(.*?\)\s*/g, " "), ...item.aliases, item.id.replace(/-/g, " ")].map(canon).filter(Boolean))];
    return { item, names, grams: names.map(trigrams) };
  });

  const match = (raw: string, limit = 3): Candidate<T>[] => {
    const q = canon(raw);
    if (!q) return [];
    const preferredId = preferred.get(q);
    const qGrams = trigrams(q);
    const qWords = q.split(" ");
    const out: Candidate<T>[] = [];

    for (const e of entries) {
      let best = 0;
      let via: Candidate["via"] = "fuzzy";
      for (let i = 0; i < e.names.length; i++) {
        const n = e.names[i];
        if (n === q) {
          best = 1;
          via = "exact";
          break;
        }
        // every query word starts a word of this name ("paneer butter" → "paneer butter masala")
        const words = n.split(" ");
        if (qWords.every((w) => words.some((nw) => nw.startsWith(w)))) {
          const coverage = q.length / n.length; // shorter extra text = closer
          const s = 0.8 + 0.15 * Math.min(1, coverage);
          if (s > best) { best = s; via = "prefix"; }
          continue;
        }
        const g = e.grams[i];
        let shared = 0;
        for (const t of qGrams) if (g.has(t)) shared++;
        const sim = shared / (qGrams.size + g.size - shared);
        // scale so a strong typo match (~0.5 trigram similarity) lands near LOW_CONFIDENCE
        const s = Math.min(0.79, sim * 1.35);
        if (s > best) { best = s; via = "fuzzy"; }
      }
      if (best >= 0.3) {
        let score = Math.min(1, best + boost(e.item));
        // a generic word ("roti") names one default; other exact hits become close alternatives
        if (preferredId) score = e.item.id === preferredId ? 1 : Math.min(score, 0.95);
        out.push({ item: e.item, score, via });
      }
    }
    return out.sort((a, b) => b.score - a.score || a.item.name.length - b.item.name.length).slice(0, limit);
  };

  return { match };
}
