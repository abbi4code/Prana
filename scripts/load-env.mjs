// Prints .env then .env.local as shell `export` lines (safely quoted), for scripts/supabase.sh.
// Uses Node's dotenv-compatible parser, so passwords with & $ ; etc. work unquoted, as in Next.js.
import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";

const vars = {};
for (const file of [".env", ".env.local"]) if (existsSync(file)) Object.assign(vars, parseEnv(readFileSync(file, "utf8")));
const q = (v) => `'${v.replaceAll("'", `'\\''`)}'`;
for (const [k, v] of Object.entries(vars)) if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(k)) console.log(`export ${k}=${q(v)}`);
