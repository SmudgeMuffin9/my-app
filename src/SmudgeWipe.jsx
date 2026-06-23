import { useState, useRef, useEffect } from 'react'
import ScoreSaver from './ScoreSaver'

// --- tuning knobs (tweak these to change the feel) ---
const MAX_R = 58         // radius (px) a smudge can hit before you LOSE
const GROW_START = 11    // how fast smudges grow at the start (px/sec)
const GROW_RAMP = 1.25   // extra growth speed added each second
const SPAWN_START = 1.15 // seconds between new smudges at the start
const SPAWN_MIN = 0.35   // fastest the spawns ever get (seconds apart)
const START_R = 7        // size a smudge is born at (px radius)

// a fresh game world: a list of smudges, each growing
function freshWorld() {
  return {
    smudges: [],       // each: { id, x, y, r }  (x/y in %, r in px)
    nextId: 1,
    nextSpawn: 0.5,    // seconds until the next smudge appears
    elapsed: 0,
    wiped: 0,
    dead: false,
  }
}

function SmudgeWipe({ onBack }) {
  const [phase, setPhase] = useState('ready') // ready, running, done
  const [score, setScore] = useState(0)
  const [, setTick] = useState(0) // bumped every frame just to force a redraw
  const world = useRef(freshWorld())
  const lastRef = useRef(0)

  // wipe one smudge away (tap/click). Only counts while playing.
  function wipe(id) {
    if (phase !== 'running') return
    const w = world.current
    w.smudges = w.smudges.filter((s) => s.id !== id)
    w.wiped += 1
    setScore(w.wiped)
  }

  // the main game loop: runs ~60x a second while playing
  useEffect(() => {
    if (phase !== 'running') return
    let raf
    lastRef.current = performance.now()

    function frame(now) {
      const w = world.current
      const dt = Math.min((now - lastRef.current) / 1000, 0.05) // seconds since last frame
      lastRef.current = now

      w.elapsed += dt
      const grow = GROW_START + w.elapsed * GROW_RAMP

      // grow every smudge; if any reaches MAX_R you lose
      for (const s of w.smudges) {
        s.r += grow * dt
        if (s.r >= MAX_R) w.dead = true
      }

      // spawn a new smudge at a random spot (kept away from the edges)
      w.nextSpawn -= dt
      if (w.nextSpawn <= 0) {
        w.smudges.push({
          id: w.nextId++,
          x: 12 + Math.random() * 76,
          y: 12 + Math.random() * 76,
          r: START_R,
        })
        // spawns get quicker as time goes on
        w.nextSpawn = Math.max(SPAWN_MIN, SPAWN_START - w.elapsed * 0.03)
      }

      if (w.dead) {
        setScore(w.wiped)
        setPhase('done')
        return
      }

      setTick((t) => t + 1)
      raf = requestAnimationFrame(frame)
    }

    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [phase])

  function start() {
    world.current = freshWorld()
    setScore(0)
    setPhase('running')
  }

  function reset() {
    world.current = freshWorld()
    setScore(0)
    setPhase('ready')
  }

  const w = world.current

  return (
    <section id="center">
      <button className="back-btn" onClick={onBack}>← Menu</button>
      <h1>🧽 Smudge Wipe</h1>

      {phase === 'ready' && (
        <>
          <p>Smudges keep popping up and GROWING. Tap them to wipe them!</p>
          <p className="split-keys">
            If any smudge gets too big, it's game over. How many can you wipe? 🧽
          </p>
          <button className="play-btn" onClick={start}>START</button>
        </>
      )}

      {phase === 'running' && (
        <>
          <p className="split-stat">🧽 {w.wiped} wiped</p>
          <div className="smudge-wrap">
            <div className="smudge-field">
              {w.smudges.map((s) => (
                <div
                  key={s.id}
                  className={`smudge ${s.r > MAX_R * 0.62 ? 'danger' : ''}`}
                  style={{
                    left: `${s.x}%`,
                    top: `${s.y}%`,
                    width: `${s.r * 2}px`,
                    height: `${s.r * 2}px`,
                  }}
                  onPointerDown={(e) => {
                    e.stopPropagation()
                    wipe(s.id)
                  }}
                />
              ))}
            </div>
          </div>
        </>
      )}

      {phase === 'done' && (
        <>
          <h2 className="split-result">You wiped {score} smudges!</h2>
          <p className="split-stat">{score} points 🧽</p>
          <ScoreSaver game="smudge" score={score} />
          <button className="play-btn" onClick={reset}>Try again</button>
        </>
      )}
    </section>
  )
}

export default SmudgeWipe
