import Leaderboard from './Leaderboard'

// every game that has a score, with the right sort direction
const GAMES = [
  { game: 'snake', title: '🐍 Snake' },
  { game: 'whack', title: '🔨 Whack-a-Mole' },
  { game: 'split', title: '🧠 Split Brain', unit: ' pts' },
  { game: 'gravity', title: '🌀 Gravity Flip', unit: ' pts' },
  { game: 'smudge', title: '🧽 Smudge Wipe', unit: ' wiped' },
  { game: 'shoot', title: '🎯 Shoot the Target' },
  { game: 'cps', title: '🖱️ Click Speed' },
  { game: 'reaction', title: '⚡ Reaction Time', lowerIsBetter: true, unit: ' ms' },
  { game: 'guess', title: '🤖 Guess the Number', lowerIsBetter: true },
]

function Leaderboards({ onBack }) {
  return (
    <section id="center">
      <button className="back-btn" onClick={onBack}>← Menu</button>
      <h1>🏆 Leaderboards</h1>
      <div className="lb-grid">
        {GAMES.map((g) => (
          <Leaderboard key={g.game} {...g} />
        ))}
      </div>
    </section>
  )
}

export default Leaderboards
