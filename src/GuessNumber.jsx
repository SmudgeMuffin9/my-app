import { useState, useRef } from 'react'
import ScoreSaver from './ScoreSaver'

// the robot secretly picks a whole number from 1 to 100
function newSecret() {
  return Math.floor(Math.random() * 100) + 1
}

function GuessNumber({ onBack }) {
  const [secret, setSecret] = useState(newSecret)
  const [guess, setGuess] = useState('')
  const [count, setCount] = useState(0)
  const [low, setLow] = useState(1)   // smallest it could still be
  const [high, setHigh] = useState(100) // largest it could still be
  const [message, setMessage] = useState('I picked a number 1–100. Can you find it? 🤖')
  const [won, setWon] = useState(false)
  const inputRef = useRef(null)

  function reset() {
    setSecret(newSecret())
    setGuess('')
    setCount(0)
    setLow(1)
    setHigh(100)
    setMessage('New number locked in. Go! 🤖')
    setWon(false)
    inputRef.current?.focus()
  }

  function submitGuess(e) {
    e.preventDefault()
    const n = Number(guess)
    if (!Number.isInteger(n) || n < 1 || n > 100) {
      setMessage('Type a whole number from 1 to 100! 🙃')
      setGuess('')
      return
    }
    const nextCount = count + 1
    setCount(nextCount)

    if (n === secret) {
      setWon(true)
      setMessage(`🎉 YES! It was ${secret} — found in ${nextCount} guess${nextCount === 1 ? '' : 'es'}!`)
    } else if (n < secret) {
      setMessage(`${n}? Higher! ⬆️`)
      setLow((lo) => Math.max(lo, n + 1))
    } else {
      setMessage(`${n}? Lower! ⬇️`)
      setHigh((hi) => Math.min(hi, n - 1))
    }
    setGuess('')
  }

  return (
    <section id="center">
      <button className="back-btn" onClick={onBack}>← Menu</button>

      <h1>🤖 Guess the Number</h1>
      <p className="guess-msg">{message}</p>

      {!won && (
        <p className="guess-range">
          It's between <b>{low}</b> and <b>{high}</b>
        </p>
      )}

      {!won ? (
        <form className="guess-form" onSubmit={submitGuess}>
          <input
            ref={inputRef}
            type="number"
            inputMode="numeric"
            min="1"
            max="100"
            value={guess}
            onChange={(e) => setGuess(e.target.value)}
            className="guess-input"
            placeholder="1-100"
            autoFocus
          />
          <button type="submit" className="play-btn">Guess</button>
        </form>
      ) : (
        <>
          <ScoreSaver game="guess" score={count} lowerIsBetter />
          <button className="play-btn" onClick={reset}>Play again</button>
        </>
      )}

      <p className="guess-count">Guesses: {count}</p>
    </section>
  )
}

export default GuessNumber
