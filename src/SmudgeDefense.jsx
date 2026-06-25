import { useState, useRef, useEffect } from 'react'
import ScoreSaver from './ScoreSaver'

// ============================================================
// SMUDGE DEFENSE — an original fixed-path tower defense game.
// Enemies march along a set road toward your base. Spend money
// to build towers; they auto-shoot. Survive endless waves
// (boss every 5th). Score = waves cleared.
//
// 27 towers, built from a small set of POWERS that mix + match:
//   dmg/range/cooldown, slow, poison (dot), splash, chain
//   lightning, stun, knockback, and aura buffs.
// ============================================================

// --- the grid / arena ---
const TILE = 40
const COLS = 9
const ROWS = 11
const W = COLS * TILE   // 360
const H = ROWS * TILE   // 440

// --- the road, drawn as CORNERS (col,row). Straight lines between them. ---
const CORNERS = [
  [-1, 1], [7, 1], [7, 3], [1, 3], [1, 5],
  [7, 5], [7, 7], [1, 7], [1, 9], [9, 9],
]
const center = (c, r) => ({ x: c * TILE + TILE / 2, y: r * TILE + TILE / 2 })
const WAYPOINTS = CORNERS.map(([c, r]) => center(c, r))
const BASE = center(8, 9)

const PATH_CELLS = new Set()
for (let i = 0; i < CORNERS.length - 1; i++) {
  const [c1, r1] = CORNERS[i]
  const [c2, r2] = CORNERS[i + 1]
  const dc = Math.sign(c2 - c1)
  const dr = Math.sign(r2 - r1)
  let c = c1, r = r1
  PATH_CELLS.add(`${c},${r}`)
  while (c !== c2 || r !== r2) { c += dc; r += dr; PATH_CELLS.add(`${c},${r}`) }
}
const isPathCell = (c, r) => PATH_CELLS.has(`${c},${r}`)
const inGrid = (c, r) => c >= 0 && c < COLS && r >= 0 && r < ROWS
const isBuildable = (c, r) => inGrid(c, r) && !isPathCell(c, r)

