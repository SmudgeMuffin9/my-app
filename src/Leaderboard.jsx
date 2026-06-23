import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'
import { isOwner } from './owner'
import { useAuth } from './auth'

// Read-only leaderboard for one game (used on the Leaderboards tab).
// If the OWNER is logged in, each row also gets a 🗑️ delete button.
function Leaderboard({ game, title, lowerIsBetter = false, unit = '' }) {
  const [top, setTop] = useState([])
  const [error, setError] = useState(null)
  const { username } = useAuth()
  const canDelete = isOwner(username) // only the owner sees trash buttons

  // Grab this game's Top 10. Pulled out so we can re-run it after a delete.
  const loadScores = useCallback(() => {
    supabase
      .from('scores')
      .select('id, name, score')
      .eq('game', game)
      .order('score', { ascending: lowerIsBetter })
      .limit(10)
      .then(({ data, error }) => {
        if (error) setError(error.message)
        else setTop(data)
      })
  }, [game, lowerIsBetter])

  useEffect(() => {
    loadScores()
  }, [loadScores])

  async function handleDelete(id, name) {
    if (!window.confirm(`Delete ${name}'s score? This can't be undone.`)) return
    const { error } = await supabase.from('scores').delete().eq('id', id)
    if (error) {
      setError(error.message)
      return
    }
    loadScores() // refresh the list so the deleted score disappears
  }

  return (
    <div className="lb">
      <h3 className="lb-title">{title}</h3>
      {error && <p className="lb-error">⚠️ {error}</p>}
      {top.length === 0 ? (
        <p className="lb-empty">No scores yet</p>
      ) : (
        <ol className="lb-list">
          {top.map((row, i) => (
            <li key={row.id}>
              <span className="lb-rank">{i + 1}.</span>
              <span className={`lb-name ${isOwner(row.name) ? 'owner' : ''}`}>
                {isOwner(row.name) ? `🔨 ${row.name} (owner)` : row.name}
              </span>
              <span className="lb-score">{row.score}{unit}</span>
              {canDelete && (
                <button
                  className="lb-del"
                  onClick={() => handleDelete(row.id, row.name)}
                  title={`Delete ${row.name}'s score`}
                >
                  🗑️
                </button>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

export default Leaderboard
