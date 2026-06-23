import { useState, useRef, useEffect } from 'react'

const DURATION = 5 // seconds you get to spam

function cpsRank(cps) {
  if (cps >= 10) return 'INHUMAN 🤖🔥'
  if (cps >= 8) return 'Cracked!! ⚡'
  if (cps >= 6) return 'Super fast 💪'
  if (cps >= 4) return 'Pretty quick 🙂'
  if (cps >= 2) return 'Not bad 👍'
  return 'Warming up 🐢'
}

function ClickSpeed({ onBack }) {
  const [phase, setPhase] = useState('ready') // ready, running, done
  const [clicks, setClicks] = useState(0)
  const [timeLeft, setTimeLeft] = useState(DURATION)
  const startRef = useRef(0)

  // countdown that runs while spamming
  useEffect(() => {
    if (phase !== 'running') return
    let raf
    function tick(now) {
      const remaining = DURATION - (now - startRef.current) / 1000
      if (remaining <= 0) {
        setTimeLeft(0)
        setPhase('done')
        return
      }
      setTimeLeft(remaining)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [phase])

  function handleClick() {
    if (phase === 'done') return
    if (phase === 'ready') {
      // first click starts the clock AND counts
      startRef.current = performance.now()
      setClicks(1)
      setPhase('running')
      return
    }
    setClicks((c) => c + 1)
  }

  // spacebar counts as a click too (ignore held-down auto-repeat)
  useEffect(() => {
    function onKey(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      if (e.code !== 'Space') return
      e.preventDefault()
      if (e.repeat) return
      handleClick()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  function reset() {
    setClicks(0)
    setTimeLeft(DURATION)
    setPhase('ready')
  }

  const cps = clicks / DURATION

  return (
    <section id="center">
      <button className="back-btn" onClick={onBack}>← Menu</button>

      <h1>🖱️ Click Speed Test</h1>

      {phase !== 'done' ? (
        <>
          <p className="cps-stat">
            {phase === 'ready'
              ? `Click or tap SPACE as fast as you can for ${DURATION} seconds!`
              : `⏱ ${timeLeft.toFixed(1)}s left`}
          </p>
          <button className="cps-pad" onClick={handleClick}>
            {phase === 'ready' ? 'CLICK TO START' : clicks}
          </button>
          {phase === 'running' && <p className="cps-stat">Keep going! 🔥</p>}
        </>
      ) : (
        <>
          <h2 className="cps-result">{cps.toFixed(1)} CPS</h2>
          <p className="cps-stat">
            {clicks} clicks in {DURATION}s — {cpsRank(cps)}
          </p>
          <button className="play-btn" onClick={reset}>Try again</button>
        </>
      )}
    </section>
  )
}

export default ClickSpeed