// ============================================================
// THE 30 TOWERS. Each is built from optional "powers":
//   dmg, cooldown(s), range(px)         — core
//   slowMul (<1) + slowTime             — freeze: cut enemy speed
//   dotDps + dotTime                    — poison: damage over time
//   splash (px)                         — area damage around the hit
//   beam: true                          — instant laser instead of a bullet
//   chain (n) + chainRange              — lightning hops to n more enemies
//   stun (s)                            — enemy can't move
//   knock (px)                          — shove the enemy back down the road
//   aura {range, dmgMul, fireMul} + shoot:false — buffs nearby towers
// ============================================================
const TOWERS = [
  // ---- Tier 1: cheap starters ----
  { id: 'pea',     emoji: '🟢', name: 'Pea Pelter', cost: 40,  color: '#86efac', dmg: 1,  cooldown: 0.6,  range: 72 },
  { id: 'blaster', emoji: '🔫', name: 'Blaster',    cost: 50,  color: '#22d3ee', dmg: 1,  cooldown: 0.45, range: 80 },
  { id: 'archer',  emoji: '🏹', name: 'Archer',     cost: 70,  color: '#a3e635', dmg: 2,  cooldown: 0.8,  range: 115 },
  { id: 'froster', emoji: '❄️', name: 'Froster',    cost: 80,  color: '#7dd3fc', dmg: 0,  cooldown: 0.7,  range: 74, slowMul: 0.5, slowTime: 1.3 },
  { id: 'torch',   emoji: '🔥', name: 'Torch',      cost: 90,  color: '#fb923c', dmg: 0,  cooldown: 0.9,  range: 72, dotDps: 3, dotTime: 2 },

  // ---- Tier 2: mid-game roles ----
  { id: 'glacier', emoji: '🧊', name: 'Glacier',    cost: 150, color: '#67e8f9', dmg: 1,  cooldown: 1.0,  range: 90, slowMul: 0.35, slowTime: 2, splash: 30 },
  { id: 'hammer',  emoji: '🔨', name: 'Hammer',     cost: 160, color: '#fbbf24', dmg: 8,  cooldown: 1.6,  range: 70, stun: 0.5 },
  { id: 'tesla',   emoji: '⚡', name: 'Tesla',      cost: 160, color: '#a78bfa', dmg: 3,  cooldown: 0.8,  range: 90, beam: true, chain: 3, chainRange: 80 },
  { id: 'venom',   emoji: '☠️', name: 'Venom',      cost: 170, color: '#84cc16', dmg: 1,  cooldown: 1.0,  range: 85, dotDps: 6, dotTime: 3 },
  { id: 'cyclone', emoji: '🌪️', name: 'Cyclone',    cost: 180, color: '#38bdf8', dmg: 2,  cooldown: 0.9,  range: 85, knock: 18 },
  { id: 'cannon',  emoji: '💣', name: 'Cannon',     cost: 120, color: '#f59e0b', dmg: 6,  cooldown: 1.3,  range: 100, splash: 35 },
  { id: 'sniper',  emoji: '🎯', name: 'Sniper',     cost: 200, color: '#ef4444', dmg: 12, cooldown: 1.9,  range: 165, beam: true },
  { id: 'booster', emoji: '🎺', name: 'Booster',    cost: 130, color: '#f0abfc', shoot: false, range: 80, aura: { range: 80, dmgMul: 1.25, fireMul: 1.0 } },

  // ---- Tier 3: strong ----
  { id: 'gatling', emoji: '⚙️', name: 'Gatling',    cost: 300, color: '#94a3b8', dmg: 3,  cooldown: 0.15, range: 90 },
  { id: 'bomber',  emoji: '🧨', name: 'Bomber',     cost: 240, color: '#f97316', dmg: 10, cooldown: 1.5,  range: 90, splash: 55 },
  { id: 'scorpion',emoji: '🦂', name: 'Scorpion',   cost: 260, color: '#65a30d', dmg: 2,  cooldown: 0.7,  range: 95, dotDps: 12, dotTime: 3 },
  { id: 'rocket',  emoji: '🚀', name: 'Rocket',     cost: 260, color: '#fb7185', dmg: 14, cooldown: 1.8,  range: 120, splash: 45 },
  { id: 'storm',   emoji: '🌩️', name: 'Storm',      cost: 300, color: '#818cf8', dmg: 5,  cooldown: 0.9,  range: 100, beam: true, chain: 5, chainRange: 85 },
  { id: 'gravity', emoji: '🪐', name: 'Gravity',    cost: 320, color: '#c084fc', dmg: 2,  cooldown: 1.0,  range: 100, slowMul: 0.25, slowTime: 2.5, splash: 40 },
  { id: 'railgun', emoji: '🛰️', name: 'Railgun',    cost: 350, color: '#f43f5e', dmg: 30, cooldown: 2.4,  range: 200, beam: true },
  { id: 'maestro', emoji: '🎶', name: 'Maestro',    cost: 280, color: '#e879f9', shoot: false, range: 95, aura: { range: 95, dmgMul: 1.5, fireMul: 1.2 } },

  // ---- Tier 4: elite ----
  { id: 'trident', emoji: '🔱', name: 'Trident',    cost: 450, color: '#2dd4bf', dmg: 10, cooldown: 0.6,  range: 110, beam: true, chain: 3, chainRange: 90 },
  { id: 'meteor',  emoji: '☄️', name: 'Meteor',     cost: 500, color: '#fdba74', dmg: 40, cooldown: 2.8,  range: 130, splash: 70 },
  { id: 'dragon',  emoji: '🐉', name: 'Dragon',     cost: 600, color: '#4ade80', dmg: 8,  cooldown: 0.4,  range: 120, dotDps: 20, dotTime: 2, splash: 40 },
  { id: 'overseer',emoji: '👁️', name: 'Overseer',   cost: 550, color: '#f472b6', shoot: false, range: 120, aura: { range: 120, dmgMul: 1.8, fireMul: 1.4 } },
  { id: 'doomsday',emoji: '🏆', name: 'Doomsday',   cost: 1000, color: '#fafafa', dmg: 80, cooldown: 3.0, range: 220, beam: true, splash: 80 },
]
const towerById = (id) => TOWERS.find((t) => t.id === id)
const previewRange = (t) => t.range || (t.aura ? t.aura.range : 0)

