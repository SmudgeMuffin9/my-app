// One reusable "game button" for the start menu.
// We build it ONCE, then reuse it for every minigame with different props.
// `locked` = the player hasn't bought this game yet (shows a 🔒 + dims it).
function GameCard({ emoji, name, onClick, locked = false }) {
  return (
    <button
      type="button"
      className={`game-card ${locked ? 'locked' : ''}`}
      onClick={onClick}
    >
      {locked && <span className="game-lock">🔒</span>}
      <span className="game-emoji">{emoji}</span>
      <span className="game-name">{name}</span>
    </button>
  )
}

export default GameCard
