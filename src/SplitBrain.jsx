import { useState, useRef, useEffect } from 'react'
import ScoreSaver from './ScoreSaver'

// --- tuning knobs (tweak these to change the feel) ---
const RUNNER_X = 12      // how far from the left each runner stands (% of lane)
const JUMP_V = 540       // how hard you launch upward (px/sec)
const GRAVITY = 1900     // how fast you fall back down (px/sec^2)
const CLEAR_H = 42       // how high you must be to clear a block (px)
const START_SPEED = 46   // blocks' starting speed (% of lane per sec)
const SPEED_RAMP = 1.6   // how much faster it gets each second
const HIT_DIST = 4       // how close (in %) a block must be to count as a hit
                         // (smaller = more forgiving; tuned to be a touch
                         //  smaller than the block looks, which feels fairer)

// a fresh game world: 2 runners (0 = top, 1 = bottom), each with its own blocks
function freshWorld() {
  return {
    runners: [{ y: 0, vy: 0 }, { y: 0, vy: 0 }],
    blocks: [[], []],        // each lane: list of { x } sliding left
    nextSpawn: [0.6, 1.1],   // seconds until each lane spawns its next block
    elapsed: 0,
    speed: START_SPEED,
    dead: false,
  }
}

function SplitBrain({ onBack }) {
  const [phase, setPhase] = useState('ready') // ready, running, done
  const [score, setScore] = useState(0)
  const [, setTick] = useState(0) // bumped every frame just to force a redraw
  const world = useRef(freshWorld())
  const lastRef = useRef(0)

  // make a runner jump — only if it's currently on the ground
  function jump(i) {
    const r = world.current.runners[i]
    if (r.y <= 0) r.vy = JUMP_V
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
      w.speed = START_SPEED + w.elapsed * SPEED_RAMP

      // move + land each runner (simple gravity)
      for (const r of w.runners) {
        if (r.vy !== 0 || r.y > 0) {
          r.vy -= GRAVITY * dt
          r.y += r.vy * dt
          if (r.y <= 0) { r.y = 0; r.vy = 0 }
        }
      }

      // each lane: spawn blocks, slide them left, check for a crash
      for (let lane = 0; lane < 2; lane++) {
        w.nextSpawn[lane] -= dt
        if (w.nextSpawn[lane] <= 0) {
          w.blocks[lane].push({ x: 104 })
          // next block comes in a random gap (smaller as we speed up)
          const gap = Math.max(0.55, 1.4 - w.elapsed * 0.02)
          w.nextSpawn[lane] = gap + Math.random() * 0.6
        }
        for (const b of w.blocks[lane]) b.x -= w.speed * dt
        w.blocks[lane] = w.blocks[lane].filter((b) => b.x > -6)

        // crash if a block overlaps the runner AND the runner isn't high enough
        const r = w.runners[lane]
        for (const b of w.blocks[lane]) {
          const overlap = Math.abs(b.x - RUNNER_X) < HIT_DIST
          if (overlap && r.y < CLEAR_H) w.dead = true
        }
      }

      if (w.dead) {
        setScore(Math.floor(w.elapsed * 10))
        setPhase('done')
        return
      }

      setTick((t) => t + 1)
      raf = requestAnimationFrame(frame)
    }

    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [phase])

  // keyboard: F = top runner, J = bottom runner (ignore held-down repeats)
  useEffect(() => {
    function onKey(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      if (e.repeat) return
      if (e.key === 'f' || e.key === 'F') jump(0)
      if (e.key === 'j' || e.key === 'J') jump(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

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
      <h1>🧠 Split Brain</h1>

      {phase === 'ready' && (
        <>
          <p>Control BOTH runners at once. Jump over the blocks!</p>
          <p className="split-keys">
            ⬆️ Top = <b>F</b> key (or tap top) &nbsp;•&nbsp; ⬇️ Bottom = <b>J</b> key (or tap bottom)
          </p>
          <button className="play-btn" onClick={start}>START</button>
        </>
      )}

      {phase === 'running' && (
        <>
          <p className="split-stat">⏱ {w.elapsed.toFixed(1)}s</p>
          <div className="split-wrap">
            {[0, 1].map((lane) => (
              <div
                key={lane}
                className="split-lane"
                onPointerDown={() => jump(lane)}
              >
                <div
                  className="split-runner"
                  style={{
                    left: `${RUNNER_X}%`,
                    transform: `translate(-50%, ${-w.runners[lane].y}px)`,
                  }}
                >
                  {lane === 0 ? '🟦' : '🟪'}
                </div>
                {w.blocks[lane].map((b, i) => (
                  <div key={i} className="split-ob" style={{ left: `${b.x}%` }} />
                ))}
              </div>
            ))}
          </div>
        </>
      )}

      {phase === 'done' && (
        <>
          <h2 className="split-result">You lasted {(score / 10).toFixed(1)}s</h2>
          <p className="split-stat">{score} points 🧠</p>
          <ScoreSaver game="split" score={score} />
          <button className="play-btn" onClick={reset}>Try again</button>
        </>
      )}
    </section>
  )
}

export default SplitBrain
