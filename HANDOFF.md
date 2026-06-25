# smudgeGAMES — Handoff Doc

A minigame arcade web app built by Keaton (age 12) in the "Shipyard" course, by
directing Claude. It's a real full-stack app: React front-end, Supabase
back-end + database, deployed on Vercel. It now also has player accounts, a
coin economy + shop, an idle game, and an owner admin panel.

## Links
- **Live site:** https://smudgegames.vercel.app
- **GitHub repo:** https://github.com/SmudgeMuffin9/my-app
- **Local folder:** `~/shipyard/my-app`

## Run it locally
```bash
cd ~/shipyard/my-app
npm install        # first time only
npm run dev        # http://localhost:5174  (pinned — see note below)
```
⚠️ **Use port 5174.** Google login only redirects back to URLs on Supabase's
approved list, and `http://localhost:5174` is approved. If Vite drifts to a
random port, login bounces you to the live site. To force it:
`npx vite --port 5174 --strictPort`.

## Ship it ("cpd" = commit, push, deploy)
When Keaton says **"cpd"**, run all three:
```bash
git add -A && git commit -m "<what changed>"
git push origin main
vercel --prod --yes
```
Then verify it's really live — don't trust the deploy blindly. Pattern used:
```bash
curl -s -o /dev/null -w "HTTP %{http_code}\n" https://smudgegames.vercel.app
# grab the live JS bundle and grep for a string only the new code has:
JS=$(curl -s https://smudgegames.vercel.app | grep -o '/assets/index-[^"]*\.js' | head -1)
curl -s "https://smudgegames.vercel.app$JS" | grep -o "<some new string>"
```

