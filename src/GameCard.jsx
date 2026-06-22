// One reusable "game button" for the start menu.
// We build it ONCE, then reuse it for every minigame with different props.
function GameCard({ emoji, name, onClick }) {
  return (
    <button
      type="button"
      className="game-card"
      onClick={onClick}
    >
      <span className="game-emoji">{emoji}</span>
      <span className="game-name">{name}</span>
    </button>
  )
}

export default GameCard
