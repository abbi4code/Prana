# Setup: Supabase + Google sign-in

One-time setup. The code is already done.

## Fast route: Supabase CLI (recommended)

The CLI (a dev dependency, `npx supabase`) does Parts B, C and E below for you. You only collect values into `.env` (or `.env.local`):

| Variable in `.env` | Where to get it |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | *Optional.* supabase.com/dashboard/account/tokens (avatar → Account preferences → Access Tokens) → **Generate new token**. Or skip it and run `npx supabase login` once |
| `SUPABASE_PROJECT_REF` | Project Settings → General → **Project ID** |
| `SUPABASE_DB_PASSWORD` | The password you set when creating the project (reset: Project Settings → Database) |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google Cloud, Part D below |

Then run:
```bash
npm run db:push     # creates the tables from supabase/migrations
npm run env:keys    # writes NEXT_PUBLIC_SUPABASE_URL + publishable key into .env.local
npm run auth:push   # turns on Google sign-in + sets redirect URLs (from supabase/config.toml)
```
`auth:push` only touches what `supabase/config.toml` declares (redirect URLs + Google). Keep that file minimal: the CLI's
full template would overwrite unrelated dashboard settings (email confirmations, MFA, pooler sizes). Preview any change with
`npx supabase config diff --project-ref <ref>` first. Still manual: creating the project (Part A) and the Google client (Part D).
`.env` is parsed like Next.js does (`scripts/load-env.mjs`), so passwords with `&`, `$` etc. need no quoting.

**Status (2026-09-24):** done. Project `fitness` (`ibioqnkpbvxgsmhswgyd`, Mumbai): tables pushed, RLS verified
(anonymous reads return nothing, writes are rejected), Google provider live.

## Manual route: dashboard only

Estimated time: ~20 minutes. Keep one text file open to paste values into as you go.

## Part A: Create the Supabase project (5 min)

1. Go to **supabase.com** → sign in with GitHub or Google → **New project**.
2. Fill in:
   - **Name:** anything, e.g. `prana`
   - **Database password:** click *Generate*, then **save it somewhere** (you rarely need it, but can't view it again)
   - **Region:** *South Asia (Mumbai)*, closest to you = fastest
3. Click **Create project** and wait ~2 minutes until it's ready.

## Part B: Create the tables (2 min)

1. In the left menu open **SQL Editor** → **New query**.
2. Open the file `supabase/migrations/0001_init.sql` from this project, copy **everything**, paste it in.
3. Click **Run**. You should see "Success. No rows returned".
4. Check: left menu **Table Editor** → you should see `food_logs`, `user_goals`, `weights`, `water`.

## Part C: Connect the app to Supabase (3 min)

1. In the project folder, copy `.env.example` to a new file named **`.env.local`**.
2. In Supabase, click the **Connect** button at the top (or **Project Settings → API Keys**).
3. Copy the **Project URL** (looks like `https://abcd1234.supabase.co`) → paste as `NEXT_PUBLIC_SUPABASE_URL`.
4. Copy the **Publishable key** (starts with `sb_publishable_`) → paste as `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
   - Older projects show an **anon** key instead. That works too (you can paste it into the same line).
   - **Never** put the *secret* / *service_role* key in this file.
5. Keep the Supabase tab open: you need its callback URL in Part D.

## Part D: Create Google login credentials (10 min)

Checked against Supabase + Google docs, Sep 2026. Our Supabase callback URL is
`https://ibioqnkpbvxgsmhswgyd.supabase.co/auth/v1/callback`.

1. **Use a separate Google Cloud project.** At console.cloud.google.com click the project picker at the top
   (it may show an existing project, e.g. "Gemini API") → **New project** → name `fitness` → **Create** → select it.
2. Search bar → **Google Auth Platform** → **Get started**:
   - App information: **App name** `Prana`, **User support email** = your Gmail → Next
   - Audience: **External** → Next
   - Contact information: your Gmail → Next
   - Finish: tick the agreement → **Continue** → **Create**
3. Left menu **Audience** → **Test users** → **+ Add users** → your Gmail → Save.
   While "Publishing status" is *Testing*, only test users can sign in (max 100). Fine for personal use.
4. Left menu **Data Access** → **Add or remove scopes** → tick `.../auth/userinfo.email`, `.../auth/userinfo.profile`
   and `openid` → **Update** → **Save**. Don't add other scopes (they trigger Google verification).
5. Left menu **Clients** → **+ Create client**:
   - Application type: **Web application**, Name: `Prana web`
   - **Authorized JavaScript origins** → + Add URI → `http://localhost:3000`
   - **Authorized redirect URIs** → + Add URI → the Supabase callback URL above (exactly)
   - **Create**
6. **Copy the Client ID and Client secret right away** (or click *Download JSON*).
   Since 2025 Google shows the secret only once. If lost: open the client → **Add secret**.
   Paste them into `.env` as `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.

Note: Google deletes OAuth clients unused for 6 months (restorable for 30 days).

## Part E: Turn on Google in Supabase (2 min)

1. Back in Supabase **Authentication → Sign In / Providers → Google**:
   - Toggle **Enable** on
   - Paste **Client ID** and **Client Secret** → **Save**
2. **Authentication → URL Configuration**:
   - **Site URL:** `http://localhost:3000`
   - **Redirect URLs** → **Add URL** → `http://localhost:3000/**` → Save

## Part F: Try it

1. Stop the dev server if it's running (Ctrl+C) and start it again with `npm run dev`, because env files are only read at start.
2. Open `http://localhost:3000` → **Continue with Google** → pick your account.
3. You land back on Today. **Me** shows your name, photo and "Synced just now".
4. Check: Supabase **Table Editor → food_logs**. Log a food in the app and it appears within ~2 seconds.

## Later, when deploying (e.g. Vercel)

Add the deployed address (e.g. `https://prana.vercel.app`) in three places:
- Google Cloud → **Clients → Prana web** → Authorized JavaScript origins
- Supabase → **URL Configuration** → Redirect URLs: `https://prana.vercel.app/**` (and set it as Site URL)
- Vercel → Project → **Environment Variables**: the same two `NEXT_PUBLIC_SUPABASE_*` values

## If something goes wrong

| You see | Fix |
|---|---|
| "Continue with Google" is greyed out | `.env.local` missing or dev server not restarted |
| Google says **redirect_uri_mismatch** | The redirect URI in Google Cloud must exactly equal Supabase's callback URL (Part D.5) |
| Google says **access blocked / app not verified** | Add your Gmail under **Audience → Test users** (Part D.4) |
| Back on the app: "Sign-in didn't finish" | Check Supabase **Redirect URLs** includes `http://localhost:3000/**` (Part E.2) |
| Me shows **Sync failed: relation … does not exist** | The SQL in Part B didn't run; run it again |