const START_MONEY = 200
const START_LIVES = 20
const SPAWN_GAP = 0.6

// Difficulty is a STEADY CLIMB: every value grows smoothly with the wave number
// (no sudden exponential spikes), but the slopes are steep enough that late waves
// get genuinely brutal. Tune the numbers below to re-balance the whole game.
function makeWave(wave) {
  const list = []
  const n = 5 + Math.floor(wave * 2.5)        // more enemies each wave
  const hp = 3 + wave * 3                      // tankier each wave (steeper than before)
  const speed = Math.min(100, 30 + wave * 2.5) // a bit faster, capped so it stays fair
  const reward = 5 + Math.floor(wave / 2)      // kill payout barely grows = money stays tight
  for (let i = 0; i < n; i++) {
    list.push({ hp, speed, reward, r: 11, color: '#a855f7', boss: false })
  }
  if (wave % 5 === 0) {
    // boss every 5th wave — scales with the wave so it's always a real threat
    list.push({ hp: hp * 12, speed: speed * 0.6, reward: reward * 8, r: 18, color: '#f97316', boss: true })
  }
  return list
}

function freshWorld() {
  return {
    money: START_MONEY,
    lives: START_LIVES,
    wave: 0,
    wavesCleared: 0,
    waveActive: false,
    queue: [],
    spawnTimer: 0,
    enemies: [],
    towers: [],
    bullets: [],
    beams: [],     // short-lived laser/lightning lines to draw
    nextId: 1,
    dead: false,
  }
}

// ---- shared damage helpers (used by bullets AND beams) ----
function knockback(e, px) {
  const t = WAYPOINTS[e.wp] || BASE
  const dx = e.x - t.x, dy = e.y - t.y
  const d = Math.hypot(dx, dy) || 1
  e.x += (dx / d) * px
  e.y += (dy / d) * px
}
function applyHit(e, eff) {
  if (eff.dmg) e.hp -= eff.dmg
  if (eff.slowMul) { e.slowT = eff.slowTime; e.slowMul = eff.slowMul }
  if (eff.dotDps) { e.dotDps = eff.dotDps; e.dotT = eff.dotTime }
  if (eff.stun) e.stunT = Math.max(e.stunT || 0, eff.stun)
  if (eff.knock) knockback(e, eff.knock)
}
function splashHit(w, eff, x, y, exclude) {
  for (const e of w.enemies) {
    if (e === exclude || e.hp <= 0) continue
    if ((e.x - x) ** 2 + (e.y - y) ** 2 <= eff.splash * eff.splash) applyHit(e, eff)
  }
}
// build the "what this hit does" packet from a tower (dmg already buffed by auras)
function effectOf(t, dmg) {
  return {
    dmg,
    splash: t.splash || 0,
    slowMul: t.slowMul || 0, slowTime: t.slowTime || 1.3,
    dotDps: t.dotDps || 0, dotTime: t.dotTime || 2,
    stun: t.stun || 0, knock: t.knock || 0,
  }
}

