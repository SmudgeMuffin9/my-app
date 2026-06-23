import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import { useAuth } from './auth'
import { GAMES, LOCKED } from './games'

// The shop: buy locked games with Smudge's. Buying goes through the
// buy_game() cashier function in the database (the only safe way to spend).
function Shop({ onBack }) {
  const { user, username, coins, owned, reloadProfile } = useAuth()
  const [prices, setPrices] = useState({}) // { game: price }
  const [busy, setBusy] = useState(null)   // which game is mid-purchase
  const [msg, setMsg] = useState(null)

  // load the price list from the database
  useEffect(() => {
    supabase
      .from('game_prices')
      .select('game, price')
      .then(({ data }) => {
        const map = {}
        for (const row of data ?? []) map[row.game] = row.price
        setPrices(map)
      })
  }, [])

  async function buy(key, name) {
    setMsg(null)
    setBusy(key)
    const { data, error } = await supabase.rpc('buy_game', { p_game: key })
    setBusy(null)
    if (error) {
      setMsg(`⚠️ ${error.message}`)
      return
    }
    if (data === 'ok') setMsg(`🎉 Unlocked ${name}!`)
    else if (data === 'not enough') setMsg(`😬 Not enough Smudge's for ${name}.`)
    else if (data === 'already owned') setMsg(`You already own ${name}.`)
    else setMsg(String(data))
    reloadProfile() // refresh coins + owned games
  }

  // only the locked games are for sale, shown in price order
  const forSale = GAMES.filter((g) => LOCKED.has(g.key)).sort(
    (a, b) => (prices[a.key] ?? 0) - (prices[b.key] ?? 0)
  )

  return (
    <section id="center">
      <button className="back-btn" onClick={onBack}>← Menu</button>
      <h1>🛒 Shop</h1>

      {!user ? (
        <p className="lb-empty">🔐 Sign in (on the menu) to earn and spend Smudge's!</p>
      ) : !username ? (
        <p className="lb-empty">👆 Pick a username first to use the shop.</p>
      ) : (
        <p className="shop-balance">🪙 You have <b>{coins}</b> Smudge's</p>
      )}

      {msg && <p className="shop-msg">{msg}</p>}

      <div className="shop-grid">
        {forSale.map((g) => {
          const price = prices[g.key]
          const have = owned.includes(g.key)
          const tooPoor = price != null && coins < price
          return (
            <div key={g.key} className="shop-card">
              <span className="shop-emoji">{g.emoji}</span>
              <span className="shop-name">{g.name}</span>
              {have ? (
                <span className="shop-owned">✅ Owned</span>
              ) : (
                <>
                  <span className="shop-price">🪙 {price ?? '—'}</span>
                  <button
                    className="play-btn shop-buy"
                    disabled={!user || !username || tooPoor || busy === g.key}
                    onClick={() => buy(g.key, g.name)}
                  >
                    {busy === g.key ? 'Buying…' : tooPoor ? 'Need more 🪙' : 'Buy'}
                  </button>
                </>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

export default Shop