## Tech stack
- **React 19 + Vite 8** (plain Vite, NOT Next.js — no /api routes)
- **Supabase** for auth + database (client lib `@supabase/supabase-js`)
- **Vercel** for hosting (deployed via the `vercel` CLI, NOT auto-deploy from
  GitHub — that's why `cpd` runs `vercel --prod` manually)
- Google Fonts: **Orbitron** (headings) + **Rajdhani** (body), in `index.html`

## The games (13)
All in `src/`, each rendered by `App.jsx` based on the `activeGame` state.
| Game | File | `game` key | Score | Unlock |
|------|------|-----------|-------|--------|
| Reaction Time | `ReactionTime.jsx` | `reaction` | ms (lower wins) | free |
| Guess the Number | `GuessNumber.jsx` | `guess` | # guesses (lower wins) | free |
| Click Speed | `ClickSpeed.jsx` | `cps` | clicks (higher) | free |
| Tic-Tac-Toe | `TicTacToe.jsx` | — | (no score) | free |
| Whack-a-Mole | `WhackAMole.jsx` | `whack` | moles in 30s | free |
| Shoot the Target | `ShootTarget.jsx` | `shoot` | points | 🔒 buy 1,500 |
| Snake | `SnakeGame.jsx` | `snake` | food eaten | 🔒 buy 4,000 |
| Gravity Flip | `GravityFlip.jsx` | `gravity` | points (10/sec) | 🔒 buy 9,000 |
| Smudge Wipe | `SmudgeWipe.jsx` | `smudge` | smudges wiped | 🔒 buy 20,000 |
| Split Brain | `SplitBrain.jsx` | `split` | points (10/sec) | 🔒 buy 40,000 |
| Muffin Clicker | `MuffinClicker.jsx` | `muffin` | (its own muffins) | ⏱️ 30 min playtime |
| Smudge Survivors | `SmudgeSurvivors.jsx` | `survivor` | kills | free |
| Smudge Defense | `SmudgeDefense.jsx` | `defense` | waves cleared | ⏱️ 1 hr playtime |

- **Gravity Flip & Smudge Wipe** are ORIGINAL games (not clones). Gravity Flip:
  tap/Space flips gravity, dodge floor/ceiling blocks; you can only flip while
  stuck to a surface (kills a spam-to-float exploit). Smudge Wipe: tap growing
  smudges before one reaches `MAX_R`.
- **Smudge Survivors & Smudge Defense** are also ORIGINAL, and bigger (each has
  its own section below). Both render to a `<canvas>` (a single drawing surface
  the game repaints ~60×/sec) instead of divs — better for many moving objects.
- **Muffin Clicker** is a Cookie-Clicker-style idle game (see its own section).
- The free/locked split lives in `src/games.js` (`LOCKED` set + `TIME_LOCKED`).
  Prices live in the **database** (`game_prices` table), not the code.

NOTE: a new scored game must be wired in THREE places — its game-over screen
(`<ScoreSaver .../>`), the `GAMES` list in `Leaderboards.jsx`, and `src/games.js`
(for the menu + shop). And add a coin rate row in `coin_rates` if it should pay.

## Accounts & login (Google OAuth)
Login is **"Sign in with Google"** (we replaced the old magic-link email login).
- `AuthBar.jsx` calls `supabase.auth.signInWithOAuth({ provider: 'google', ... })`.
- Google Cloud OAuth client + Supabase Google provider are configured. Setup
  steps (for re-doing it) are in `GOOGLE_LOGIN_SETUP.md`.
- Custom **SMTP (Gmail)** is also configured in Supabase (Auth → Emails) so
  account emails aren't rate-limited — kept around even though login is Google.
- `auth.jsx` — `AuthProvider` + `useAuth()`. Tracks `user`, `username`, `coins`,
  `owned` (bought game keys, newest first), `playtime` (seconds), and
  `reloadProfile()` (re-reads the wallet). Also runs the playtime timer.

## The coin economy ("Smudge's")
Players earn **Smudge's** by playing and spend them in the **Shop** to unlock
games. THE GOLDEN RULE: players can never change their own coin balance — all
coin changes go through "cashier" functions in the database (`security definer`),
so cheating is blocked server-side. Full SQL: `db/shop-setup.sql`.

- **Earn:** `ScoreSaver` calls `award_coins(game, score)` on every game-over.
  The server computes the payout from the `coin_rates` table (rate × score, or
  for lower-is-better games `(baseline - score) × rate`), capped at 1,500/play.
- **Shop (`Shop.jsx`):** lists locked games + prices (from `game_prices`).
  Buying calls `buy_game(game)` which checks the price + balance, subtracts, and
  records the unlock — all in one safe step.
- **Owned games** show on the menu newest-bought-first; locked-not-owned games
  are hidden from the menu and only appear in the Shop.
- Pricier games pay more. Tuning lives in the DB (`game_prices`, `coin_rates`),
  so prices/payouts change with SQL, no redeploy.

## Muffin Clicker (`MuffinClicker.jsx`)
- Unlocks at **30 minutes of total playtime** (not coins). Progress bar shows in
  the Shop. Playtime ticks via `add_playtime(15)` every 15s while the tab is
  open (server-capped). Stored in `profiles.playtime_seconds`.
- Click the muffin (a real photo, `src/assets/muffin.png`, in a circular frame)
  → muffins. Buy **6 buildings** that auto-bake per second (cost ×1.15 each).
- **Upgrades** = 2 infinitely-stackable doublers (`2× Clicks`, `2× Baking`),
  each costing 10× the last.
- **Saves to `muffin_saves`** every 8s + on leave, and gives **offline earnings**
  (capped 8h) when you return. This is the only game that persists full state.

## Smudge Survivors (`SmudgeSurvivors.jsx`)
A top-down survival game. You're a dot; move with WASD/arrows or drag on mobile.
You **auto-shoot** the nearest enemy — the skill is dodging. Score = kills.
- Every few kills you **level up** and pick 1 of 3 upgrades (fire rate, damage,
  extra bullet, move speed, +health, piercing) — that's the "build" hook.
- **Anti-camp design (don't undo this):** enemies toughen up forever with time,
  the multishot fan is a tight cone (not a 360° spray), and every ~22s a **wave
  surge** spawns a full ring of enemies around you. Together these force you to
  *kite* (keep moving) instead of standing still — an earlier version let you
  camp dead-center and never die. Tuning knobs are at the top of the file.
- ⚠️ **`ENEMY_MAX_SPEED` (110) must stay BELOW `PLAYER_SPEED` (150) — don't
  remove it.** Before this cap (added 2026-06-25), enemy speed climbed forever
  (`50 + elapsed*5`) and passed your speed around ~20s, so they'd out-run you and
  the game became literally unwinnable ("can't survive the first swarm"). The cap
  guarantees good movement can always escape. Surges were also made less frequent
  (`SURGE_EVERY` 16→22) and smaller, and the speed ramp gentler (5→3).

## Smudge Defense (`SmudgeDefense.jsx`)
A fixed-path tower defense. Enemies walk a set road (`CORNERS` → `WAYPOINTS`) to
your 🏠; ones that arrive cost a life. Build towers on buildable cells for money.
Endless waves (press Start Wave), boss every 5th. Score = waves cleared.
- **30 towers** in one `TOWERS` array, built from a small set of "powers" mixed
  + matched: dmg/range/cooldown, `slow`, `dotDps` (poison), `splash`, `beam` +
  `chain` (lightning), `stun`, `knock`, and `aura` (buff towers, `shoot:false`).
  Add a tower = add one row. (Newest, added 2026-06-25: 🧲 Magnet = knock+slow,
  🌟 Prism = beam chain+slow, 🦠 Plague = poison+splash. Doomsday nerfed 80→60 dmg.)
- **Tap a tower in the tray → an info panel** shows what it does. The text is
  auto-generated by `describe(t)` from the tower's powers, so new towers describe
  themselves with no extra work.
- **No money-printer towers.** The 3 passive-income towers (Coiner/Bank/Vault)
  were removed on 2026-06-25 so you can't farm infinite cash and snowball — you
  now earn ONLY from kills + clearing waves. (The `income` power + its loop are
  gone too.) This is also what makes late waves bite: money stays tight.
- **Difficulty is a steady climb** (`makeWave`): enemy HP `3 + wave*3`, count
  `5 + wave*2.5`, speed capped at 100, boss every 5th at `×12` HP. Smooth ramp,
  no exponential spikes — retune those numbers to rebalance.
- **🔥 Hardcore mode** (toggle on the START screen): 10 lives (not 20), less
  starting cash, and `makeWave(wave, true)` makes enemies ×1.7 HP, ×1.4 count,
  ×1.15 speed. Pays **3× Smudge's** (rate 24 vs 8) and has its OWN leaderboard —
  see the hardcore-leaderboard note below.
- **💰 Cash Out button** ends the run on your terms and banks your Smudge's. The
  button previews the amount live via `coinsFor(wavesCleared, hardcore)`, which
  mirrors the DB rates (8 normal / 24 hardcore, capped 1500). `cashedOut` state
  just changes the game-over heading; the actual coin award is still ScoreSaver.
- **⏩ Auto-wave toggle** (`autoWave` + `autoRef`): when ON, the loop launches the
  next wave the instant one clears (same logic as Start Wave, inlined in the
  wave-cleared block). The ref is so the rAF loop reads the live value.
- **🔥 Hardcore leaderboard.** Hardcore runs save their score under the game key
  **`defense_hard`** (normal runs use `defense`), via
  `<ScoreSaver game={hardcore ? 'defense_hard' : 'defense'} ...>`. The board is a
  new row in `Leaderboards.jsx`'s `GAMES` list. The `scores` table treats `game`
  as free text, so the BOARD needed no DB change — but coins did: `award_coins`
  pays 0 for any game with no `coin_rates` row, so a rate row for `defense_hard`
  (24.0) had to be added in Supabase. SQL lives in `db/defense-hardcore-rate.sql`
  (a single safe upsert — don't re-run the whole `shop-setup.sql`).
- The tray is **sorted by cost** at render. Tap a tower type then an empty cell
  to build; tap a PLACED tower (nothing selected) to pick it up → **move** it
  free or **sell** for 75% back.
- **Time-locked at 1 hour** of playtime (`TIME_LOCKED.defense = 3600`). The
  Shop progress bar + menu hiding are automatic (see the time-lock note below).

## Owner / admin powers
`owner.js` defines `OWNER = 'smudgemuffin'`; `isOwner(name)` is case-insensitive.
Owner-only UI is hidden for everyone else, but the REAL guard is always a
database rule (so it can't be bypassed).
- **Leaderboards rows:** 🗑️ delete one score, 🚫 ban a player.
- **🔨 Players page (`AdminPlayers.jsx`):** lists every player; owner can set
  anyone's coins (`set_coins`), ban/unban, and remove purchased games (✕ chips).
- **💰 Max Coins button** (menu, owner-only): sets own coins to 1,000,000,000.
- **Banning:** adds to `bans` + wipes their scores; restrictive policies then
  block banned users from posting. Unban = delete their `bans` row.
- **Time-lock bypass:** `canPlay(key, owned, playtime, owner)` takes an `owner`
  flag (passed `isOwner(username)` from `App.jsx`). The owner can always open
  TIME_LOCKED games (Muffin, Defense) without the playtime, so they can test.

## Supabase setup
- **Project ref:** `rpptipltsmafmcetofyd` (`https://rpptipltsmafmcetofyd.supabase.co`)
- **Approved redirect URLs:** `http://localhost:5174`, `https://smudgegames.vercel.app`
- **Tables:**
  - `profiles` — `id`, `username` (unique, locked once set), `coins`,
    `playtime_seconds`, `created_at`
  - `scores` — `id`, `game`, `name`, `score`, `user_id` (FK → auth users), `created_at`;
    UNIQUE `(user_id, game)` = one best row per player per game
  - `bans` — `username` (PK)
  - `game_prices` — `game` (PK), `price` (shop prices)
  - `coin_rates` — `game` (PK), `rate`, `lower_better`, `baseline` (earn formula)
  - `unlocks` — `(user_id, game)` rows = games a player bought
  - `muffin_saves` — `user_id` (PK), `muffins`, `buildings` jsonb, `upgrades` jsonb, `updated_at`
- **Cashier functions** (`security definer`, the only way to change coins):
  - `award_coins(game, score)` — earn (server math, capped)
  - `buy_game(game)` — spend + unlock
  - `set_coins(username, amount)` — OWNER ONLY, set anyone's balance
  - `add_playtime(seconds)` — add playtime (capped 90s/call)
- **DB setup files** (run each ONCE in Supabase → SQL Editor if rebuilding):
  - `db/bans-setup.sql` — bans table + ban policies
  - `db/shop-setup.sql` — coins, game_prices, unlocks, coin_rates, cashier fns,
    owner unlock policies
  - `db/playtime-setup.sql` — playtime column + `add_playtime`
  - `db/muffin-setup.sql` — `muffin_saves` table
  - `db/defense-hardcore-rate.sql` — coin rate for `defense_hard` (24 = 3× normal).
    A single safe upsert; needed so hardcore Defense runs pay Smudge's.
- To change DB schema/policies: Supabase dashboard → SQL Editor → run SQL.

## Gotchas (these bit us — don't repeat)
- ⚠️ **Owner username is stored `SMUDGEMUFFIN` (caps).** Every owner-check in a
  Supabase policy/function must use `lower(...) = 'smudgemuffin'`, never a plain
  `=` (plain `=` fails with "violates row-level security policy").
- ⚠️ **`scores.user_id` and `unlocks.user_id` have FKs to the auth users table**
  — you can't insert a row with a fake/random user id.
- ⚠️ **Login redirect needs the exact port** in Supabase's approved list (5174).
- ⚠️ **Gmail SMTP is rate-limited** (a few emails/hour on the free tier) — that's
  why login is Google now, not email links.
- ⚠️ **Refresh the wallet after admin changes** — set_coins etc. update the DB,
  but call `reloadProfile()` or the on-screen balance looks stale (it's cached).
- ⚠️ **Re-running `db/shop-setup.sql` errors partway and skips new policies.**
  `create policy` has no `if not exists`, so re-running the whole file stops at
  the first policy that already exists — any NEW policies near the bottom never
  reach the live DB. This bit the owner "remove a game" feature: the delete
  policy was in the file but never got created in Supabase. Symptom: a
  `.delete()` (or `.update()`) blocked by RLS returns **success with no error**
  but deletes nothing — so the UI says "🗑️ Removed" while the row stays put.
  Fix used: run just the one policy, prefixed with
  `drop policy if exists "<name>" on <table>;` so it's safe to re-run. (Fixed
  the owner remove-game button on 2026-06-24 this way.)

## Conventions / patterns
- **Reuse components** (GameCard, ScoreSaver, Leaderboard) — "build once, use many."
- **Theme = master variables** in `src/index.css` `:root` (cyan `#22d3ee`, purple
  `#a855f7`, dark bg). Change there to re-skin the whole site.
- Games support mouse + touch + keyboard where it makes sense. Keyboard listeners
  check `e.target.tagName` so they don't hijack typing in inputs.
- Score sources: a game shows its scores in TWO places — the auto Top-10 on the
  game-over screen (`ScoreSaver`) and the 🏆 Leaderboards tab (`Leaderboards.jsx`).
- Leaderboards tab also has a **🪙 Top Coins** board (`CoinsLeaderboard.jsx`,
  reads `profiles` by coins).
- **`ErrorBoundary.jsx`** wraps the whole app (in `main.jsx`). If any game
  crashes, it shows a readable "💥 Oops" message + a recover button instead of a
  blank white screen. Handy for debugging — the real error also logs to console.
- **Canvas games** (Survivors, Defense) use a `requestAnimationFrame` loop +
  refs for game state, and only `setHud(...)` per frame for the on-screen
  numbers (the loop effect's only dep is `phase`, so it doesn't restart).

## Known quirks (intentional)
- Reaction Time accepts impossibly-fast times; Keaton (owner) keeps a **3 ms**
  entry — leave it unless he says otherwise.
- Owner sits on 1,000,000,000 coins (Max Coins button), so he tops the coins
  leaderboard. Fine for now.
- Vercel does NOT auto-deploy from GitHub; deploys are manual via `vercel --prod`.

## Open bugs (WIP)
- ✅ **FIXED 2026-06-25 — Smudge Defense white-screen flash on tower click.**
  Root cause: it was a main-thread FREEZE (dev-only — never on prod, because dev
  React is unminified + `StrictMode` doubles the work). The loop called
  `setHud(...)` EVERY frame (~60×/sec), which re-rendered the whole component and
  rebuilt all 27 tower buttons each time; a click piled on enough extra work to
  stall for ~2s. The game always *continued* through the flash (the tell that it
  was a freeze, not a crash/reload).
  Fix: (1) `setHud` now only fires when a HUD value actually changes (tracked via
  `hudRef`), cutting re-renders from 60/sec to a handful/sec; (2) each frame is
  wrapped in a `safeFrame` try/catch that logs the real error and keeps the loop
  alive, so a future bad frame can't silently freeze the canvas.
  (No open bugs right now.)

## Ideas / next steps
- Goal is ~30 minigames (at 13). Keaton prefers ORIGINAL games over clones.
- Muffin Clicker stage 3+ ideas: more buildings, golden-muffin bonuses, prestige.
- Calibrate coin rates for Snake/Gravity/Split/Smudge once people actually play
  them (some `coin_rates` were tuned by guessing the typical score).
- Tic-Tac-Toe still has no leaderboard (could add a win counter).

## About Keaton (how to work with him)
- 12, learning by DIRECTING Claude (not hand-coding). Explain before doing, give
  2 options with tradeoffs on real choices, check his understanding. Gen-Z tone.
- Do NOT call him "director"/"boss" (he asked us to stop).
- "cpd" = commit, push, deploy (and verify it's live).
