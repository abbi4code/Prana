# Social: leaderboard + challenges

Status: **built 2026-09-27 (D46, D47)**: phases 1 + 2 of the build order (+ lift challenges from phase 3). Migrations `20260927100000_social`, `20260927101000_challenges` **not pushed yet**. Not built: leagues, gym boards, video proof, moderation screen, push notifications, challenge-result badges. Owner's ask: (1) challenges ("deadlift 100 kg with someone, or everyone"), (2) a leaderboard of everyone who signs up, week + month, ranked "first each day's gym streak, then exercises done each day, then calories burned each day"; "find the best way possible, build everything the user might need". This un-parks "Social feed / friends" (future.md).

## What we build on
- Sign-in (Google via Supabase); guests stay local-only and never appear.
- **Server-verified gym visits** (`gym_visits`, written only by the server; GPS distance to the user's saved gym): the only signal a user can't type in.
- Workouts sync to `workouts` (jsonb, user-written → self-reported; kcal is estimated on the device and scales with body weight).
- Streak engine `lib/streaks.ts` (pure TS, rest days, freezes), PRs (`lib/records.ts`, Brzycki ≤ 10 reps), badges (`lib/badges.ts`) — all derived, can run on the server too.
- Phone nav already has 5 tabs → social needs to share a tab.

## Research (2026-09-27)
- **Apple Watch competitions:** 1:1, 7 days, **1 point per % of your own ring goals, max 600/day** → normalised to personal goals, capped ([Apple](https://support.apple.com/guide/watch/share-your-activity-apd68a69f5c7/watchos)).
- **Strava:** club boards reset weekly (top 100 + last week); group challenges private to members; **manual activities never count**; "Only You" activities excluded; cheat handling = ML auto-flags + community flags + action on repeat offenders ([clubs](https://support.strava.com/en-us/articles/15402172-clubs-on-strava), [challenges](https://support.strava.com/en-us/articles/15401916-strava-challenges), [guidelines](https://support.strava.com/en-us/articles/15401921-segment-leaderboard-guidelines)).
- **Hevy:** friends-only leaderboard by heaviest lift, no bodyweight normalisation. **Garmin:** weekly step boards, opt-in badge challenges. **Nike Run Club:** user-made challenges, top-3 medals. **Peloton:** block, hide from search, private profile. **Fitbit removed challenges/open groups (Mar 2023, low use).** **Duolingo leagues:** weekly, ~matched peers, 10 tiers with promotion/demotion.
- **Motivation:** gamification meta-analysis (16 RCTs) g = 0.42, fading to 0.15 at follow-up ([Mazeas 2022](https://pmc.ncbi.nlm.nih.gov/articles/PMC8767479/)); **competition beat support/collaboration** in STEP UP (teams of 3, weekly points leaderboard; +920 steps/day, only arm lasting at follow-up) ([Patel 2019](https://jamanetwork.com/journals/jamainternalmedicine/fullarticle/2749761)); **low ranks demotivate**; small peer groups of 10–20 work better ([CHI 2019](https://dl.acm.org/doi/10.1145/3290605.3300397)).
- **Fairness:** raw kg favours heavy lifters (powerlifting normalises: IPF GL); Prana's kcal burn scales with body weight → heavier people "win" automatically. Diet/fitness app use is associated with disordered eating + compulsive exercise (cross-sectional) ([review](https://pmc.ncbi.nlm.nih.gov/articles/PMC12547374/)); overtraining = overload without recovery; WHO sets minimums (150–300 min, strength 2+ days), no daily maximums.
- **Anti-cheat:** exclude/limit manual backdating; plausibility flags; community flags; e1RM only reliable ≤ 10 reps ([LeSuer 1997](https://journals.lww.com/nsca-jscr/abstract/1997/11000/the_accuracy_of_prediction_equations_for.1.aspx)). No sourced "PR jump" threshold: ours are defaults.
- **India (DPDP Act 2023 + Rules 2025):** child = under 18; verifiable parental consent; **tracking/behavioural monitoring/profiling of children banned** (s.9) → 18+ gate for social; consent withdrawal + erasure (s.12). Substantive duties from 14 May 2027 (proposal to advance to 13 Nov 2026 not confirmed). Location risk (Strava heatmap incidents) → never show gym, map or times.

## Proposed design
**Ranking** (weekly Mon–Sun IST + monthly, computed only on the server, lexicographic):
1. **Active days** in the period: a verified gym visit ≥ 20 min, or a plausible workout (≥ 15 min or ≥ 6 working sets). **Capped at 6/week, 26/month** (rest is never punished). Keeps "gym streak first" per period (a lifetime streak would lock early users at the top forever); the streak shows as a 🔥 column.
2. **Effort points:** each day min(100 %, your sets ÷ your sets goal, or minutes ÷ your minutes goal) — Apple-style % of your own goal, capped. Replaces "exercises done" (splitting a session into tiny exercises would win).
3. **Verified gym days.** 4. Still tied → shared rank (never "who logged first").
- **Calories burned are not ranked** (body weight bias + eating-disorder risk); they stay private.

**Scopes:** Friends (mutual, invite link or @handle; default tab) · Global (top 10 + the 5 above/below you + your percentile) · later Leagues (~20 matched people, weekly promotion) · later opt-in Gym board (≥ 5 verified members, no times).

**Challenges** (1:1, group ≤ 20, open to everyone): consistency ("N active days in D days", verified-only option), active minutes (≤ 120/day counted), cooperative group goal, **lift target** (an actual logged set of 1–5 reps ≥ target, never a high-rep e1RM; optional % of bodyweight or % over your own best as a handicap). Invite → accept within 48 h → starts next day 00:00 IST, 7/14/30 days; entries count if logged within 24 h; no-show = "didn't start", no penalty; leave anytime; shared ties; badges as rewards; reminders at start / midway / 24 h left (mutable).

**Privacy:** off by default; separate consent screen; chosen display name + @handle (profanity + reserved-name filter), not the Google name; public = active days, points, streak, badges only (never weight, food, calories, gym, map, times); 18+; block, report, hide from search; leaving deletes leaderboard rows; account deletion erases all.

**Anti-cheat:** server-computed scores only (no client writes); guests never rank; backdating limit 48 h for boards; hard caps (4 h or 40 working sets a day; lifts above world-record level rejected); soft flag for a new best > 15 % over the previous best within 14 days (counts for you, held off boards until reviewed); 3 distinct reporters auto-hide pending review; new accounts (< 14 days or < 3 verified visits) stay out of the global top 100; ✓ verified-day share shown next to names.

**Build order:** 1) profile (name/handle), 18+ gate, consent, friends, server-computed Friends + Global boards, block/report · 2) consistency/minutes/group challenges, badges, in-app notifications · 3) lift challenges (plausibility + proof), leagues · 4) gym boards, trust levels, moderation queue.

## Decisions (owner, 2026-09-27)
All four recommended options: ranking **active days → effort → verified days**, calories never ranked (D46); **opt-in**, chosen name + @handle, 18+ (D46); lift proof = **verified visit + plausibility checks + disputes now, video later** (D47); new **Akhada** tab (Leaderboard · Challenges · Awards) replacing Awards (D46).

## As built (2026-09-27)

**Trust model:** the app never sends a score. `activity_days` (one row per user per IST day) is written only by triggers on `workouts` and `gym_visits`; boards and challenge progress are computed from it (and, for lifts, from the synced sets) by `security definer` functions that check `auth.uid()`. Tables are read-own under RLS or server-only; a direct UPDATE by a user silently changes nothing. Every function is revoked from `public`/`anon`; user-facing ones are granted to `authenticated`, helpers to nobody.

| Piece | Where |
|---|---|
| Profiles, name filter, activity trigger, friends, blocks, reports, inbox, streak, leaderboard | `supabase/migrations/20260927100000_social.sql` |
| Challenges (create / invite / join / decline / leave / cancel / dispute / get / list, progress) | `supabase/migrations/20260927101000_challenges.sql` |
| Client calls + error reasons | `src/lib/social/api.ts` (`social.*`, `challenges.*`, `failText`) |
| Client state | `src/lib/social/state.ts` (`useSocial` profile + counts, `useSocialBoot`, `useRemote` cached reads, `AVATARS`, resume-after-sign-in) |
| Screens | `src/app/akhada/page.tsx` (tabs), `akhada/c/[id]` (challenge link), `akhada/join/[token]` (invite link); `components/akhada/` Profile (gate, consent/edit form, avatar), Leaderboard, People (person / friends / inbox sheets), Challenges (tab, create, detail), AkhadaCard (Me) |
| Awards | `components/achievements/AchievementsView.tsx` (moved from the page); `/achievements` redirects to `/akhada?tab=awards` |

**Activity day** (`activity_refresh`): working sets (1–100 reps or a 1–900 s hold, 0–500 kg; others counted as `flagged`), minutes recomputed on the server (reps × 3 s + rest ≤ 300 s per set; cardio 0–300 min per bout), caps 40 sets / 240 min a day; counted gym visit = ended, ≥ 20 min, local IST start day; **logs and visits inserted more than 48 h after the day ended don't count** (server `created_at`). Active = visit or ≥ 15 min or ≥ 6 sets. Effort = max(sets/12, minutes/30, visit 50 %) capped at 100. Defaults, not sourced constants.

**Board** (`social_board(scope, period)`): members = you + accepted friends, or listed + trusted + not hidden (global); best 6 days a week / 26 a month by effort; `rank()` over (active, effort, verified) so ties share; global returns top 10 + 5 around you; **trust** = profile ≥ 14 days old or ≥ 3 verified gym days (else you see a note, no global rank); **hidden** = 3 different unresolved reports (name / cheating / harassment) in 60 days. Streak = `social_streak`, a port of `runStreak` (rest days from `user_goals.fitness.restDays`, freezes), verified equal to the TS version on random histories.

**Friends:** request by @handle (the other side accepts), or the **invite link** `/akhada/join/<token>` (the token is the inviter's consent: friends at once; can be reset). Search: listed people + friends, never across a block, `%`/`_` escaped. Block removes the friendship and the inbox items both ways and hides both from each other.

**Names:** `social_norm` = leetspeak → letters → collapse repeats; banned list of English + Hinglish abuse with spelling variants. Left out on purpose because they hit real names: shit (Shital), nazi (Nazia), gand (Gandhi), chod (Chodankar), lauda, rape (grape), dick, jhat. Reserved handles (admin, prana*, support…).

**Challenges:** kinds `lift` (best real set of 1..max_reps ≤ 5 at ≥ target; ✓ when its `visitId` is a verified gym visit; > 15 % over the best of the previous 120 days = "big jump"; unverified sets drop out when disputes ≥ half of the other members), `days` (active days, optional verified-only), `minutes` (≤ 120 a day), `team_minutes` (everyone's minutes vs one goal). Invites only to friends; anyone with the link code can join; open ones are listed for everyone (not from blocked or hidden creators); 1–60 days, start within 30 days; only the creator cancels, before the start.

**Tests** (scratchpad, not in the repo): all migrations replayed on **PGlite** (Postgres in WASM, `@electric-sql/pglite`) with a stub `auth` schema + roles, run as `authenticated` with a JWT subject so RLS applies: 40+ checks (lockouts, name filter incl. real names, activity rules, streak = TS, friends/invites/blocks/search, boards incl. caps/ties/trust/hiding, all challenge kinds, verify/flag/dispute, leave). Then the real UI in Chrome with every Supabase RPC answered by PGlite as that user: join → friend → board → Everyone → person → create lift challenge → set counts (self-reported) → invite link → join open challenge → inbox → /achievements redirect → Me card. No page errors.

## Part 2 as built (2026-09-27): duels, results, kudos + nudges (D48, D49)
Migration `20260927120000_duels_results_kudos.sql` (**not pushed yet**). SQL tests: 15 more checks on PGlite (duel flow, best-6 scoring, provisional → final, lazy settling from either side, frozen results, tie-breaks, expiry/decline/cancel, challenge places + notifications, team goals, trophies, kudos rules, nudge rules + opt-out, RLS). Browser: 19 checks against PGlite (Trained today → Shabaash, Nudge, inbox texts, accept a duel, final duel, joint winners, Awards badges, nudge opt-out).

- **Duels** (`duels` table, server-only; `duel_create / respond / cancel / get / list`): pending → active (starts tomorrow, 7 days) → settled. `duel_json` state: pending / expired / declined / upcoming / live / ended (provisional) / final. Screens: "Weekly duels" block on the Challenges tab, `/akhada/d/[id]` (face-off, day-by-day bars, lead line, rematch, share).
- **Settling** (`social_sync` → `duel_settle`, `challenge_settle`; helpers are not callable by users): final from `ends_on + 3`; places are shared for equal done + value; a team goal is everyone's finish or no one's (no winner). `challenge_progress` returns `final`, `place` once settled. The challenge page shows a podium, your line ("You won! 👑", "Joint winners!", "You finished 2nd of 5"), "Provisional, final on …" before that, and Share.
- **Kudos + nudges** (`social_kudos`, `social_nudge`, `social_set_nudges`): friends list rows carry `kudosDay`, `kudosSent`, `canNudge`; the Friends board shows "Trained today" (one-tap Shabaash) and "Quiet for 3 days" (Nudge); `me.kudosToday` shows on your card.
- **Notifications:** `challenge_result`, `duel_invite`, `duel_accepted`, `duel_result`, `kudos`, `nudge` (with a `payload`), routed to the challenge / duel / person.
