import { useState, useRef, useEffect } from 'react'
import ScoreSaver from './ScoreSaver'

const GRID = 15 // 15 x 15 board
const START_SNAKE = [{ x: 7, y: 7 }, { x: 6, y: 7 }, { x: 5, y: 7 }]

const rand = (n) => Math.floor(Math.random() * n)

function newFood(snakeArr) {
  const taken = new Set(snakeArr.map((c) => `${c.x},${c.y}`))
  let f
  do {
    f = { x: rand(GRID), y: rand(GRID) }
  } while (taken.has(`${f.x},${f.y}`))
  return f
}

function SnakeGame({ onBack }) {
  const [phase, setPhase] = useState('ready') // ready, playing, over
  const [snake, setSnake] = useState(START_SNAKE)
  const [food, setFood] = useState({ x: 11, y: 7 })
  const [score, setScore] = useState(0)
  const [won, setWon] = useState(false)

  const snakeRef = useRef(START_SNAKE)
  const dirRef = useRef({ x: 1, y: 0 })      // current direction
  const pendingDirRef = useRef({ x: 1, y: 0 }) // queued next direction
  const foodRef = useRef(food)
  const loopRef = useRef(null)
  const touchStart = useRef(null)

  // change direction, but never straight back into yourself
  function setDir(nd) {
    const cur = dirRef.current
    if (nd.x === -cur.x && nd.y === -cur.y) return
    pendingDirRef.current = nd
  }

  function start() {
    snakeRef.current = START_SNAKE
    dirRef.current = { x: 1, y: 0 }
    pendingDirRef.current = { x: 1, y: 0 }
    const f = newFood(START_SNAKE)
    foodRef.current = f
    setSnake(START_SNAKE)
    setFood(f)
    setScore(0)
    setWon(false)
    setPhase('playing')
  }

  function endGame(didWin) {
    clearTimeout(loopRef.current)
    setWon(didWin)
    setPhase('over')
  }

  // one step of the snake
  function step() {
    const dir = pendingDirRef.current
    dirRef.current = dir
    const head = snakeRef.current[0]
    const nx = head.x + dir.x
    const ny = head.y + dir.y

    // hit a wall?
    if (nx < 0 || nx >= GRID || ny < 0 || ny >= GRID) return endGame(false)

    const eating = nx === foodRef.current.x && ny === foodRef.current.y
    const body = snakeRef.current
    // if not eating, the tail moves out of the way, so don't count it
    const checkCells = eating ? body : body.slice(0, body.length - 1)
    if (checkCells.some((c) => c.x === nx && c.y === ny)) return endGame(false)

    const newSnake = [{ x: nx, y: ny }, ...body]
    if (eating) {
      setScore((s) => s + 1)
      if (newSnake.length === GRID * GRID) {
        snakeRef.current = newSnake
        setSnake(newSnake)
        return endGame(true) // filled the whole board!
      }
      foodRef.current = newFood(newSnake)
      setFood(foodRef.current)
    } else {
      newSnake.pop()
    }
    snakeRef.current = newSnake
    setSnake(newSnake)
  }

  // the game loop — gets faster as the snake grows
  useEffect(() => {
    if (phase !== 'playing') return
    let active = true
    function loop() {
      if (!active) return
      step()
      const speed = Math.max(70, 150 - (snakeRef.current.length - 3) * 4)
      loopRef.current = setTimeout(loop, speed)
    }
    loopRef.current = setTimeout(loop, 150)
    return () => {
      active = false
      clearTimeout(loopRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  // keyboard controls
  useEffect(() => {
    function onKey(e) {
      // don't hijack keys while the player is typing (e.g. their name)
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      const k = e.key.toLowerCase()
      const map = {
        arrowup: { x: 0, y: -1 }, w: { x: 0, y: -1 },
        arrowdown: { x: 0, y: 1 }, s: { x: 0, y: 1 },
        arrowleft: { x: -1, y: 0 }, a: { x: -1, y: 0 },
        arrowright: { x: 1, y: 0 }, d: { x: 1, y: 0 },
      }
      const nd = map[k]
      if (!nd) return
      e.preventDefault()
      setDir(nd)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // swipe controls (phone)
  function onTouchStart(e) {
    const t = e.touches[0]
    touchStart.current = { x: t.clientX, y: t.clientY }
  }
  function onTouchEnd(e) {
    if (!touchStart.current) return
    const t = e.changedTouches[0]
    const dx = t.clientX - touchStart.current.x
    const dy = t.clientY - touchStart.current.y
    if (Math.abs(dx) < 20 && Math.abs(dy) < 20) return
    if (Math.abs(dx) > Math.abs(dy)) setDir({ x: dx > 0 ? 1 : -1, y: 0 })
    else setDir({ x: 0, y: dy > 0 ? 1 : -1 })
    touchStart.current = null
  }

  const cellPct = 100 / GRID
  const speed = Math.max(70, 150 - (snake.length - 3) * 4) // matches the loop timing

  return (
    <section id="center">
      <button className="back-btn" onClick={onBack}>← Menu</button>
      <h1>🐍 Snake</h1>

      {phase === 'ready' ? (
        <>
          <p className="snake-hint">Eat the 🍎, grow long, don't hit the walls or yourself!</p>
          <p className="snake-hint">Arrow keys / WASD on computer · swipe on phone</p>
          <button className="play-btn" onClick={start}>Start</button>
        </>
      ) : (
        <>
          <p className="snake-score">Score: {score}</p>

          <div
            className="snake-board"
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          >
            {snake.map((c, i) => (
              <div
                key={i}
                className={`snake-seg ${i === 0 ? 'head' : ''}`}
                style={{
                  left: `${c.x * cellPct}%`,
                  top: `${c.y * cellPct}%`,
                  width: `${cellPct}%`,
                  height: `${cellPct}%`,
                  transition: `left ${speed}ms linear, top ${speed}ms linear`,
                }}
              />
            ))}
            <div
              className="snake-food"
              style={{
                left: `${food.x * cellPct}%`,
                top: `${food.y * cellPct}%`,
                width: `${cellPct}%`,
                height: `${cellPct}%`,
              }}
            />
          </div>

          {phase === 'over' && (
            <>
              <p className="snake-result">
                {won ? '🏆 YOU WIN!' : '💀 Game over!'} Score: {score}
              </p>
              <ScoreSaver game="snake" score={score} />
              <button className="play-btn" onClick={start}>Play again</button>
            </>
          )}
        </>
      )}
    </section>
  )
}

export default SnakeGame
