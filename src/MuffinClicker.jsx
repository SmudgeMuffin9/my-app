import { useState, useRef, useEffect, useCallback } from 'react'
import { supabase } from './supabase'
import { useAuth } from './auth'

// --- buildings: auto-bake muffins per second ---
const BUILDINGS = [
  { key: 'helper', name: 'Extra Hands', emoji: '👐', baseCost: 15, cps: 0.1 },
  { key: 'baker', name: 'Baker', emoji: '🧑‍🍳', baseCost: 100, cps: 1 },
  { key: 'bakery', name: 'Bakery', emoji: '🏭', baseCost: 1100, cps: 8 },
  { key: 'truck', name: 'Muffin Truck', emoji: '🚚', baseCost: 12000, cps: 47 },
  { key: 'bank', name: 'Muffin Bank', emoji: '🏦', baseCost: 130000, cps: 260 },
  { key: 'rocket', name: 'Muffin Rocket', emoji: '🚀', baseCost: 1400000, cps: 1400 },
]

// --- upgrades: one-time buys that MULTIPLY output (they stack) ---
const UPGRADES = [
  { key: 'arms', name: 'Strong Arms', emoji: '🖐️', cost: 500, type: 'click', desc: 'Clicks ×2' },
  { key: 'fast', name: 'Faster Baking', emoji: '⚡', cost: 3000, type: 'cps', desc: 'All bakers ×2' },
  { key: 'power', name: 'Power Clicks', emoji: '💪', cost: 12000, type: 'click', desc: 'Clicks ×2 again' },
  { key: 'hot', name: 'Hot Ovens', emoji: '🔥', cost: 80000, type: 'cps', desc: 'All bakers ×2 again' },
]

const GROWTH = 1.15 // each building you own makes the next 15% pricier
const MAX_OFFLINE = 8 * 3600 // cap "while away" earnings at 8 hours
const EMPTY = Object.fromEntries(BUILDINGS.map((b) => [b.key, 0]))

const costOf = (b, count) => Math.ceil(b.baseCost * Math.pow(GROWTH, count))

// doubling multiplier from owned upgrades of a given type
const multFrom = (owned, type) =>
  UPGRADES.filter((u) => owned.includes(u.key) && u.type === type).reduce((m) => m * 2, 1)

// pretty numbers: 0.1 -> "0.1", 1234 -> "1.2K", 3450000 -> "3.4M" ...
function fmt(n) {
  if (n < 1000) {
    // keep the decimal for small fractional values (like 0.1 / sec)
    if (n > 0 && n < 100 && !Number.isInteger(n)) return n.toFixed(1)
    return String(Math.floor(n))
  }
  const units = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi']
  let u = 0
  while (n >= 1000 && u < units.length - 1) {
    n /= 1000
    u++
  }
  return (n < 10 ? n.toFixed(2) : n < 100 ? n.toFixed(1) : Math.floor(n)) + units[u]
}

// the big muffin COUNT: show one ticking decimal while small, compact when huge
function countFmt(n) {
  if (n < 100000) return n.toFixed(1)
  return fmt(n)
}

