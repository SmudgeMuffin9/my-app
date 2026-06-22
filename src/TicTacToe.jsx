import { useState, useEffect } from 'react'

// the 8 ways to win
const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
  [0, 4, 8], [2, 4, 6],            // diagonals
]

function winner(b) {
  for (const [a, c, d] of LINES) {
    if (b[a] && b[a] === b[c] && b[a] === b[d]) return b[a]
  }
  return null
}

function emptyCells(b) {
  const out = []
  b.forEach((v, i) => { if (!v) out.push(i) })
  return out
}

function randomMove(b) {
  const e = emptyCells(b)
  return e[Math.floor(Math.random() * e.length)]
}

// is there a single move that wins right now for this player?
function winningMove(b, player) {
  for (const i of emptyCells(b)) {
    const next = b.slice()
    next[i] = player
    if (winner(next) === player) return i
  }
  return -1
}

// MINIMAX: try every future move and score it. O (robot) wants +1, X wants -1.
function minimax(b, isRobot) {
  const w = winner(b)
  if (w === 'O') return { score: 1 }
  if (w === 'X') return { score: -1 }
  if (emptyCells(b).length === 0) return { score: 0 } // tie

  let best = null
  for (const i of emptyCells(b)) {
    const next = b.slice()
    next[i] = isRobot ? 'O' : 'X'
    const { score } = minimax(next, !isRobot)
    if (
      best === null ||
      (isRobot && score > best.score) ||
      (!isRobot && score < best.score)
    ) {
      best = { index: i, score }
    }
  }
  return best
}

function robotMove(b, difficulty) {
  if (difficulty === 'easy') return randomMove(b)
  if (difficulty === 'medium') {
    let m = winningMove(b, 'O') // win if you can
    if (m >= 0) return m
    m = winningMove(b, 'X')     // else block the player
    if (m >= 0) return m
    return randomMove(b)        // else random
  }
  return minimax(b, true).index // hard = perfect, unbeatable
}

function TicTacToe({ onBack }) {
  const [board, setBoard] = useState(Array(9).fill(null))
  const [difficulty, setDifficulty] = useState('easy')
  const [result, setResult] = useState(null) // null while still playing
  const [thinking, setThinking] = useState(false)

  function finish(msg) {
    setResult(msg)
    setThinking(false)
  }

  function handleCell(i) {
    if (board[i] || result || thinking) return
    const afterPlayer = board.slice()
    afterPlayer[i] = 'X'
    setBoard(afterPlayer)
    if (winner(afterPlayer)) return finish('You win! 🎉')
    if (emptyCells(afterPlayer).length === 0) return finish("It's a tie! 🤝")
    setThinking(true) // hand it to the robot
  }

  // the robot takes its turn (small pause so it feels like it's thinking)
  useEffect(() => {
    if (!thinking) return
    const id = setTimeout(() => {
      const i = robotMove(board, difficulty)
      const afterRobot = board.slice()
      afterRobot[i] = 'O'
      setBoard(afterRobot)
      if (winner(afterRobot)) finish('Robot wins 🤖')
      else if (emptyCells(afterRobot).length === 0) finish("It's a tie! 🤝")
      else setThinking(false)
    }, 350)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thinking])

  function reset() {
    setBoard(Array(9).fill(null))
    setResult(null)
    setThinking(false)
  }

  function pickDifficulty(d) {
    setDifficulty(d)
    reset()
  }

  const status = result || (thinking ? 'Robot thinking… 🤖' : 'Your turn (X)')

  return (
    <section id="center">
      <button className="back-btn" onClick={onBack}>← Menu</button>
      <h1>⭕ Tic-Tac-Toe</h1>

      <div className="ttt-diff">
        {['easy', 'medium', 'hard'].map((d) => (
          <button
            key={d}
            className={difficulty === d ? 'active' : ''}
            onClick={() => pickDifficulty(d)}
          >
            {d}
          </button>
        ))}
      </div>

      <p className="ttt-status">{status}</p>

      <div className="ttt-board">
        {board.map((v, i) => (
          <button
            key={i}
            className={`ttt-cell ${v === 'X' ? 'x' : v === 'O' ? 'o' : ''}`}
            onClick={() => handleCell(i)}
            disabled={!!v || !!result}
          >
            {v}
          </button>
        ))}
      </div>

      <button className="play-btn" onClick={reset}>New game</button>

      {difficulty === 'hard' && !result && (
        <p className="ttt-hint">😈 Hard robot is unbeatable — best you can do is tie!</p>
      )}
    </section>
  )
}

export default TicTacToe
