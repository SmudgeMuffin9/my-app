import { useState, useRef, useEffect } from 'react'
import ScoreSaver from './ScoreSaver'

// --- tuning knobs (tweak these to change the feel) ---
const LANE_H = 360       // height of the play area (px)
const BALL = 28          // ball size (px)
const MAXY = LANE_H - BALL // highest the ball's bottom can go (stuck to ceiling)
const GRAVITY = 2600     // how hard gravity pulls (px/sec^2)
const START_SPEED = 38   // blocks' starting speed (% of lane width per sec)
const SPEED_RAMP = 1.3   // how much faster it gets each second
const BALL_X = 20        // ball's fixed spot from the left (% of lane)
const HIT_X = 7          // how close (in %) a block must be to count as a hit
const BLOCK_H = 120      // how tall each block is (px)

// a fresh game world: one ball + a list of blocks sliding left
function freshWorld() {
  return {
    y: 0,                // ball's bottom position (0 = floor, MAXY = ceiling)
    vy: 0,               // vertical speed
    grav: 1,             // 1 = pulling DOWN, -1 = pulling UP
    blocks: [],          // each: { x, side: 'floor' | 'ceiling' }
    nextSpawn: 0.9,      // seconds until the next block spawns
    elapsed: 0,
    speed: START_SPEED,
    dead: false,
  }
}

function GravityFlip({ onBack }) {
  const [phase, setPhase] = useState('ready') // ready, running, done
  const [score, setScore] = useState(0)
  const [, setTick] = useState(0) // bumped every frame just to force a redraw
  const world = useRef(freshWorld())
  const lastRef = useRef(0)

  // flip which way gravity pulls — only when the ball is stuck to the floor or
  // ceiling (no flipping mid-air, so spamming can't make you hover)
  function flip() {
    if (phase !== 'running') return
    const w = world.current
    if (w.y === 0 || w.y === MAXY) w.grav *= -1
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

      // gravity: accelerate the ball, then clamp it to floor/ceiling
      w.vy += -w.grav * GRAVITY * dt
      w.y += w.vy * dt
      if (w.y <= 0) { w.y = 0; w.vy = 0 }
      if (w.y >= MAXY) { w.y = MAXY; w.vy = 0 }

      // spawn blocks on a random side, slide them left, drop off-screen ones
      w.nextSpawn -= dt
      if (w.nextSpawn <= 0) {
        const side = Math.random() < 0.5 ? 'floor' : 'ceiling'
        w.blocks.push({ x: 106, side })
        // next block comes in a random gap (smaller as we speed up)
        const gap = Math.max(0.7, 1.5 - w.elapsed * 0.02)
        w.nextSpawn = gap + Math.random() * 0.5
      }
      for (const b of w.blocks) b.x -= w.speed * dt
      w.blocks = w.blocks.filter((b) => b.x > -8)

      // crash if a block overlaps the ball AND the ball is on that block's side
      for (const b of w.blocks) {
        if (Math.abs(b.x - BALL_X) >= HIT_X) continue
        if (b.side === 'floor' && w.y < BLOCK_H) w.dead = true
        if (b.side === 'ceiling' && w.y > MAXY - BLOCK_H) w.dead = true
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

  // keyboard: spacebar or up-arrow flips gravity (ignore held-down + typing)
  useEffect(() => {
    function onKey(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      if (e.repeat) return
      if (e.code === 'Space' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        e.preventDefault()
        flip()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      <h1>🌀 Gravity Flip</h1>

      {phase === 'ready' && (
        <>
          <p>Flip gravity to dodge the blocks. Survive as long as you can!</p>
          <p className="split-keys">
            Tap the screen or press <b>Space</b> / <b>↑</b> to flip ⬆️⬇️
          </p>
          <button className="play-btn" onClick={start}>START</button>
        </>
      )}

      {phase === 'running' && (
        <>
          <p className="split-stat">⏱ {w.elapsed.toFixed(1)}s</p>
          <div className="gravity-wrap">
            <div className="gravity-lane" onPointerDown={flip}>
              <div
                className="gravity-ball"
                style={{ left: `${BALL_X}%`, bottom: `${w.y}px` }}
              />
              {w.blocks.map((b, i) => (
                <div
                  key={i}
                  className={`gravity-ob ${b.side}`}
                  style={{ left: `${b.x}%`, height: `${BLOCK_H}px` }}
                />
              ))}
            </div>
          </div>
        </>
      )}

      {phase === 'done' && (
        <>
          <h2 className="split-result">You lasted {(score / 10).toFixed(1)}s</h2>
          <p className="split-stat">{score} points 🌀</p>
          <ScoreSaver game="gravity" score={score} />
          <button className="play-btn" onClick={reset}>Try again</button>
        </>
      )}
    </section>
  )
}

export default GravityFlip
