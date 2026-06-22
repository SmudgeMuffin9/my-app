import { useState, useRef, useEffect } from 'react'

const TOTAL_SHOTS = 10
const TARGET_RADIUS = 42   // smaller target = more precision needed
const SHOT_TIME = 3500     // ms you get per shot before it's a miss

const clamp = (v, a, b) => Math.max(a, Math.min(b, v))

// a moving target: position (%) + a velocity (% per frame)
function randomTarget() {
  const angle = Math.random() * Math.PI * 2
  const speed = 0.12 + Math.random() * 0.16
  return {
    x: 25 + Math.random() * 50,
    y: 30 + Math.random() * 40,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
  }
}

function randomWind() {
  return { angle: Math.random() * Math.PI * 2, strength: 35 + Math.random() * 85 }
}

// points by how close the shot landed to the center (matches the target rings)
function scoreForDistance(d) {
  if (d <= 12) return 100 // bullseye
  if (d <= 23) return 75
  if (d <= 34) return 50
  if (d <= 42) return 25
  return 0 // missed the target
}

const BUILDINGS = [
  { w: 64, h: 55 }, { w: 48, h: 78 }, { w: 80, h: 42 }, { w: 56, h: 66 },
  { w: 44, h: 90 }, { w: 72, h: 50 }, { w: 52, h: 72 }, { w: 68, h: 38 },
  { w: 50, h: 84 }, { w: 76, h: 46 }, { w: 46, h: 70 }, { w: 62, h: 58 },
  { w: 54, h: 80 }, { w: 70, h: 44 },
]

