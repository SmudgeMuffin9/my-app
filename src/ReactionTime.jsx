import { useState, useRef } from 'react'

// The five "screens" (states) the game can be in.
// Each one decides the background color, the big title, and the small hint.
const VIEWS = {
  start:    { bg: '#1e293b', title: 'Reaction Time ⚡', sub: 'Click anywhere to start' },
  waiting:  { bg: '#1e3a8a', title: 'Wait for it…',      sub: 'Click the moment it turns RED' },
  now:      { bg: '#dc2626', title: 'CLICK NOW!',        sub: '' },
  result:   { bg: '#16a34a', title: '',                  sub: 'Click to play again' },
  tooearly: { bg: '#ea580c', title: 'Too early! 😅',     sub: 'Click to try again' },
}

function ReactionTime({ onBack }) {
  // "state" = the live data React watches. Change it -> screen redraws itself.
  const [view, setView] = useState('start')
  const [ms, setMs] = useState(0)

  // useRef = a sticky note React keeps but does NOT redraw on. Perfect for
  // remembering the start time and the timer id behind the scenes.
  const startTime = useRef(0)
  const timer = useRef(null)

  function beginWaiting() {
    setView('waiting')
    // wait a random 1 to 4 seconds, THEN turn red and start the clock
    const delay = 1000 + Math.random() * 3000
    timer.current = setTimeout(() => {
      startTime.current = performance.now() // ultra-precise stopwatch start
      setView('now')
    }, delay)
  }

  function handleClick() {
    if (view === 'start' || view === 'result' || view === 'tooearly') {
      beginWaiting()
    } else if (view === 'waiting') {
      clearTimeout(timer.current) // they jumped the gun
      setView('tooearly')
    } else if (view === 'now') {
      setMs(Math.round(performance.now() - startTime.current)) // how long it took
      setView('result')
    }
  }

  const screen = VIEWS[view]
  // On the result screen, the big title is the score in milliseconds.
  const title = view === 'result' ? `${ms} ms` : screen.title

  return (
    <div className="reaction" style={{ background: screen.bg }} onClick={handleClick}>
      <button
        className="back-btn"
        onClick={(e) => { e.stopPropagation(); onBack() }}
      >
        ← Menu
      </button>
      <h1>{title}</h1>
      {screen.sub && <p className="sub">{screen.sub}</p>}
    </div>
  )
}

export default ReactionTime