function MuffinClicker({ onBack }) {
  const { user } = useAuth()
  const [muffins, setMuffins] = useState(0)
  const [counts, setCounts] = useState(EMPTY)
  const [upgrades, setUpgrades] = useState([]) // keys of owned upgrades
  const [loaded, setLoaded] = useState(false)
  const [offlineMsg, setOfflineMsg] = useState(null)

  // refs mirror latest values so the loop + saver always see "now"
  const muffinsRef = useRef(0)
  const countsRef = useRef(EMPTY)
  const upgradesRef = useRef([])
  const lastRef = useRef(0)
  muffinsRef.current = muffins
  countsRef.current = counts
  upgradesRef.current = upgrades

  const clickMult = multFrom(upgrades, 'click')
  const cpsMult = multFrom(upgrades, 'cps')
  const clickPower = 1 * clickMult
  const mps = BUILDINGS.reduce((s, b) => s + counts[b.key] * b.cps, 0) * cpsMult

  // 1) load this player's save once (+ offline earnings since they left)
  useEffect(() => {
    if (!user) return
    supabase
      .from('muffin_saves')
      .select('muffins, buildings, upgrades, updated_at')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          const sc = { ...EMPTY, ...(data.buildings || {}) }
          const su = data.upgrades || []
          const savedMps =
            BUILDINGS.reduce((s, b) => s + sc[b.key] * b.cps, 0) * multFrom(su, 'cps')
          const elapsed = data.updated_at
            ? Math.min(MAX_OFFLINE, Math.max(0, (Date.now() - new Date(data.updated_at).getTime()) / 1000))
            : 0
          const offline = Math.floor(savedMps * elapsed)
          setCounts(sc)
          setUpgrades(su)
          setMuffins((Number(data.muffins) || 0) + offline)
          if (offline > 0) setOfflineMsg(`🧁 You baked ${fmt(offline)} muffins while away!`)
        }
        setLoaded(true)
      })
  }, [user])

  // 2) production loop: add muffins 10× a second
  useEffect(() => {
    if (!loaded) return
    lastRef.current = performance.now()
    const id = setInterval(() => {
      const now = performance.now()
      const dt = (now - lastRef.current) / 1000
      lastRef.current = now
      const rate =
        BUILDINGS.reduce((s, b) => s + countsRef.current[b.key] * b.cps, 0) *
        multFrom(upgradesRef.current, 'cps')
      if (rate > 0) setMuffins((m) => m + rate * dt)
    }, 100)
    return () => clearInterval(id)
  }, [loaded])

  // 3) save: every 8s + once on leave
  const save = useCallback(() => {
    if (!user) return
    supabase
      .from('muffin_saves')
      .upsert({
        user_id: user.id,
        muffins: Math.floor(muffinsRef.current),
        buildings: countsRef.current,
        upgrades: upgradesRef.current,
        updated_at: new Date().toISOString(),
      })
      .then(() => {})
  }, [user])

  useEffect(() => {
    if (!loaded) return
    const id = setInterval(save, 8000)
    return () => {
      clearInterval(id)
      save()
    }
  }, [loaded, save])

  function clickMuffin() {
    setMuffins((m) => m + 1 * multFrom(upgradesRef.current, 'click'))
  }

  function buyBuilding(b) {
    const cost = costOf(b, countsRef.current[b.key])
    if (muffinsRef.current < cost) return
    setMuffins((m) => m - cost)
    setCounts((c) => ({ ...c, [b.key]: c[b.key] + 1 }))
  }

  function buyUpgrade(u) {
    if (upgradesRef.current.includes(u.key) || muffinsRef.current < u.cost) return
    setMuffins((m) => m - u.cost)
    setUpgrades((list) => [...list, u.key])
  }

  return (
    <section id="center">
      <button className="back-btn" onClick={() => { save(); onBack() }}>← Menu</button>
      <h1>🧁 Muffin Clicker</h1>

      {!loaded ? (
        <p className="lb-empty">🧁 Loading your bakery…</p>
      ) : (
        <>
          {offlineMsg && <p className="muffin-offline">{offlineMsg}</p>}
          <p className="muffin-count">{countFmt(muffins)} muffins</p>
          <p className="muffin-mps">{fmt(mps)} / sec · +{fmt(clickPower)} per click</p>

          <button className="muffin-big" onClick={clickMuffin} aria-label="Click the muffin">
            🧁
          </button>

          <h3 className="muffin-head">🏗️ Buildings</h3>
          <div className="muffin-shop">
            {BUILDINGS.map((b) => {
              const count = counts[b.key]
              const cost = costOf(b, count)
              return (
                <button
                  key={b.key}
                  className="muffin-buy"
                  disabled={muffins < cost}
                  onClick={() => buyBuilding(b)}
                >
                  <span className="muffin-buy-emoji">{b.emoji}</span>
                  <span className="muffin-buy-main">
                    <span className="muffin-buy-name">{b.name}</span>
                    <span className="muffin-buy-sub">+{b.cps}/sec · owned {count}</span>
                  </span>
                  <span className="muffin-buy-cost">🧁 {fmt(cost)}</span>
                </button>
              )
            })}
          </div>

          <h3 className="muffin-head">⭐ Upgrades</h3>
          <div className="muffin-shop">
            {UPGRADES.map((u) => {
              const owned = upgrades.includes(u.key)
              return (
                <button
                  key={u.key}
                  className="muffin-buy"
                  disabled={owned || muffins < u.cost}
                  onClick={() => buyUpgrade(u)}
                >
                  <span className="muffin-buy-emoji">{u.emoji}</span>
                  <span className="muffin-buy-main">
                    <span className="muffin-buy-name">{u.name}</span>
                    <span className="muffin-buy-sub">{u.desc}</span>
                  </span>
                  <span className="muffin-buy-cost">
                    {owned ? '✅ owned' : `🧁 ${fmt(u.cost)}`}
                  </span>
                </button>
              )
            })}
          </div>
        </>
      )}
    </section>
  )
}

export default MuffinClicker
