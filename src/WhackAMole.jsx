import { useState, useRef, useEffect } from 'react'
import ScoreSaver from './ScoreSaver'

const DURATION = 30 // seconds per round
const HOLES = 9 // 3x3 grid
const MOLE_SPEED = 800 // ms a mole stays up before ducking to a new hole

// pick a random hole that ISN'T the one we're already on (so the mole moves)
function randomHole(not) {
  let h = Math.floor(Math.random() * HOLES)
  while (h === not) h = Math.floor(Math.random() * HOLES)
  return h
}

function WhackAMole({ onBack }) {
  const [phase, setPhase] = useState('ready') // ready, running, done
  const [score, setScore] = useState(0)
  const [timeLeft, setTimeLeft] = useState(DURATION)
  const [mole, setMole] = useState(-1) // which hole has the mole (-1 = none)
  const startRef = useRef(0)

  // countdown that ends the round (same trick as Click Speed)
  useEffect(() => {
    if (phase !== 'running') return
    let raf
    function tick(now) {
      const remaining = DURATION - (now - startRef.current) / 1000
      if (remaining <= 0) {
        setTimeLeft(0)
        setMole(-1)
        setPhase('done')
        return
      }
      setTimeLeft(remaining)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [phase])

  // Every time the mole shows up in a hole, start a fresh timer to move it.
  // Because this depends on `mole`, ANY move (timeout OR a whack) resets the
  // clock — so a whack can't get "double-teleported" by a leftover timer.
  useEffect(() => {
    if (phase !== 'running') return
    const id = setTimeout(() => {
      setMole((prev) => randomHole(prev))
    }, MOLE_SPEED)
    return () => clearTimeout(id)
  }, [phase, mole])

  function start() {
    startRef.current = performance.now()
    setScore(0)
    setTimeLeft(DURATION)
    setMole(randomHole(-1))
    setPhase('running')
  }

  function whack(i) {
    if (phase !== 'running') return
    if (i !== mole) return // only the hole with the mole counts
    setScore((s) => s + 1)
    setMole((prev) => randomHole(prev)) // instantly send it somewhere new
  }

  function reset() {
    setPhase('ready')
    setScore(0)
    setTimeLeft(DURATION)
    setMole(-1)
  }

  return (
    <section id="center">
      <button className="back-btn" onClick={onBack}>← Menu</button>

      <h1>🔨 Whack-a-Mole</h1>

      {phase === 'ready' && (
        <>
          <p>Smash as many moles as you can in {DURATION} seconds! 🐹</p>
          <button className="play-btn" onClick={start}>START</button>
        </>
      )}

      {phase === 'running' && (
        <>
          <p className="whack-stat">⏱ {timeLeft.toFixed(1)}s &nbsp;•&nbsp; 🔨 {score}</p>
          <div className="whack-grid">
            {Array.from({ length: HOLES }).map((_, i) => (
              <button
                key={i}
                className={`whack-hole ${i === mole ? 'up' : ''}`}
                onClick={() => whack(i)}
              >
                {i === mole ? '🐹' : ''}
              </button>
            ))}
          </div>
        </>
      )}

      {phase === 'done' && (
        <>
          <h2 className="whack-result">{score} moles whacked! 🔨</h2>
          <ScoreSaver game="whack" score={score} />
          <button className="play-btn" onClick={reset}>Play again</button>
        </>
      )}
    </section>
  )
}

export default WhackAMole