function SmudgeDefense({ onBack }) {
  const [phase, setPhase] = useState('ready')
  const [score, setScore] = useState(0)
  const [hud, setHud] = useState({ money: START_MONEY, lives: START_LIVES, wave: 0, waveActive: false })
  const [selected, setSelected] = useState(null)
  const [held, setHeld] = useState(null) // a tower you picked up to move/sell
  const world = useRef(freshWorld())
  const canvasRef = useRef(null)
  const lastRef = useRef(0)
  const selectedRef = useRef(null)
  const heldRef = useRef(null)
  const hoverRef = useRef(null)
  const hudRef = useRef(null)   // last HUD values pushed to React — so we only re-render on a real change

  useEffect(() => { selectedRef.current = selected }, [selected])
  useEffect(() => { heldRef.current = held }, [held])

  // effective stats of a tower after nearby aura towers buff it
  function towerEff(w, tw) {
    let dmgMul = 1, fireMul = 1
    for (const a of w.towers) {
      if (a === tw || !a.aura) continue
      const ar = a.aura.range
      if ((a.x - tw.x) ** 2 + (a.y - tw.y) ** 2 <= ar * ar) {
        dmgMul *= a.aura.dmgMul || 1
        fireMul *= a.aura.fireMul || 1
      }
    }
    return { dmg: tw.dmg * dmgMul, cooldown: Math.max(0.05, tw.cooldown / fireMul), range: tw.range }
  }

  useEffect(() => {
    if (phase !== 'playing') return
    let raf
    lastRef.current = performance.now()
    const ctx = canvasRef.current.getContext('2d')

    function frame(now) {
      const w = world.current
      const dt = Math.min((now - lastRef.current) / 1000, 0.05)
      lastRef.current = now

      // spawn enemies
      if (w.waveActive) {
        w.spawnTimer -= dt
        if (w.spawnTimer <= 0 && w.queue.length) {
          const t = w.queue.shift()
          const p = WAYPOINTS[0]
          w.enemies.push({
            id: w.nextId++, x: p.x, y: p.y, wp: 1,
            hp: t.hp, maxHp: t.hp, speed: t.speed, reward: t.reward,
            r: t.r, color: t.color, boss: t.boss,
            slowT: 0, slowMul: 0.5, dotT: 0, dotDps: 0, stunT: 0,
          })
          w.spawnTimer = SPAWN_GAP
        }
      }

      // move enemies + tick status effects
      for (const e of w.enemies) {
        if (e.dotT > 0) { e.dotT -= dt; e.hp -= e.dotDps * dt }
        if (e.stunT > 0) { e.stunT -= dt; continue } // stunned = frozen in place
        let mul = 1
        if (e.slowT > 0) { e.slowT -= dt; mul = e.slowMul }
        const spd = e.speed * mul
        const target = WAYPOINTS[e.wp]
        const dx = target.x - e.x, dy = target.y - e.y
        const d = Math.hypot(dx, dy) || 1
        const step = spd * dt
        if (step >= d) {
          e.x = target.x; e.y = target.y; e.wp += 1
          if (e.wp >= WAYPOINTS.length) e.reached = true
        } else {
          e.x += (dx / d) * step
          e.y += (dy / d) * step
        }
      }
      const arrived = w.enemies.filter((e) => e.reached)
      if (arrived.length) {
        w.lives -= arrived.length
        w.enemies = w.enemies.filter((e) => !e.reached)
      }

      // towers fire
      for (const tw of w.towers) {
        if (tw.shoot === false) continue
        tw.cdLeft -= dt
        if (tw.cdLeft > 0) continue
        const eff0 = towerEff(w, tw)
        // target the enemy furthest along the road that's in range
        let pick = null
        for (const e of w.enemies) {
          if (e.hp <= 0) continue
          if ((e.x - tw.x) ** 2 + (e.y - tw.y) ** 2 > eff0.range ** 2) continue
          if (!pick || e.wp > pick.wp) pick = e
        }
        if (!pick) continue
        const eff = effectOf(tw, eff0.dmg)

        if (tw.beam) {
          // instant laser/lightning
          applyHit(pick, eff)
          if (eff.splash) splashHit(w, eff, pick.x, pick.y, pick)
          w.beams.push({ x1: tw.x, y1: tw.y, x2: pick.x, y2: pick.y, color: tw.color, ttl: 0.09 })
          if (tw.chain) {
            let last = pick
            const hit = new Set([pick.id])
            for (let k = 0; k < tw.chain; k++) {
              let next = null, best = (tw.chainRange || 80) ** 2
              for (const e of w.enemies) {
                if (e.hp <= 0 || hit.has(e.id)) continue
                const dd = (e.x - last.x) ** 2 + (e.y - last.y) ** 2
                if (dd <= best) { best = dd; next = e }
              }
              if (!next) break
              applyHit(next, eff)
              w.beams.push({ x1: last.x, y1: last.y, x2: next.x, y2: next.y, color: tw.color, ttl: 0.09 })
              hit.add(next.id); last = next
            }
          }
        } else {
          // a homing bullet that carries the effect
          w.bullets.push({ x: tw.x, y: tw.y, targetId: pick.id, speed: 320, eff, color: tw.color })
        }
        tw.cdLeft = eff0.cooldown
      }

      // move bullets, apply on contact
      for (const b of w.bullets) {
        const e = w.enemies.find((en) => en.id === b.targetId && en.hp > 0)
        if (!e) { b.dead = true; continue }
        const dx = e.x - b.x, dy = e.y - b.y
        const d = Math.hypot(dx, dy) || 1
        const step = b.speed * dt
        if (step >= d - e.r) {
          applyHit(e, b.eff)
          if (b.eff.splash) splashHit(w, b.eff, e.x, e.y, e)
          b.dead = true
        } else {
          b.x += (dx / d) * step
          b.y += (dy / d) * step
        }
      }
      w.bullets = w.bullets.filter((b) => !b.dead)

      // fade beams
      for (const bm of w.beams) bm.ttl -= dt
      w.beams = w.beams.filter((bm) => bm.ttl > 0)

      // pay out kills
      const alive = []
      for (const e of w.enemies) {
        if (e.hp <= 0) w.money += e.reward
        else alive.push(e)
      }
      w.enemies = alive

      // wave cleared?
      if (w.waveActive && w.queue.length === 0 && w.enemies.length === 0) {
        w.waveActive = false
        w.wavesCleared = w.wave
        w.money += 15 + w.wave * 3
      }

      if (w.lives <= 0) {
        setScore(w.wavesCleared)
        setPhase('done')
        return
      }

      draw(ctx, w)
      // only re-render React when a HUD number actually changed (not 60×/sec).
      // This was making dev mode re-build the whole 27-tower tray every frame.
      const h = { money: Math.floor(w.money), lives: w.lives, wave: w.wave, waveActive: w.waveActive }
      const p = hudRef.current
      if (!p || p.money !== h.money || p.lives !== h.lives || p.wave !== h.wave || p.waveActive !== h.waveActive) {
        hudRef.current = h
        setHud(h)
      }
      raf = requestAnimationFrame(safeFrame)
    }

    // wrap each frame so one bad frame can't silently freeze the canvas: it logs
    // the real error to the console AND keeps the loop alive (rAF runs outside
    // React, so ErrorBoundary can't catch a throw in here).
    const safeFrame = (now) => {
      try { frame(now) }
      catch (err) {
        console.error('SmudgeDefense frame error:', err)
        raf = requestAnimationFrame(safeFrame)
      }
    }

    raf = requestAnimationFrame(safeFrame)
    return () => cancelAnimationFrame(raf)
  }, [phase])

  function draw(ctx, w) {
    ctx.clearRect(0, 0, W, H)
    ctx.fillStyle = '#0a0e1a'
    ctx.fillRect(0, 0, W, H)

    // road
    ctx.strokeStyle = '#1b2540'
    ctx.lineWidth = 30
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(WAYPOINTS[0].x, WAYPOINTS[0].y)
    for (let i = 1; i < WAYPOINTS.length; i++) ctx.lineTo(WAYPOINTS[i].x, WAYPOINTS[i].y)
    ctx.stroke()

    // buildable dots
    ctx.fillStyle = 'rgba(34, 211, 238, 0.12)'
    for (let c = 0; c < COLS; c++) {
      for (let r = 0; r < ROWS; r++) {
        if (!isBuildable(c, r)) continue
        const p = center(c, r)
        ctx.beginPath(); ctx.arc(p.x, p.y, 2, 0, Math.PI * 2); ctx.fill()
      }
    }

    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    // base
    ctx.fillStyle = 'rgba(34, 211, 238, 0.35)'
    ctx.beginPath(); ctx.arc(BASE.x, BASE.y, 17, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = '#22d3ee'; ctx.lineWidth = 2
    ctx.beginPath(); ctx.arc(BASE.x, BASE.y, 17, 0, Math.PI * 2); ctx.stroke()
    ctx.font = '22px sans-serif'
    ctx.fillText('🏠', BASE.x, BASE.y)

    // beams (lasers / lightning) under towers
    for (const bm of w.beams) {
      ctx.strokeStyle = bm.color
      ctx.lineWidth = 2.5
      ctx.globalAlpha = Math.min(1, bm.ttl / 0.09)
      ctx.beginPath(); ctx.moveTo(bm.x1, bm.y1); ctx.lineTo(bm.x2, bm.y2); ctx.stroke()
      ctx.globalAlpha = 1
    }

    // towers on color-coded discs
    for (const tw of w.towers) {
      ctx.fillStyle = tw.color + '55'
      ctx.beginPath(); ctx.arc(tw.x, tw.y, 16, 0, Math.PI * 2); ctx.fill()
      ctx.strokeStyle = tw.color; ctx.lineWidth = 2
      ctx.beginPath(); ctx.arc(tw.x, tw.y, 16, 0, Math.PI * 2); ctx.stroke()
      ctx.font = '20px sans-serif'
      ctx.fillText(tw.emoji, tw.x, tw.y)
    }

    // ghost preview + range ring (for a tower being built OR moved)
    const ghost = heldRef.current || (selectedRef.current && towerById(selectedRef.current))
    const hov = hoverRef.current
    if (ghost && hov && isBuildable(hov.col, hov.row) &&
        !w.towers.some((t) => t.col === hov.col && t.row === hov.row)) {
      const t = ghost
      const p = center(hov.col, hov.row)
      const rng = previewRange(t)
      if (rng > 0) {
        ctx.strokeStyle = 'rgba(34, 211, 238, 0.5)'
        ctx.lineWidth = 1.5
        ctx.beginPath(); ctx.arc(p.x, p.y, rng, 0, Math.PI * 2); ctx.stroke()
      }
      ctx.globalAlpha = 0.5
      ctx.font = '24px sans-serif'
      ctx.fillText(t.emoji, p.x, p.y)
      ctx.globalAlpha = 1
    }

    // enemies + hp bars
    for (const e of w.enemies) {
      ctx.fillStyle = e.slowT > 0 ? '#7dd3fc' : e.color
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2); ctx.fill()
      // poison tint ring
      if (e.dotT > 0) {
        ctx.strokeStyle = '#84cc16'; ctx.lineWidth = 2
        ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 2, 0, Math.PI * 2); ctx.stroke()
      }
      const bw = e.r * 2
      ctx.fillStyle = '#3b0764'
      ctx.fillRect(e.x - e.r, e.y - e.r - 7, bw, 3)
      ctx.fillStyle = '#22d3ee'
      ctx.fillRect(e.x - e.r, e.y - e.r - 7, bw * Math.max(0, e.hp / e.maxHp), 3)
    }

    // bullets
    for (const b of w.bullets) {
      ctx.fillStyle = b.color
      ctx.beginPath(); ctx.arc(b.x, b.y, 4, 0, Math.PI * 2); ctx.fill()
    }
  }

  function cellFromEvent(e) {
    const rect = canvasRef.current.getBoundingClientRect()
    const cx = ((e.clientX - rect.left) / rect.width) * W
    const cy = ((e.clientY - rect.top) / rect.height) * H
    return { col: Math.floor(cx / TILE), row: Math.floor(cy / TILE) }
  }
  function onCanvasClick(e) {
    const w = world.current
    const { col, row } = cellFromEvent(e)
    const occupied = w.towers.find((t) => t.col === col && t.row === row)

    // 1) holding a tower we picked up → drop it on an empty buildable spot (free move)
    if (heldRef.current) {
      if (!isBuildable(col, row) || occupied) return
      const p = center(col, row)
      w.towers.push({ ...heldRef.current, col, row, x: p.x, y: p.y, cdLeft: 0 })
      setHeld(null)
      return
    }

    // 2) a tower type is selected from the tray → build a NEW one (costs money)
    if (selectedRef.current) {
      if (!isBuildable(col, row) || occupied) return
      const t = towerById(selectedRef.current)
      if (w.money < t.cost) return
      w.money -= t.cost
      const p = center(col, row)
      w.towers.push({ ...t, col, row, x: p.x, y: p.y, cdLeft: 0 })
      return
    }

    // 3) nothing selected, tapped an existing tower → pick it up to move/sell it
    if (occupied) {
      w.towers = w.towers.filter((t) => t !== occupied)
      setHeld(occupied)
    }
  }

  // sell the tower you're holding for 75% of its price
  function sellHeld() {
    const w = world.current
    const h = heldRef.current
    if (!h) return
    w.money += Math.floor(h.cost * 0.75)
    setHeld(null)
  }
  function onCanvasMove(e) { hoverRef.current = cellFromEvent(e) }
  function onCanvasLeave() { hoverRef.current = null }

  function start() {
    world.current = freshWorld()
    setSelected(null)
    setHeld(null)
    setScore(0)
    hudRef.current = null
    setHud({ money: START_MONEY, lives: START_LIVES, wave: 0, waveActive: false })
    setPhase('playing')
  }
  function startWave() {
    const w = world.current
    if (w.waveActive) return
    w.wave += 1
    w.queue = makeWave(w.wave)
    w.spawnTimer = 0
    w.waveActive = true
  }
  function reset() {
    world.current = freshWorld()
    setSelected(null)
    setHeld(null)
    setScore(0)
    setPhase('ready')
  }

  return (
    <section id="center">
      <button className="back-btn" onClick={onBack}>← Menu</button>
      <h1>🏰 Smudge Defense</h1>

      {phase === 'ready' && (
        <>
          <p>Stop the swarm from reaching your 🏠! Build towers along the road,
            then start the wave. Enemies that get through cost a life.</p>
          <p className="split-keys">
            Pick a tower, tap an empty spot to build, then hit <b>Start Wave</b>.
            30 towers — scroll the tray to see them all! Tap a placed tower
            (with nothing selected) to <b>move</b> or <b>sell</b> it.
          </p>
          <button className="play-btn" onClick={start}>START</button>
        </>
      )}

      {phase === 'playing' && (
        <>
          <div className="def-bar">
            <span className="split-stat">💰 {hud.money}</span>
            <span className="split-stat">❤️ {hud.lives}</span>
            <span className="split-stat">🌊 {hud.wave}</span>
            {!hud.waveActive ? (
              <button className="def-wavebtn" onClick={startWave}>
                ▶️ Start Wave {hud.wave + 1}
              </button>
            ) : (
              <span className="def-incoming">Wave {hud.wave}… 🌊</span>
            )}
          </div>

          {held && (
            <div className="def-bar">
              <span className="def-incoming">
                Moving {held.emoji} {held.name} — tap an empty spot
              </span>
              <button className="def-wavebtn" onClick={sellHeld}>
                ✖️ Sell for 💰{Math.floor(held.cost * 0.75)}
              </button>
            </div>
          )}

          <div className="def-stage">
            <canvas
              ref={canvasRef}
              width={W}
              height={H}
              className="def-canvas"
              onPointerDown={onCanvasClick}
              onPointerMove={onCanvasMove}
              onPointerLeave={onCanvasLeave}
            />

            {/* tower tray — beside the board on wide screens, below on phones */}
            <div className="def-pick">
            {[...TOWERS].sort((a, b) => a.cost - b.cost).map((t) => {
              const on = selected === t.id
              const broke = hud.money < t.cost
              return (
                <button
                  key={t.id}
                  className={`def-tower ${on ? 'on' : ''} ${broke ? 'broke' : ''}`}
                  onClick={() => { setHeld(null); setSelected(on ? null : t.id) }}
                  title={t.name}
                >
                  <span className="def-tower-emoji">{t.emoji}</span>
                  <span className="def-tower-name">{t.name}</span>
                  <span className="def-tower-cost">💰{t.cost}</span>
                </button>
              )
            })}
            </div>
          </div>
        </>
      )}

      {phase === 'done' && (
        <>
          <h2 className="split-result">Your base fell!</h2>
          <p className="split-stat">You cleared {score} wave{score === 1 ? '' : 's'} 🌊</p>
          <ScoreSaver game="defense" score={score} />
          <button className="play-btn" onClick={reset}>Try again</button>
        </>
      )}
    </section>
  )
}

export default SmudgeDefense
