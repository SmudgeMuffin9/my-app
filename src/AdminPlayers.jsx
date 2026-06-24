import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'
import { useAuth } from './auth'
import { isOwner } from './owner'
import { GAMES } from './games'

const gameLabel = (key) => {
  const g = GAMES.find((x) => x.key === key)
  return g ? `${g.emoji} ${g.name}` : key
}

// OWNER-ONLY page: see every player + their coins, set balances, ban/unban,
// and remove games they own. All backed by owner-only database rules.
function AdminPlayers({ onBack }) {
  const { username, reloadProfile } = useAuth()
  const [players, setPlayers] = useState([]) // { id, username, coins }
  const [unlocks, setUnlocks] = useState([]) // { user_id, game }
  const [banned, setBanned] = useState([]) // lowercased banned usernames
  const [edits, setEdits] = useState({}) // username -> number typed
  const [error, setError] = useState(null)
  const [msg, setMsg] = useState(null)

  const loadPlayers = useCallback(() => {
    supabase
      .from('profiles')
      .select('id, username, coins')
      .order('coins', { ascending: false })
      .then(({ data, error }) => {
        if (error) setError(error.message)
        else setPlayers(data ?? [])
      })
  }, [])

  const loadUnlocks = useCallback(() => {
    supabase
      .from('unlocks')
      .select('user_id, game')
      .then(({ data }) => setUnlocks(data ?? []))
  }, [])

  const loadBans = useCallback(() => {
    supabase
      .from('bans')
      .select('username')
      .then(({ data }) => setBanned((data ?? []).map((r) => r.username.toLowerCase())))
  }, [])

  useEffect(() => {
    loadPlayers()
    loadUnlocks()
    loadBans()
  }, [loadPlayers, loadUnlocks, loadBans])

  if (!isOwner(username)) {
    return (
      <section id="center">
        <button className="back-btn" onClick={onBack}>← Menu</button>
        <h1>🔒 Owner only</h1>
        <p className="lb-empty">This page is just for the owner.</p>
      </section>
    )
  }

  async function setCoins(name) {
    const amount = parseInt(edits[name], 10)
    if (Number.isNaN(amount) || amount < 0) {
      setMsg('⚠️ Type a whole number (0 or higher) first.')
      return
    }
    setMsg(null)
    const { error } = await supabase.rpc('set_coins', { p_username: name, p_amount: amount })
    if (error) {
      setMsg(`⚠️ ${error.message}`)
      return
    }
    setMsg(`✅ Set ${name} to ${amount} 🪙`)
    setEdits((e) => ({ ...e, [name]: '' }))
    loadPlayers()
    reloadProfile()
  }

  async function removeGame(playerId, game, name) {
    if (!window.confirm(`Remove ${gameLabel(game)} from ${name}?`)) return
    setMsg(null)
    const { error } = await supabase
      .from('unlocks')
      .delete()
      .eq('user_id', playerId)
      .eq('game', game)
    if (error) {
      setMsg(`⚠️ ${error.message}`)
      return
    }
    setMsg(`🗑️ Removed ${gameLabel(game)} from ${name}`)
    loadUnlocks()
  }

  async function ban(name) {
    if (!window.confirm(`Ban ${name}?\nWipes their scores and blocks new ones.`)) return
    setMsg(null)
    const { error: banErr } = await supabase.from('bans').insert({ username: name })
    if (banErr) {
      setMsg(`⚠️ ${banErr.message}`)
      return
    }
    await supabase.from('scores').delete().eq('name', name)
    setMsg(`🚫 Banned ${name}`)
    loadBans()
  }

  async function unban(name) {
    setMsg(null)
    const { error } = await supabase.from('bans').delete().eq('username', name)
    if (error) {
      setMsg(`⚠️ ${error.message}`)
      return
    }
    setMsg(`✅ Unbanned ${name}`)
    loadBans()
  }

  return (
    <section id="center">
      <button className="back-btn" onClick={onBack}>← Menu</button>
      <h1>🔨 Players</h1>
      <p className="lb-empty">{players.length} players</p>

      {error && <p className="lb-error">⚠️ {error}</p>}
      {msg && <p className="shop-msg">{msg}</p>}

      <div className="admin-list">
        {players.map((p) => {
          const isBanned = banned.includes(p.username.toLowerCase())
          const myGames = unlocks.filter((u) => u.user_id === p.id).map((u) => u.game)
          return (
            <div key={p.username} className={`admin-row ${isBanned ? 'banned' : ''}`}>
              <div className="admin-row-top">
                <span className={`admin-name ${isOwner(p.username) ? 'owner' : ''}`}>
                  {isOwner(p.username) ? `🔨 ${p.username}` : p.username}
                  {isBanned && <span className="admin-banned-tag"> 🚫 banned</span>}
                </span>
                <span className="admin-coins">🪙 {p.coins}</span>
                <input
                  className="lb-input admin-input"
                  type="number"
                  min="0"
                  placeholder="set…"
                  value={edits[p.username] ?? ''}
                  onChange={(e) =>
                    setEdits((s) => ({ ...s, [p.username]: e.target.value }))
                  }
                />
                <button className="play-btn admin-set" onClick={() => setCoins(p.username)}>
                  Set
                </button>
                {!isOwner(p.username) &&
                  (isBanned ? (
                    <button className="play-btn admin-set" onClick={() => unban(p.username)}>
                      Unban
                    </button>
                  ) : (
                    <button
                      className="lb-del admin-ban"
                      onClick={() => ban(p.username)}
                      title={`Ban ${p.username}`}
                    >
                      🚫
                    </button>
                  ))}
              </div>

              {myGames.length > 0 && (
                <div className="admin-games">
                  {myGames.map((g) => (
                    <button
                      key={g}
                      className="admin-game-chip"
                      onClick={() => removeGame(p.id, g, p.username)}
                      title={`Remove ${gameLabel(g)}`}
                    >
                      {gameLabel(g)} ✕
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

export default AdminPlayers
