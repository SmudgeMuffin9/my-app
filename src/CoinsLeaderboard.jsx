import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import { isOwner } from './owner'

// Top 10 players by coin balance (reads the profiles table, not scores).
function CoinsLeaderboard() {
  const [top, setTop] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    supabase
      .from('profiles')
      .select('username, coins')
      .order('coins', { ascending: false })
      .limit(10)
      .then(({ data, error }) => {
        if (error) setError(error.message)
        else setTop(data ?? [])
      })
  }, [])

  return (
    <div className="lb">
      <h3 className="lb-title">🪙 Top Coins</h3>
      {error && <p className="lb-error">⚠️ {error}</p>}
      {top.length === 0 ? (
        <p className="lb-empty">No players yet</p>
      ) : (
        <ol className="lb-list">
          {top.map((row, i) => (
            <li key={i}>
              <span className="lb-rank">{i + 1}.</span>
              <span className={`lb-name ${isOwner(row.username) ? 'owner' : ''}`}>
                {isOwner(row.username) ? `🔨 ${row.username} (owner)` : row.username}
              </span>
              <span className="lb-score">{(row.coins ?? 0).toLocaleString()} 🪙</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

export default CoinsLeaderboard
