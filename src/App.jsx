import GameCard from './GameCard'
import './App.css'

function App() {
  return (
    <section id="center">
      <h1>Keaton's Arcade</h1>
      <p>Pick a minigame to play 👇</p>

      <div className="game-menu">
        <GameCard emoji="⚡" name="Reaction Time" />
        <GameCard emoji="🎯" name="Shoot the Target" />
      </div>
    </section>
  )
}

export default App