function ShootTarget({ onBack }) {
  const areaRef = useRef(null)
  const timer = useRef(null)
  const panRef = useRef({ x: 0, y: 0 })   // where the player has aimed
  const swayRef = useRef({ x: 0, y: 0 })   // the auto-drift "breathing"
  const targetRef = useRef(randomTarget()) // live target pos + velocity
  const phaseRef = useRef('start')

  const [phase, setPhase] = useState('start') // start, playing, result, over
  const [shots, setShots] = useState(0)
  const [score, setScore] = useState(0)
  const [targetPos, setTargetPos] = useState({ x: targetRef.current.x, y: targetRef.current.y })
  const [wind, setWind] = useState(randomWind())
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [sway, setSway] = useState({ x: 0, y: 0 })
  const [lastShot, setLastShot] = useState(null)
  const [locked, setLocked] = useState(false)
  const [timeLeft, setTimeLeft] = useState(SHOT_TIME / 1000)

  phaseRef.current = phase

  // mouse-lock panning + lock state
  useEffect(() => {
    function onMove(e) {
      if (document.pointerLockElement !== areaRef.current) return
      const rect = areaRef.current.getBoundingClientRect()
      const maxX = rect.width * 0.4
      const maxY = rect.height * 0.4
      const next = {
        x: clamp(panRef.current.x - e.movementX, -maxX, maxX),
        y: clamp(panRef.current.y - e.movementY, -maxY, maxY),
      }
      panRef.current = next
      setPan(next)
    }
    function onChange() {
      setLocked(document.pointerLockElement === areaRef.current)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('pointerlockchange', onChange)
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('pointerlockchange', onChange)
    }
  }, [])

  // one animation loop for scope sway + moving target (runs the whole time)
  useEffect(() => {
    let raf
    const start = performance.now()
    function loop(now) {
      const p = phaseRef.current
      if (p === 'playing' || p === 'result') {
        const t = (now - start) / 1000
        const s = {
          x: Math.sin(t * 1.3) * 18 + Math.sin(t * 0.6) * 9,
          y: Math.cos(t * 1.0) * 15 + Math.cos(t * 0.45) * 7,
        }
        swayRef.current = s
        setSway(s)
        if (p === 'playing') {
          const tg = targetRef.current
          let nx = tg.x + tg.vx
          let ny = tg.y + tg.vy
          let { vx, vy } = tg
          if (nx < 12 || nx > 88) { vx = -vx; nx = clamp(nx, 12, 88) }
          if (ny < 18 || ny > 82) { vy = -vy; ny = clamp(ny, 18, 82) }
          targetRef.current = { x: nx, y: ny, vx, vy }
          setTargetPos({ x: nx, y: ny })
        }
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  // shot clock — only ticks once you're locked into the scope
  useEffect(() => {
    if (phase !== 'playing' || !locked) return
    let raf
    const start = performance.now()
    function tick(now) {
      const remaining = SHOT_TIME - (now - start)
      if (remaining <= 0) {
        setTimeLeft(0)
        timeoutMiss()
        return
      }
      setTimeLeft(remaining / 1000)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, shots, locked])

  // free the mouse when leaving the game
  useEffect(() => {
    return () => {
      if (document.pointerLockElement) document.exitPointerLock()
    }
  }, [])

  function nextRound(nextShots) {
    timer.current = setTimeout(() => {
      if (nextShots >= TOTAL_SHOTS) {
        setPhase('over')
        if (document.pointerLockElement) document.exitPointerLock()
      } else {
        targetRef.current = randomTarget()
        setTargetPos({ x: targetRef.current.x, y: targetRef.current.y })
        setWind(randomWind())
        setLastShot(null)
        setTimeLeft(SHOT_TIME / 1000)
        setPhase('playing')
      }
    }, 900)
  }

  function startGame() {
    setShots(0)
    setScore(0)
    targetRef.current = randomTarget()
    setTargetPos({ x: targetRef.current.x, y: targetRef.current.y })
    setWind(randomWind())
    setLastShot(null)
    panRef.current = { x: 0, y: 0 }
    setPan({ x: 0, y: 0 })
    swayRef.current = { x: 0, y: 0 }
    setSway({ x: 0, y: 0 })
    setTimeLeft(SHOT_TIME / 1000)
    setPhase('playing')
  }

  function handleAreaClick() {
    if (phase !== 'playing') return
    if (document.pointerLockElement !== areaRef.current) {
      areaRef.current.requestPointerLock()
      return
    }
    fire()
  }

  function fire() {
    const rect = areaRef.current.getBoundingClientRect()
    const offX = panRef.current.x + swayRef.current.x // total world shift right now
    const offY = panRef.current.y + swayRef.current.y
    const shotX = rect.width / 2 + Math.cos(wind.angle) * wind.strength
    const shotY = rect.height / 2 + Math.sin(wind.angle) * wind.strength
    const tx = (targetRef.current.x / 100) * rect.width + offX
    const ty = (targetRef.current.y / 100) * rect.height + offY
    const dist = Math.hypot(shotX - tx, shotY - ty)
    const points = scoreForDistance(dist)

    const nextShots = shots + 1
    setShots(nextShots)
    setScore((s) => s + points)
    setLastShot({ x: shotX - offX, y: shotY - offY, hit: points > 0, points })
    setPhase('result')
    nextRound(nextShots)
  }

  function timeoutMiss() {
    const nextShots = shots + 1
    setShots(nextShots)
    setLastShot({ timeout: true })
    setPhase('result')
    nextRound(nextShots)
  }

  const windDeg = (wind.angle * 180) / Math.PI
  const windLabel = wind.strength < 65 ? 'LIGHT' : wind.strength < 95 ? 'MEDIUM' : 'STRONG'
  const worldShift = { x: pan.x + sway.x, y: pan.y + sway.y }

  return (
    <div className="shoot">
      <button className="back-btn" onClick={onBack}>← Menu</button>

      {phase === 'start' && (
        <div className="shoot-overlay">
          <h1>🎯 Shoot the Target</h1>
          <p className="sub">
            Click to look through the scope. Beat the clock, fight the wind, the sway, and a moving target!
          </p>
          <button className="play-btn" onClick={startGame}>Start</button>
        </div>
      )}

      {phase === 'over' && (
        <div className="shoot-overlay">
          <h1>{score} / {TOTAL_SHOTS * 100} pts</h1>
          <p className="sub">
            {score >= 700 ? 'Legend! 🏆' : score >= 400 ? 'Solid aim! 🎯' : 'Keep grinding! 💪'}
          </p>
          <button className="play-btn" onClick={startGame}>Play again</button>
        </div>
      )}

      {(phase === 'playing' || phase === 'result') && (
        <>
          <div className="shoot-hud">
            <span>Shots left: {TOTAL_SHOTS - shots}</span>
            <span>Score: {score}</span>
            <span className={timeLeft <= 1 ? 'time-low' : ''}>⏱ {timeLeft.toFixed(1)}s</span>
            <span className="wind-tag">
              WIND {windLabel}
              <span className="wind-arrow" style={{ transform: `rotate(${windDeg}deg)` }}>➤</span>
            </span>
          </div>

          <div className="shoot-area" ref={areaRef} onClick={handleAreaClick}>
            <div className="scope-world" style={{ transform: `translate(${worldShift.x}px, ${worldShift.y}px)` }}>
              <div className="city">
                <div className="skyline">
                  {BUILDINGS.map((b, i) => (
                    <div
                      key={i}
                      className={`building ${i % 3 === 0 ? 'purple' : ''}`}
                      style={{ width: b.w, height: `${b.h}%` }}
                    />
                  ))}
                </div>
              </div>
              <div className="target" style={{ left: `${targetPos.x}%`, top: `${targetPos.y}%` }} />

              {lastShot && !lastShot.timeout && (
                <div
                  className={`shot-mark ${lastShot.hit ? 'hit' : 'miss'}`}
                  style={{ left: lastShot.x, top: lastShot.y }}
                >
                  {lastShot.hit ? `+${lastShot.points}` : '✘'}
                </div>
              )}
            </div>

            <div className="scope-vignette" />

            <svg className="reticle" viewBox="0 0 100 100" aria-hidden="true">
              <circle cx="50" cy="50" r="30" />
              <line x1="50" y1="2" x2="50" y2="32" />
              <line x1="50" y1="68" x2="50" y2="98" />
              <line x1="2" y1="50" x2="32" y2="50" />
              <line x1="68" y1="50" x2="98" y2="50" />
              <circle className="reticle-dot" cx="50" cy="50" r="3" />
            </svg>

            {lastShot?.timeout && <div className="scope-msg">⏰ TOO SLOW</div>}

            {phase === 'playing' && !locked && (
              <div className="scope-hint">🖱️ Click to look through the scope</div>
            )}
            {locked && <div className="scope-esc">Esc to free your mouse</div>}
          </div>
        </>
      )}
    </div>
  )
}

export default ShootTarget
