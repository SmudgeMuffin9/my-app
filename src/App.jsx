import { useState } from 'react'
import GameCard from './GameCard'
import ReactionTime from './ReactionTime'
import ShootTarget from './ShootTarget'
import GuessNumber from './GuessNumber'
import './App.css'

function App() {
  // Which game is open right now? null = show the menu.
  const [activeGame, setActiveGame] = useState(null)

  if (activeGame === 'reaction') {
    return <ReactionTime onBack={() => setActiveGame(null)} />
  }

  if (activeGame === 'shoot') {
    return <ShootTarget onBack={() => setActiveGame(null)} />
  }

  if (activeGame === 'guess') {
    return <GuessNumber onBack={() => setActiveGame(null)} />
  }

  return (
    <section id="center">
      <h1 className="brand">
        <span className="brand-smudge">smudge</span><span className="brand-games">GAMES</span>
      </h1>
      <p>Pick a minigame to play 👇</p>

      <div className="game-menu">
        <GameCard
          emoji="⚡"
          name="Reaction Time"
          onClick={() => setActiveGame('reaction')}
        />
        <GameCard
          emoji="🎯"
          name="Shoot the Target"
          onClick={() => setActiveGame('shoot')}
        />
        <GameCard
          emoji="🤖"
          name="Guess the Number"
          onClick={() => setActiveGame('guess')}
        />
      </div>
    </section>
  )
}

export default App
