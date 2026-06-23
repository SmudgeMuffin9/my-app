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
import Shop from './Shop'
import AdminPlayers from './AdminPlayers'
import { useAuth } from './auth'
import { isOwner } from './owner'
import { GAMES, canPlay } from './games'
import './App.css'

function App() {
  // Which game is open right now? null = show the menu.
  const [activeGame, setActiveGame] = useState(null)
  const { username, owned } = useAuth() // username + unlocked games

  // Menu order: games you BOUGHT first (newest purchase first), then free games.
  const boughtFirst = owned
    .map((key) => GAMES.find((g) => g.key === key))
    .filter(Boolean)
  const freeGames = GAMES.filter(
    (g) => canPlay(g.key, owned) && !owned.includes(g.key)
  )
  const orderedGames = [...boughtFirst, ...freeGames]

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

  if (activeGame === 'shop') {
    return <Shop onBack={() => setActiveGame(null)} />
  }

  if (activeGame === 'admin') {
    return <AdminPlayers onBack={() => setActiveGame(null)} />
  }

  return (
    <section id="center">
      <AuthBar />
      <h1 className="brand">
        <span className="brand-smudge">smudge</span><span className="brand-games">GAMES</span>
      </h1>
      <p>Pick a minigame to play</p>

      <div className="game-menu">
        {orderedGames.map((g) => (
          <GameCard
            key={g.key}
            emoji={g.emoji}
            name={g.name}
            onClick={() => setActiveGame(g.key)}
          />
        ))}
      </div>

      <div className="menu-actions">
        <button className="play-btn" onClick={() => setActiveGame('shop')}>
          🛒 Shop
        </button>
        <button className="play-btn" onClick={() => setActiveGame('leaderboards')}>
          🏆 Leaderboards
        </button>
        {isOwner(username) && (
          <button className="play-btn" onClick={() => setActiveGame('admin')}>
            🔨 Players
          </button>
        )}
      </div>
    </section>
  )
}

export default App
