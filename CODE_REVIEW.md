# HashClout — Pre-Launch Code Review

_Reviewed at commit `cf193a9`. Findings ordered by severity. Nothing here blocks you from continuing to build — these are the things worth closing before the site goes public._

---

## 🔴 Critical — fix before public launch

### 1. Every API route is unauthenticated and unthrottled
None of the routes in `app/api/*` check who is calling or rate-limit. Consequences:

- **`/api/livekit/token`** mints a LiveKit **publish** token for *any* `roomName` with *any* `participantId`/`participantName` the caller sends. Anyone can join any debate room, impersonate any user, and publish audio/video. This is the most serious one. It should require an authenticated session and verify the caller is actually a participant of that match.
- **`/api/livekit/egress`** lets anyone start/stop HLS recording jobs for arbitrary rooms — direct cost abuse.
- **`/api/fact-check`, `/api/debate-respond`, `/api/moderate`, `/api/ai-pipeline`** all call OpenAI with your key. Anyone who finds these endpoints can burn your API budget at will (cost + denial-of-wallet).

**Fix:** gate each route behind a Supabase session check (verify the JWT server-side), and add basic per-user/IP rate limiting. For the LiveKit token route specifically, look up the match and confirm the requesting user is `player_a` or `player_b` before granting `canPublish`.

### 2. Scores are computed and written client-side — the leaderboard is forgeable
ELO, wins/losses, win-streak, and XP are calculated in the browser (`app/page.tsx` ~lines 596–665) and written with the anon key via `supabase.from("profiles").update(updates).eq("id", user.id)`. The profiles RLS policy (`lib/setup.sql`) allows a user to update **their own row with no column restriction**, so anyone can open the console and set their `elo_rating`/`xp_total`/`wins` to any number.

The match `winner` is also written from each client's own perspective (line 592) with only an `alreadyFinished` flag to deduplicate. Your git history (`fix: both-players-win bug`) shows this path is fragile.

**Fix:** make scoring server-authoritative. Derive the winner from the vote tally and compute ELO/XP in a trusted context (an API route using the service role key, or a Postgres function/RPC), and restrict which profile columns a client may update.

### 3. The service-role key is missing — "admin" writes silently fall back to anon
`app/api/ai-pipeline/route.ts` builds its client as:
```
SUPABASE_SERVICE_ROLE_KEY || NEXT_PUBLIC_SUPABASE_ANON_KEY
```
`SUPABASE_SERVICE_ROLE_KEY` is **not** in `.env.local`, so it falls back to the anon key. That means the "bypasses RLS" comment is false — those server writes are subject to RLS. Either they're silently failing (and AI scores/strikes never persist), or they're succeeding because `matches` RLS is wide open — both are bad.

**Fix:** add the real `SUPABASE_SERVICE_ROLE_KEY` to the server env (never `NEXT_PUBLIC_`), and remove the anon fallback so a misconfig fails loudly instead of silently.

### 4. Over-permissive RLS policies
`lib/matchmaking-setup.sql` has:
```sql
CREATE POLICY "Matched users can update entries"
  ON public.matchmaking_queue FOR UPDATE
  USING (true) WITH CHECK (true);
```
This lets anyone update anyone's queue rows. Combined with #2/#3, the data layer largely trusts the client. Audit every `USING (true)` / `WITH CHECK (true)` — public `SELECT` is fine, but open `UPDATE`/`INSERT` is not.

---

## 🟠 Correctness & robustness

### 5. Database writes ignore their errors
Many calls follow the pattern `.update(...).then(() => {})` — the `error` field is never inspected (`app/page.tsx`, `auth-context.tsx`). If RLS blocks a write (see #3), ELO/XP/strike updates fail silently and you'd have no signal. Check and log `error` on writes that matter.

### 6. AI pipeline strikes both players for any toxicity
`app/api/ai-pipeline/route.ts` (~line 136) flags **both** players when any toxicity is detected — the code comment admits it. An innocent debater accrues strikes. Score players individually before issuing a strike.

### 7. Moderation fails open
`/api/moderate` returns "not flagged" whenever the key is missing or the API errors. That's a reasonable availability choice, but it means toxic content passes freely during any OpenAI outage. Make sure that's intentional.

### 8. Fact-check rejects valid long claims
`/api/fact-check` rejects anything outside 12–120 characters as "Invalid claim." Legitimate longer claims are silently dropped. Consider raising the cap or truncating instead of rejecting.

---

## 🟡 Performance & stability

### 9. `app/page.tsx` is 2,288 lines with 51 timers
This single client component carries the entire arena/debate state machine and ~51 `setInterval`/`setTimeout` calls. This is the most likely source of the mobile "overheating" your recent commits chased. Two actions:
- Audit that **every** interval/timeout is cleared on unmount and on phase change (a missed clear, doubled by `reactStrictMode`, runs work forever).
- Decompose into smaller components/hooks so React can bail out of re-renders that currently re-run the whole tree.

---

## 🟢 Minor / polish

### 10. Facebook signup (now disabled)
The button called `supabase.auth.signInWithOAuth({ provider: "facebook" })`, but (a) the Facebook provider almost certainly isn't configured in the Supabase dashboard, (b) there's **no `/auth/callback` route** to complete the OAuth code exchange, and (c) the UI ignored the returned `error`, so failures were silent — exactly the "not working" symptom. **I've removed the button from both the Sign In and Sign Up forms** for now (`components/AuthModal.tsx`); the `signInWithFacebook` function is left intact in `lib/auth-context.tsx` so it's a one-line re-add later.

**To re-enable properly:** create a Facebook app, enable the Facebook provider in Supabase Auth with its App ID/secret, add `https://hashclout.io/auth/callback` to the allowed redirect URLs, add an `/auth/callback` route to exchange the code, and surface OAuth errors in the modal.

### 11. Redundant client-side profile creation
`createProfile` runs right after `signUp`, but a DB trigger (`handle_new_user` in `setup.sql`) already creates the profile. Before email confirmation there may be no session, so the client insert can hit RLS and fail — harmless because the trigger covers it, but the redundancy is worth cleaning up.

---

## ✅ What's already solid
- `.env.local` is gitignored and was **never** committed — no secrets in history, no hardcoded keys in source.
- Profile read/update RLS correctly scopes updates to the owner (the gap is column-level, per #2).
- Moderation, AI feedback, fact-check, ELO math, and the video phase state machine are thoughtfully structured.
- Local code, GitHub `origin/main`, and the Vercel deployment are all in sync.

---

### Suggested order of attack
1. Lock down the LiveKit token route (#1) — highest abuse potential.
2. Add the service-role key + move scoring/winner server-side (#2, #3).
3. Tighten RLS (#4) and add error checking on writes (#5).
4. Rate-limit the OpenAI-backed routes (#1).
5. Then performance refactor of `page.tsx` (#9) and the smaller correctness items.
