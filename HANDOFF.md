# smudgeGAMES — Handoff Doc

A minigame arcade web app built by Keaton (age 12) in the "Shipyard" course, by
directing Claude. It's a real full-stack app: React front-end, Supabase
back-end + database, deployed on Vercel.

## Links
- **Live site:** https://smudgegames.vercel.app
- **GitHub repo:** https://github.com/SmudgeMuffin9/my-app
- **Local folder:** `~/shipyard/my-app`

## Run it locally
```bash
cd ~/shipyard/my-app
npm install        # first time only
npm run dev        # opens on http://localhost:5173 (or 5174 if busy)
```

## Ship it ("cpd" = commit, push, deploy)
When Keaton says **"cpd"**, run all three:
```bash
git add -A && git commit -m "<what changed>"
git push origin main
vercel --prod --yes
```
Then verify it's live (e.g. `curl -s https://smudgegames.vercel.app | grep title`)
and give Keaton the link. Don't trust the deploy blindly — confirm it.

## Tech stack
- **React 19 + Vite 8** (plain Vite, NOT Next.js — no /api routes)
- **Supabase** for auth + database (client lib `@supabase/supabase-js`)
- **Vercel** for hosting (deployed via the `vercel` CLI, NOT auto-deploy from
  GitHub — that's why `cpd` runs `vercel --prod` manually)
- Google Fonts: **Orbitron** (headings) + **Rajdhani** (body), loaded in `index.html`

## The games (10)
All in `src/`, each rendered by `App.jsx` based on the `activeGame` state.
| Game | File | `game` key | Score | Sort |
|------|------|-----------|-------|------|
| Reaction Time | `ReactionTime.jsx` | `reaction` | milliseconds | lower wins |
| Shoot the Target | `ShootTarget.jsx` | `shoot` | points | higher wins |
| Guess the Number | `GuessNumber.jsx` | `guess` | # of guesses | lower wins |
| Click Speed (CPS) | `ClickSpeed.jsx` | `cps` | total clicks | higher wins |
| Tic-Tac-Toe | `TicTacToe.jsx` | — | (no score) | minimax AI: easy/medium/hard |
| Snake | `SnakeGame.jsx` | `snake` | food eaten | higher wins |
| Whack-a-Mole | `WhackAMole.jsx` | `whack` | moles whacked in 30s | higher wins |
| Split Brain | `SplitBrain.jsx` | `split` | points (10/sec survived) | higher wins |
| Gravity Flip | `GravityFlip.jsx` | `gravity` | points (10/sec survived) | higher wins |
| Smudge Wipe | `SmudgeWipe.jsx` | `smudge` | smudges wiped | higher wins |

Both Gravity Flip and Smudge Wipe are ORIGINAL games (not clones of anything).
Gravity Flip: tap/Space to flip gravity, dodge floor/ceiling blocks — you can only
flip while stuck to a surface (kills a spam-to-float exploit). Smudge Wipe: tap
growing smudges before any reaches `MAX_R` and ends the game.

NOTE: when adding a game with a score, wire it in TWO places — the game's own
game-over screen (`<ScoreSaver .../>`) AND the `GAMES` list in `Leaderboards.jsx`
(the 🏆 tab). Easy to forget the second one.

## Key components & files
- `App.jsx` — the menu + simple router (switches between menu / each game / leaderboards)
- `GameCard.jsx` — reusable menu card
- `ScoreSaver.jsx` — drop into a game's game-over screen: AUTO-saves your score
  when it mounts (no button) and keeps only your BEST per game (replaces your old
  row only if the new score is better) + shows that game's Top 10. A `didSaveRef`
  guard makes the auto-save fire exactly once. Props: `game`, `score`, `lowerIsBetter`
- `Leaderboard.jsx` — Top 10 for one game. If the OWNER is logged in, each row
  gets a 🗑️ delete button (delete one score) AND a 🚫 ban button on non-owner
  rows. Front-end buttons are just convenience — the real guards are Supabase
  policies (see below).
- `db/bans-setup.sql` — the one-time SQL that powers the ban feature (run in the
  Supabase SQL Editor). Makes the `bans` table + owner-only ban/unban policies +
  restrictive policies so a banned username can't INSERT/UPDATE scores.
- `Leaderboards.jsx` — the "🏆 Leaderboards" tab page (renders a `Leaderboard` per game)
- `auth.jsx` — `AuthProvider` + `useAuth()`; tracks logged-in `user` and their `username`
- `AuthBar.jsx` — sign in (magic link) / sign out / shows username, on the menu
- `UsernamePicker.jsx` — pick a username ONCE (then it's locked)
- `profanity.js` — `checkUsername()` blocks bad/invalid usernames
- `owner.js` — `OWNER = 'smudgemuffin'`; `isOwner(name)` → shows 🔨 (owner) badge in gold
- `supabase.js` — Supabase client (URL + publishable key; key is safe in front-end)

## Supabase setup (already done)
- **Project ref:** `rpptipltsmafmcetofyd` (URL `https://rpptipltsmafmcetofyd.supabase.co`)
- **Auth:** Magic link (passwordless email). `signInWithOtp` with
  `emailRedirectTo: window.location.origin`.
  - Allowed Redirect URLs in Supabase: `http://localhost:5174` and `https://smudgegames.vercel.app`
- **Tables:**
  - `profiles` — `id` (=auth user id), `username` (unique, NOT updatable = locked once set), `created_at`
  - `scores` — `id`, `game`, `name` (username copy), `score` (integer), `user_id`, `created_at`;
    UNIQUE `(user_id, game)` so each player has ONE row per game (their best).
    NOTE: `user_id` has a foreign key to the auth users table — a score must
    belong to a REAL account (you can't insert a fake random id).
  - `bans` — `username` (PK), `created_at`. The list of banned usernames.
- **RLS policies:** everyone can READ scores/profiles/bans; only logged-in users
  can INSERT/UPDATE their own scores. Usernames have no UPDATE policy (locked).
  - **DELETE on scores:** only the owner. Policy checks the deleter's profile
    username = `smudgemuffin` (see `owner.js`). This is what makes the 🗑️
    leaderboard buttons actually work.
  - **BAN:** only the owner can INSERT/DELETE rows in `bans`. Two RESTRICTIVE
    policies on `scores` then block any banned username from INSERT/UPDATE, so a
    banned player literally can't post a score. The 🚫 button bans + wipes their
    scores. Full setup SQL is in `db/bans-setup.sql`.
  - ⚠️ GOTCHA: the owner username is stored as `SMUDGEMUFFIN` (caps), so owner
    policies must compare with `lower(...) = 'smudgemuffin'`, not a plain `=`
    (a plain `=` fails with "violates row-level security policy").
- To change DB schema/policies: Supabase dashboard → SQL Editor → run SQL.

## Conventions / patterns
- **Reuse components** (GameCard, ScoreSaver, Leaderboard) — "build once, use many."
- **Theme = master variables** in `src/index.css` `:root` (cyan `#22d3ee`, purple
  `#a855f7`, dark bg). Change there to re-skin the whole site.
- Games support **mouse + touch + keyboard** where it makes sense:
  - Reaction Time & Click Speed: spacebar works (ignores held key + ignores typing in inputs)
  - Snake: arrows/WASD + swipe
  - Shoot the Target: pointer-lock mouse scope on desktop, drag-to-aim + FIRE button on touch
- Keyboard listeners check `e.target.tagName` so they don't hijack typing in inputs.

## Known quirks (intentional)
- Reaction Time accepts impossibly-fast times. Keaton (owner) intentionally has a
  **3 ms** entry on that leaderboard — leave it unless he says otherwise.
- Vercel does NOT auto-deploy from GitHub; deploys are manual via `vercel --prod`.

## Ideas / next steps
- Goal is ~30 minigames (at 10). Keaton prefers ORIGINAL games over clones of
  famous ones ("something people can't just search up on Google").
- ✅ Owner can delete bad scores (🗑️) and BAN a username (🚫) — both done.
  Could add an un-ban UI later (right now un-ban = delete the row from `bans`
  via SQL).
- Tic-Tac-Toe has no leaderboard (could add a win counter).

## About Keaton (how to work with him)
- 12, learning by DIRECTING Claude (not hand-coding). Explain before doing, give
  2 options with tradeoffs on real choices, check his understanding. Gen-Z tone.
- Do NOT call him "director"/"boss" (he asked us to stop).
