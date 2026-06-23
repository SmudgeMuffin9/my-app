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
]

// The games you must BUY in the shop. Everything else is free.
// (Prices live in the database `game_prices` table, not here.)
export const LOCKED = new Set(['shoot', 'snake', 'gravity', 'smudge', 'split'])

export const isLocked = (key) => LOCKED.has(key)

// Can the player open this game? Free games: always. Locked games: only if owned.
export const canPlay = (key, owned) => !isLocked(key) || owned.includes(key)
