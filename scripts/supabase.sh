#!/bin/sh
# Runs the Supabase CLI against the hosted project, using credentials from .env / .env.local.
#   npm run db:push     create/update tables (supabase/migrations)
#   npm run auth:push   push auth settings from supabase/config.toml (Google sign-in, redirect URLs)
#   npm run env:keys    fill NEXT_PUBLIC_SUPABASE_URL / _PUBLISHABLE_KEY (fetched with the access token)
set -e
cd "$(dirname "$0")/.."

# same precedence as Next.js: .env.local overrides .env
[ -f .env ] || [ -f .env.local ] || { echo "Missing .env. Copy .env.example to .env and fill it in."; exit 1; }
eval "$(node scripts/load-env.mjs)"
ENV_FILE=$([ -f .env.local ] && echo .env.local || echo .env) # where env:keys writes

need() { for v in "$@"; do eval "val=\${$v:-}"; [ -n "$val" ] || { echo "Missing $v in $ENV_FILE"; exit 1; }; done; }
need SUPABASE_PROJECT_REF
# token optional: without it the CLI uses the login saved by `npx supabase login`
if [ -n "${SUPABASE_ACCESS_TOKEN:-}" ]; then export SUPABASE_ACCESS_TOKEN; else unset SUPABASE_ACCESS_TOKEN; fi

case "$1" in
  db)
    need SUPABASE_DB_PASSWORD
    npx supabase link --project-ref "$SUPABASE_PROJECT_REF" --password "$SUPABASE_DB_PASSWORD"
    npx supabase db push --password "$SUPABASE_DB_PASSWORD"
    ;;
  auth)
    need GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET
    export GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET
    npx supabase config push --project-ref "$SUPABASE_PROJECT_REF"
    ;;
  keys)
    url="https://$SUPABASE_PROJECT_REF.supabase.co"
    key=$(npx supabase projects api-keys --project-ref "$SUPABASE_PROJECT_REF" -o json | node -e '
      const list = [].concat(JSON.parse(require("fs").readFileSync(0, "utf8")));
      const str = (k) => Object.values(k).filter((v) => typeof v === "string");
      // prefer the new publishable key, fall back to the legacy anon key
      const pub = list.flatMap(str).find((v) => v.startsWith("sb_publishable_"));
      const anon = list.find((k) => k.name === "anon");
      const key = pub ?? anon?.api_key ?? anon?.key;
      if (!key) { console.error("No publishable/anon key found"); process.exit(1); }
      process.stdout.write(key);')
    node -e '
      const fs = require("fs"), [file, url, key] = process.argv.slice(1);
      let s = fs.readFileSync(file, "utf8");
      const put = (name, val) => { const re = new RegExp("^" + name + "=.*$", "m"); s = re.test(s) ? s.replace(re, name + "=" + val) : s.trimEnd() + "\n" + name + "=" + val + "\n"; };
      put("NEXT_PUBLIC_SUPABASE_URL", url);
      put("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", key);
      fs.writeFileSync(file, s);' "$ENV_FILE" "$url" "$key"
    echo "Wrote NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to $ENV_FILE"
    ;;
  *) echo "usage: scripts/supabase.sh db|auth|keys"; exit 1 ;;
esac
