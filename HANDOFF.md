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

## The games (7)
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

## Key components & files
- `App.jsx` — the menu + simple router (switches between menu / each game / leaderboards)
- `GameCard.jsx` — reusable menu card
- `ScoreSaver.jsx` — drop into a game's game-over screen: saves your BEST score
  (needs login) + shows that game's Top 10. Props: `game`, `score`, `lowerIsBetter`
- `Leaderboard.jsx` — Top 10 for one game. If the OWNER is logged in, each row
  gets a 🗑️ delete button (owner-only score deletion). Front-end button is just
  convenience — the real guard is a Supabase DELETE policy (see below).
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
    UNIQUE `(user_id, game)` so each player has ONE row per game (their best)
- **RLS policies:** everyone can READ scores/profiles; only logged-in users can
  INSERT/UPDATE their own. Usernames have no UPDATE policy (locked).
  - **DELETE on scores:** only the owner. Policy checks the deleter's profile
    username = `smudgemuffin` (see `owner.js`). This is what makes the 🗑️
    leaderboard buttons actually work.
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
- Goal is ~30 minigames (at 7). Mix quick games (e.g. Reflex Tap, Aim Trainer,
  Color Trap) with deeper ones (Dino Jump, Brick Breaker, Pong).
- ✅ Owner can delete bad scores from a leaderboard (done). Could add more owner
  powers later.
- Tic-Tac-Toe has no leaderboard (could add a win counter).

## About Keaton (how to work with him)
- 12, learning by DIRECTING Claude (not hand-coding). Explain before doing, give
  2 options with tradeoffs on real choices, check his understanding. Gen-Z tone.
- Do NOT call him "director"/"boss" (he asked us to stop).
