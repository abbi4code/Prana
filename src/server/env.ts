import "server-only";
import { z } from "zod";
import { DEFAULT_MODEL } from "@/lib/nl/request";

// Server-only configuration. Read lazily (first request), so `next build` works without secrets.
// Secrets must NEVER use the NEXT_PUBLIC_ prefix: Next.js inlines those into browser bundles.
const Env = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  SUPABASE_SECRET_KEY: z.string().min(20),
  OPENAI_API_KEY: z.string().min(20),
  NL_MODEL: z.string().default(DEFAULT_MODEL),
  NL_PARSE_PER_MINUTE: z.coerce.number().int().positive().default(10),
  NL_PARSE_PER_DAY: z.coerce.number().int().positive().default(200),
});

let cached: z.infer<typeof Env> | null = null;

export function serverEnv() {
  if (cached) return cached;
  const parsed = Env.safeParse(process.env);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Server env invalid or missing: ${missing}`);
  }
  cached = parsed.data;
  return cached;
}
