import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import { isOwner } from './owner'

// Read-only leaderboard for one game (used on the Leaderboards tab).
function Leaderboard({ game, title, lowerIsBetter = false, unit = '' }) {
  const [top, setTop] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    supabase
      .from('scores')
      .select('name, score')
      .eq('game', game)
      .order('score', { ascending: lowerIsBetter })
      .limit(10)
      .then(({ data, error }) => {
        if (error) setError(error.message)
        else setTop(data)
      })
  }, [game, lowerIsBetter])

  return (
    <div className="lb">
      <h3 className="lb-title">{title}</h3>
      {error && <p className="lb-error">⚠️ {error}</p>}
      {top.length === 0 ? (
        <p className="lb-empty">No scores yet</p>
      ) : (
        <ol className="lb-list">
          {top.map((row, i) => (
            <li key={i}>
              <span className="lb-rank">{i + 1}.</span>
              <span className={`lb-name ${isOwner(row.name) ? 'owner' : ''}`}>
                {isOwner(row.name) ? `🔨 ${row.name} (owner)` : row.name}
              </span>
              <span className="lb-score">{row.score}{unit}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

export default Leaderboard
