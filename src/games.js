// One shared list of every game (key + how it shows in menus).
// Used by the menu (App.jsx) and the Shop so they never disagree.
export const GAMES = [
  { key: 'reaction', name: 'Reaction Time', emoji: '⚡' },
  { key: 'shoot', name: 'Shoot the Target', emoji: '🎯' },
  { key: 'guess', name: 'Guess the Number', emoji: '🤖' },
  { key: 'cps', name: 'Click Speed', emoji: '🖱️' },
  { key: 'ttt', name: 'Tic-Tac-Toe', emoji: '⭕' },
  { key: 'snake', name: 'Snake', emoji: '🐍' },
  { key: 'whack', name: 'Whack-a-Mole', emoji: '🔨' },
  { key: 'split', name: 'Split Brain', emoji: '🧠' },
  { key: 'gravity', name: 'Gravity Flip', emoji: '🌀' },
  { key: 'smudge', name: 'Smudge Wipe', emoji: '🧽' },
  { key: 'muffin', name: 'Muffin Clicker', emoji: '🧁' },
]

// The games you must BUY in the shop. Everything else is free.
// (Prices live in the database `game_prices` table, not here.)
export const LOCKED = new Set(['shoot', 'snake', 'gravity', 'smudge', 'split'])

// Games unlocked by TIME PLAYED instead of coins. Value = seconds required.
export const TIME_LOCKED = { muffin: 1800 } // 1800s = 30 minutes

export const isLocked = (key) => LOCKED.has(key) || key in TIME_LOCKED

// Can the player open this game?
// - time-locked games: only after enough playtime
// - coin-locked games: only if owned
// - everything else: free, always
export const canPlay = (key, owned, playtime = 0) => {
  if (TIME_LOCKED[key] != null) return playtime >= TIME_LOCKED[key]
  return !LOCKED.has(key) || owned.includes(key)
}
