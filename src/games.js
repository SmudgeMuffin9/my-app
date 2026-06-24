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
  { key: 'survivor', name: 'Smudge Survivors', emoji: '🧟' },
  { key: 'defense', name: 'Smudge Defense', emoji: '🏰' },
]

// The games you must BUY in the shop. Everything else is free.
// (Prices live in the database `game_prices` table, not here.)
export const LOCKED = new Set(['shoot', 'snake', 'gravity', 'smudge', 'split'])

// Games unlocked by TIME PLAYED instead of coins. Value = seconds required.
export const TIME_LOCKED = {
  muffin: 1800,   // 30 minutes
  defense: 3600,  // 1 hour — earn the big tower-defense game by grinding
}

export const isLocked = (key) => LOCKED.has(key) || key in TIME_LOCKED

// Every game the owner can grant from the Players page (coin-locked + time-locked).
export const GRANTABLE = (key) => LOCKED.has(key) || key in TIME_LOCKED

// Can the player open this game?
// - owned (bought OR owner-gifted): always — this also unlocks time-locked games
// - time-locked games: after enough playtime (owner can always open them)
// - coin-locked games: only if owned (handled above); everything else: free
export const canPlay = (key, owned, playtime = 0, owner = false) => {
  if (owned.includes(key)) return true
  if (TIME_LOCKED[key] != null) return owner || playtime >= TIME_LOCKED[key]
  return !LOCKED.has(key)
}
