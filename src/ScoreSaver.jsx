import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import { useAuth } from './auth'
import { isOwner } from './owner'

// Reusable: <ScoreSaver game="snake" score={score} />. Keeps only your BEST
// score per game. lowerIsBetter={true} for games where smaller wins (ms).
function ScoreSaver({ game, score, lowerIsBetter = false }) {
  const { user, username } = useAuth()
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)
  const [top, setTop] = useState([])
  const [error, setError] = useState(null)

  async function loadTop() {
    const { data, error } = await supabase
      .from('scores')
      .select('name, score')
      .eq('game', game)
      .order('score', { ascending: lowerIsBetter })
      .limit(10)
    if (error) setError(error.message)
    else setTop(data)
  }

  useEffect(() => {
    loadTop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function save() {
    setSaving(true)
    setError(null)

    // do I already have a score for this game?
    const { data: existing, error: e1 } = await supabase
      .from('scores')
      .select('id, score')
      .eq('game', game)
      .eq('user_id', user.id)
      .maybeSingle()
    if (e1) {
      setError(e1.message)
      setSaving(false)
      return
    }

    const isBetter =
      !existing || (lowerIsBetter ? score < existing.score : score > existing.score)

    let err = null
    if (!existing) {
      const r = await supabase
        .from('scores')
        .insert({ game, name: username, score, user_id: user.id })
      err = r.error
    } else if (isBetter) {
      const r = await supabase
        .from('scores')
        .update({ score, name: username })
        .eq('id', existing.id)
      err = r.error
    }

    setSaving(false)
    if (err) {
      setError(err.message)
      return
    }
    setSaved(true)
    setMessage(isBetter ? '🎉 New personal best!' : `Not a new best — your best is ${existing.score}`)
    loadTop()
  }

  return (
    <div className="lb">
      {!user ? (
        <p className="lb-empty">🔐 Sign in (top of the menu) to save your score!</p>
      ) : !username ? (
        <p className="lb-empty">👆 Pick a username (top of the menu) to save your score!</p>
      ) : !saved ? (
        <button className="play-btn" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : `Save score as ${username}`}
        </button>
      ) : (
        <p className="lb-saved">{message}</p>
      )}

      {error && <p className="lb-error">⚠️ {error}</p>}

      <h3 className="lb-title">🏆 Top 10</h3>
      {top.length === 0 ? (
        <p className="lb-empty">No scores yet — be the first!</p>
      ) : (
        <ol className="lb-list">
          {top.map((row, i) => (
            <li key={i}>
              <span className="lb-rank">{i + 1}.</span>
              <span className={`lb-name ${isOwner(row.name) ? 'owner' : ''}`}>
                {isOwner(row.name) ? `🔨 ${row.name} (owner)` : row.name}
              </span>
              <span className="lb-score">{row.score}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

export default ScoreSaver
