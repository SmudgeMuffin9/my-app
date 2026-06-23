import { useState } from 'react'
import GameCard from './GameCard'
import ReactionTime from './ReactionTime'
import ShootTarget from './ShootTarget'
import GuessNumber from './GuessNumber'
import ClickSpeed from './ClickSpeed'
import TicTacToe from './TicTacToe'
import SnakeGame from './SnakeGame'
import WhackAMole from './WhackAMole'
import SplitBrain from './SplitBrain'
import GravityFlip from './GravityFlip'
import SmudgeWipe from './SmudgeWipe'
import AuthBar from './AuthBar'
import Leaderboards from './Leaderboards'
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

  if (activeGame === 'cps') {
    return <ClickSpeed onBack={() => setActiveGame(null)} />
  }

  if (activeGame === 'ttt') {
    return <TicTacToe onBack={() => setActiveGame(null)} />
  }

  if (activeGame === 'snake') {
    return <SnakeGame onBack={() => setActiveGame(null)} />
  }

  if (activeGame === 'whack') {
    return <WhackAMole onBack={() => setActiveGame(null)} />
  }

  if (activeGame === 'split') {
    return <SplitBrain onBack={() => setActiveGame(null)} />
  }

  if (activeGame === 'gravity') {
    return <GravityFlip onBack={() => setActiveGame(null)} />
  }

  if (activeGame === 'smudge') {
    return <SmudgeWipe onBack={() => setActiveGame(null)} />
  }

  if (activeGame === 'leaderboards') {
    return <Leaderboards onBack={() => setActiveGame(null)} />
  }

  return (
    <section id="center">
      <AuthBar />
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
        <GameCard
          emoji="🖱️"
          name="Click Speed"
          onClick={() => setActiveGame('cps')}
        />
        <GameCard
          emoji="⭕"
          name="Tic-Tac-Toe"
          onClick={() => setActiveGame('ttt')}
        />
        <GameCard
          emoji="🐍"
          name="Snake"
          onClick={() => setActiveGame('snake')}
        />
        <GameCard
          emoji="🔨"
          name="Whack-a-Mole"
          onClick={() => setActiveGame('whack')}
        />
        <GameCard
          emoji="🧠"
          name="Split Brain"
          onClick={() => setActiveGame('split')}
        />
        <GameCard
          emoji="🌀"
          name="Gravity Flip"
          onClick={() => setActiveGame('gravity')}
        />
        <GameCard
          emoji="🧽"
          name="Smudge Wipe"
          onClick={() => setActiveGame('smudge')}
        />
      </div>

      <button className="play-btn" onClick={() => setActiveGame('leaderboards')}>
        🏆 Leaderboards
      </button>
    </section>
  )
}

export default App
