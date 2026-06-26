import { useState, useRef, useEffect } from 'react'
import ScoreSaver from './ScoreSaver'
import DefenseCoop from './DefenseCoop'
import { supabase } from './supabase'
import { useAuth } from './auth'

// A short, easy-to-read room code (no confusing 0/O or 1/I).
const COOP_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
function makeCode() {
  let s = ''
  for (let i = 0; i < 4; i++) s += COOP_ALPHABET[Math.floor(Math.random() * COOP_ALPHABET.length)]
  return s
}
// How often the HOST streams the game picture to the GUEST (seconds).
const SNAP_EVERY = 1 / 15

// ============================================================
// SMUDGE DEFENSE — an original fixed-path tower defense game.
// Enemies march along a set road toward your base. Spend money
// to build towers; they auto-shoot. Survive endless waves
// (boss every 5th). Score = waves cleared.
//
// 30 towers, built from a small set of POWERS that mix + match:
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
  { id: 'magnet',  emoji: '🧲', name: 'Magnet',     cost: 190, color: '#60a5fa', dmg: 2,  cooldown: 1.0,  range: 90, knock: 26, slowMul: 0.5, slowTime: 1.5 },
  { id: 'cannon',  emoji: '💣', name: 'Cannon',     cost: 120, color: '#f59e0b', dmg: 6,  cooldown: 1.3,  range: 100, splash: 35 },
  { id: 'sniper',  emoji: '🎯', name: 'Sniper',     cost: 200, color: '#ef4444', dmg: 12, cooldown: 1.9,  range: 165, beam: true },
  { id: 'booster', emoji: '🎺', name: 'Booster',    cost: 130, color: '#f0abfc', shoot: false, range: 80, aura: { range: 80, dmgMul: 1.25, fireMul: 1.0 } },

  // ---- Tier 3: strong ----
  { id: 'gatling', emoji: '⚙️', name: 'Gatling',    cost: 300, color: '#94a3b8', dmg: 3,  cooldown: 0.15, range: 90 },
  { id: 'bomber',  emoji: '🧨', name: 'Bomber',     cost: 240, color: '#f97316', dmg: 10, cooldown: 1.5,  range: 90, splash: 55 },
  { id: 'scorpion',emoji: '🦂', name: 'Scorpion',   cost: 260, color: '#65a30d', dmg: 2,  cooldown: 0.7,  range: 95, dotDps: 12, dotTime: 3 },
  { id: 'rocket',  emoji: '🚀', name: 'Rocket',     cost: 260, color: '#fb7185', dmg: 14, cooldown: 1.8,  range: 120, splash: 45 },
  { id: 'storm',   emoji: '🌩️', name: 'Storm',      cost: 300, color: '#818cf8', dmg: 5,  cooldown: 0.9,  range: 100, beam: true, chain: 5, chainRange: 85 },
  { id: 'gravity', emoji: '🪐', name: 'Gravity',    cost: 320, color: '#c084fc', dmg: 2,  cooldown: 1.0,  range: 100, slowMul: 0.25, slowTime: 2.5, pulse: true },
  { id: 'prism',   emoji: '🌟', name: 'Prism',      cost: 340, color: '#5eead4', dmg: 6,  cooldown: 0.8,  range: 110, beam: true, chain: 4, chainRange: 80, slowMul: 0.6, slowTime: 1.2 },
  { id: 'plague',  emoji: '🦠', name: 'Plague',     cost: 360, color: '#a3e635', dmg: 2,  cooldown: 1.1,  range: 95, dotDps: 16, dotTime: 4, splash: 45 },
  { id: 'railgun', emoji: '🛰️', name: 'Railgun',    cost: 350, color: '#f43f5e', dmg: 30, cooldown: 2.4,  range: 200, beam: true },
  { id: 'maestro', emoji: '🎶', name: 'Maestro',    cost: 280, color: '#e879f9', shoot: false, range: 95, aura: { range: 95, dmgMul: 1.5, fireMul: 1.2 } },

  // ---- Tier 4: elite ----
  { id: 'trident', emoji: '🔱', name: 'Trident',    cost: 450, color: '#2dd4bf', dmg: 10, cooldown: 0.6,  range: 110, beam: true, chain: 3, chainRange: 90 },
  { id: 'meteor',  emoji: '☄️', name: 'Meteor',     cost: 500, color: '#fdba74', dmg: 40, cooldown: 2.8,  range: 130, splash: 70 },
  { id: 'dragon',  emoji: '🐉', name: 'Dragon',     cost: 600, color: '#4ade80', dmg: 8,  cooldown: 0.4,  range: 120, dotDps: 20, dotTime: 2, splash: 40 },
  { id: 'overseer',emoji: '👁️', name: 'Overseer',   cost: 550, color: '#f472b6', shoot: false, range: 120, aura: { range: 120, dmgMul: 1.8, fireMul: 1.4 } },
  { id: 'doomsday',emoji: '🏆', name: 'Doomsday',   cost: 1000, color: '#fafafa', dmg: 40, cooldown: 3.0, range: 220, beam: true, splash: 80 },
]
const towerById = (id) => TOWERS.find((t) => t.id === id)
const previewRange = (t) => t.range || (t.aura ? t.aura.range : 0)

// Build a plain-English description of a tower from its powers, so the info
// panel is always accurate (and new towers describe themselves for free).
function describe(t) {
  if (t.shoot === false && t.aura) {
    const dmg = Math.round((t.aura.dmgMul - 1) * 100)
    const fire = Math.round((t.aura.fireMul - 1) * 100)
    return `Support — doesn't shoot. Buffs towers within ${t.aura.range}px: +${dmg}% damage` +
      (fire > 0 ? `, +${fire}% fire rate.` : '.')
  }
  const head = t.dmg ? `${t.dmg} damage` : 'No direct damage'
  const fx = []
  if (t.beam) fx.push('hits instantly (beam)')
  if (t.chain) fx.push(`chains to ${t.chain} more`)
  if (t.splash) fx.push(`splash ${t.splash}px`)
  if (t.slowMul) fx.push(`slows to ${Math.round(t.slowMul * 100)}% for ${t.slowTime}s`)
  if (t.dotDps) fx.push(`poison ${t.dotDps}/s for ${t.dotTime}s`)
  if (t.stun) fx.push(`stuns ${t.stun}s`)
  if (t.knock) fx.push('knocks enemies back')
  if (t.pulse) fx.push('pulses — hits EVERY enemy in range')
  let s = `${head} every ${t.cooldown}s · ${t.range}px range.`
  if (fx.length) s += ` ${fx.join(', ')}.`
  return s
}

const START_MONEY = 200
const START_LIVES = 20
const SPAWN_GAP = 0.6

// Hardcore mode: same towers, brutal odds (set on the START screen).
const HARD_START_MONEY = 200
const HARD_LIVES = 7

// Coin payout PREVIEW for the Cash Out button. Mirrors the database
// (coin_rates.defense rate = 8, and award_coins caps each play at 1500).
// The server is still the real source of truth — this is just the on-screen estimate.
const COIN_RATE = 8         // normal Defense: Smudge's per wave (mirrors coin_rates.defense)
const HARD_COIN_RATE = 500  // hardcore Defense: ~62× the normal rate (mirrors coin_rates.defense_hard)
// Tower Defense has NO payout cap (coin_rates.cap is NULL for defense/defense_hard),
// so long runs keep earning. Other games still cap at 1500 server-side.
const coinsFor = (wavesCleared, hardcore = false) =>
  Math.max(0, wavesCleared) * (hardcore ? HARD_COIN_RATE : COIN_RATE)

// Difficulty is a STEADY CLIMB: every value grows smoothly with the wave number
// (no sudden exponential spikes), but the slopes are steep enough that late waves
// get genuinely brutal. Tune the numbers below to re-balance the whole game.
function makeWave(wave, hardcore = false) {
  const list = []
  let n = 5 + Math.floor(wave * 2.5)          // more enemies each wave
  let hp = 3 + wave * 3                        // tankier each wave (steeper than before)
  let speed = Math.min(100, 30 + wave * 2.5)  // a bit faster, capped so it stays fair
  const reward = 5 + Math.floor(wave / 2)      // kill payout barely grows = money stays tight
  if (hardcore) {                              // BRUTAL odds: way more, way tankier, faster enemies
    n = Math.round(n * 2.0)
    hp = Math.round(hp * 2.6)
    speed = Math.min(140, speed * 1.3)
  }
  for (let i = 0; i < n; i++) {
    list.push({ hp, speed, reward, r: 11, color: '#a855f7', boss: false })
  }
  if (wave % 5 === 0) {
    // boss every 5th wave — scales with the wave so it's always a real threat
    list.push({ hp: hp * (hardcore ? 14 : 12), speed: speed * 0.6, reward: reward * 8, r: 18, color: '#f97316', boss: true })
  }
  return list
}

function freshWorld(hardcore = false) {
  return {
    money: hardcore ? HARD_START_MONEY : START_MONEY,
    lives: hardcore ? HARD_LIVES : START_LIVES,
    hardcore,
    wave: 0,
    wavesCleared: 0,
    waveActive: false,
    queue: [],
    spawnTimer: 0,
    enemies: [],
    towers: [],
    bullets: [],
    beams: [],     // short-lived laser/lightning lines to draw
    fx: [],        // short-lived flashes/rings (muzzle, impacts, splash shockwaves)
    nextId: 1,
    dead: false,
  }
}

// ---- shared damage helpers (used by bullets AND beams) ----
function knockback(e, px) {
  // Shove the enemy BACK toward the corner they came from (the previous
  // waypoint), so they slide along the road instead of flying off the map at
  // bends. Clamp the push so they can't get shoved past that corner.
  const prev = WAYPOINTS[e.wp - 1] || WAYPOINTS[0]
  const dx = prev.x - e.x, dy = prev.y - e.y
  const d = Math.hypot(dx, dy) || 1
  const move = Math.min(px, d)
  e.x += (dx / d) * move
  e.y += (dy / d) * move
}
function applyHit(e, eff, owner) {
  if (owner != null) e.lastOwner = owner // co-op: remember who to pay for the kill
  if (eff.dmg) e.hp -= eff.dmg
  if (eff.slowMul) { e.slowT = eff.slowTime; e.slowMul = eff.slowMul }
  if (eff.dotDps) { e.dotDps = eff.dotDps; e.dotT = eff.dotTime }
  if (eff.stun) e.stunT = Math.max(e.stunT || 0, eff.stun)
  if (eff.knock) knockback(e, eff.knock)
}
function splashHit(w, eff, x, y, exclude, owner) {
  for (const e of w.enemies) {
    if (e === exclude || e.hp <= 0) continue
    if ((e.x - x) ** 2 + (e.y - y) ** 2 <= eff.splash * eff.splash) applyHit(e, eff, owner)
  }
}
// ---- visual effects (pure eye-candy: pushed into w.fx, drawn + faded each frame) ----
// a bright flash at the tower barrel when it fires
function addMuzzle(w, tw) {
  w.fx.push({ x: tw.x, y: tw.y, r0: 13, r1: 5, ttl: 0.16, max: 0.16, color: tw.color, fill: true })
}
// a spark ring where a shot lands; if splashR is set, also a big shockwave ring
function addImpact(w, x, y, color, splashR) {
  w.fx.push({ x, y, r0: 2, r1: 13, ttl: 0.2, max: 0.2, color, fill: false })
  if (splashR) w.fx.push({ x, y, r0: 6, r1: splashR, ttl: 0.3, max: 0.3, color, fill: false })
}
// a jagged, flickering lightning bolt with a glow + bright white core (chain towers)
function drawBolt(ctx, bm) {
  const segs = 6
  const dx = bm.x2 - bm.x1, dy = bm.y2 - bm.y1
  const len = Math.hypot(dx, dy) || 1
  const nx = -dy / len, ny = dx / len     // perpendicular, for the zig-zag
  const pts = [[bm.x1, bm.y1]]
  for (let i = 1; i < segs; i++) {
    const t = i / segs
    const j = (Math.random() - 0.5) * 14   // random kink each frame = electric flicker
    pts.push([bm.x1 + dx * t + nx * j, bm.y1 + dy * t + ny * j])
  }
  pts.push([bm.x2, bm.y2])
  const trace = () => {
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1])
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1])
    ctx.stroke()
  }
  ctx.strokeStyle = bm.color; ctx.shadowColor = bm.color; ctx.shadowBlur = 10; ctx.lineWidth = 4
  trace()
  ctx.strokeStyle = '#ffffff'; ctx.shadowBlur = 0; ctx.lineWidth = 1.5
  trace()
}
// a straight glowing beam: thick for "heavy" towers, thin for plain lasers
function drawBeamLine(ctx, bm) {
  const heavy = bm.style === 'heavy'
  ctx.strokeStyle = bm.color; ctx.shadowColor = bm.color; ctx.shadowBlur = heavy ? 14 : 8
  ctx.lineWidth = heavy ? 6 : 3
  ctx.beginPath(); ctx.moveTo(bm.x1, bm.y1); ctx.lineTo(bm.x2, bm.y2); ctx.stroke()
  ctx.strokeStyle = '#ffffff'; ctx.shadowBlur = 0; ctx.lineWidth = heavy ? 2 : 1
  ctx.beginPath(); ctx.moveTo(bm.x1, bm.y1); ctx.lineTo(bm.x2, bm.y2); ctx.stroke()
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
  const [coop, setCoop] = useState(false) // true = we're in the 2-player co-op flow
  // ---- co-op identity + lobby state ----
  const { username } = useAuth()
  const myName = username || 'Player'
  // A unique id PER TAB (not per account), so two windows — even on the SAME
  // login — count as two separate players. Presence, tower ownership, and
  // wallets all key off this id.
  const clientIdRef = useRef(null)
  if (!clientIdRef.current) clientIdRef.current = Math.random().toString(36).slice(2, 10)
  const myId = clientIdRef.current
  const [coopScreen, setCoopScreen] = useState('menu') // 'menu' | 'lobby' | 'play'
  const [code, setCode] = useState('')
  const [joinInput, setJoinInput] = useState('')
  const [coopRole, setCoopRole] = useState(null)       // 'host' | 'guest'
  const [members, setMembers] = useState([])           // [{ id, name }]
  const [messages, setMessages] = useState([])         // chat log
  const [draft, setDraft] = useState('')
  const [netStatus, setNetStatus] = useState('connecting')
  const chanRef = useRef(null)        // the Supabase realtime channel
  const snapRef = useRef(null)        // GUEST: latest game picture from the host
  const actionQ = useRef([])          // HOST: remote actions waiting to be applied
  const snapClock = useRef(0)         // HOST: time since we last sent a snapshot
  const roleRef = useRef(null)        // live copy of coopRole for the game loop
  useEffect(() => { roleRef.current = coopRole }, [coopRole])
  const [phase, setPhase] = useState('ready')
  const [score, setScore] = useState(0)
  const [hud, setHud] = useState({ money: START_MONEY, lives: START_LIVES, wave: 0, waveActive: false, wavesCleared: 0 })
  const [selected, setSelected] = useState(null)
  const [held, setHeld] = useState(null) // a tower you picked up to move/sell
  const [hardcore, setHardcore] = useState(false) // brutal difficulty, chosen on the START screen
  const [cashedOut, setCashedOut] = useState(false) // did the run end by Cash Out (vs base falling)?
  const [autoWave, setAutoWave] = useState(false) // auto-start the next wave when one clears
  const autoRef = useRef(false) // ref copy so the game loop reads the live value
  const world = useRef(freshWorld())
  const canvasRef = useRef(null)
  const lastRef = useRef(0)
  const selectedRef = useRef(null)
  const heldRef = useRef(null)
  const hoverRef = useRef(null)
  const hudRef = useRef(null)   // last HUD values pushed to React — so we only re-render on a real change

  useEffect(() => { selectedRef.current = selected }, [selected])
  useEffect(() => { heldRef.current = held }, [held])
  useEffect(() => { autoRef.current = autoWave }, [autoWave])

  // ---- money helpers: solo uses one pot (w.money); co-op uses per-player wallets ----
  const moneyOf = (w, id) => (w.coop ? (w.wallets[id] || 0) : w.money)
  const addMoney = (w, id, n) => {
    if (w.coop) w.wallets[id] = (w.wallets[id] || 0) + n
    else w.money += n
  }

  // push HUD numbers to React, but only when one actually changed (not 60×/sec).
  function pushHud(w) {
    const partnerId = w.coop ? (myId === w.hostId ? w.guestId : w.hostId) : null
    const h = {
      money: Math.floor(w.coop ? (w.wallets[myId] || 0) : w.money),
      money2: Math.floor(w.coop ? (w.wallets[partnerId] || 0) : 0),
      lives: w.lives, wave: w.wave, waveActive: w.waveActive, wavesCleared: w.wavesCleared,
    }
    const p = hudRef.current
    if (!p || p.money !== h.money || p.money2 !== h.money2 || p.lives !== h.lives ||
        p.wave !== h.wave || p.waveActive !== h.waveActive || p.wavesCleared !== h.wavesCleared) {
      hudRef.current = h
      setHud(h)
    }
  }

  // ======== CO-OP: realtime channel (chat + presence + game stream) ========
  useEffect(() => {
    if (!coop || !code) return

    const channel = supabase.channel(`def-coop-${code}`, {
      config: { broadcast: { self: false }, presence: { key: myId } },
    })
    // chat
    channel.on('broadcast', { event: 'chat' }, ({ payload }) => {
      setMessages((m) => [...m, { name: payload.name, text: payload.text, mine: false }])
    })
    // GUEST: a fresh game picture from the host
    channel.on('broadcast', { event: 'snap' }, ({ payload }) => { snapRef.current = payload })
    // HOST: a click/action from the guest — queue it for the next frame
    channel.on('broadcast', { event: 'act' }, ({ payload }) => { actionQ.current.push(payload) })
    // GUEST: the host pressed START
    channel.on('broadcast', { event: 'start' }, ({ payload }) => { startCoopWorld(payload, 'guest') })
    // the game ended (host fell or cashed out)
    channel.on('broadcast', { event: 'over' }, ({ payload }) => {
      setScore(payload.waves); setCashedOut(!!payload.cashedOut); setPhase('done')
    })
    // who's in the room?
    channel.on('presence', { event: 'sync' }, () => {
      const st = channel.presenceState()
      const seen = new Map()
      Object.values(st).flat().forEach((p) => seen.set(p.id, { id: p.id, name: p.name }))
      setMembers([...seen.values()])
    })

    channel.subscribe(async (s) => {
      if (s === 'SUBSCRIBED') {
        setNetStatus('live')
        await channel.track({ id: myId, name: myName, role: roleRef.current })
      } else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') {
        setNetStatus('error')
      }
    })
    chanRef.current = channel
    return () => { supabase.removeChannel(channel); chanRef.current = null }
  }, [coop, code, myId, myName])

  // set up the shared world for a co-op battle (both host + guest call this)
  function startCoopWorld(payload, role) {
    const w = freshWorld(payload.hardcore)
    w.coop = true
    w.hostId = payload.hostId
    w.guestId = payload.guestId
    const start = payload.hardcore ? HARD_START_MONEY : START_MONEY
    w.wallets = {}
    payload.ids.forEach((id) => { w.wallets[id] = start })
    world.current = w
    snapRef.current = null
    actionQ.current = []
    snapClock.current = 0
    setCoopRole(role); roleRef.current = role
    setHardcore(payload.hardcore)
    setSelected(null); setHeld(null); setScore(0); setCashedOut(false)
    setAutoWave(false); autoRef.current = false
    hudRef.current = null
    setHud({ money: w.wallets[myId] || 0, money2: 0, lives: w.lives, wave: 0, waveActive: false, wavesCleared: 0 })
    setCoopScreen('play')
    setPhase('playing')
  }

  // HOST presses START: figure out the guest, tell everyone, start the battle.
  function startCoopBattle() {
    const other = members.find((m) => m.id !== myId)
    if (!other) return
    const payload = { hardcore, hostId: myId, guestId: other.id, ids: [myId, other.id] }
    chanRef.current?.send({ type: 'broadcast', event: 'start', payload })
    startCoopWorld(payload, 'host')
  }

  // send a chat message
  function sendChat() {
    const text = draft.trim()
    if (!text || !chanRef.current) return
    chanRef.current.send({ type: 'broadcast', event: 'chat', payload: { name: myName, text } })
    setMessages((m) => [...m, { name: myName, text, mine: true }])
    setDraft('')
  }

  // lobby buttons
  const resetLobby = () => { setNetStatus('connecting'); setMessages([]); setMembers([]) }
  const createRoom = () => { resetLobby(); setCode(makeCode()); setCoopRole('host'); roleRef.current = 'host'; setCoopScreen('lobby') }
  const joinRoom = () => {
    const c = joinInput.trim().toUpperCase()
    if (c.length === 4) { resetLobby(); setCode(c); setCoopRole('guest'); roleRef.current = 'guest'; setCoopScreen('lobby') }
  }
  const leaveCoop = () => {
    setCoop(false); setCoopScreen('menu'); setCode(''); setJoinInput('')
    setCoopRole(null); roleRef.current = null
    setPhase('ready')
  }

  // a co-op action: HOST applies it right away; GUEST sends it to the host.
  function coopAction(act) {
    if (roleRef.current === 'host') applyAction(world.current, act)
    else chanRef.current?.send({ type: 'broadcast', event: 'act', payload: act })
  }
  // HOST only: actually change the shared world for an action.
  function applyAction(w, act) {
    if (!w || !w.coop) { console.log('[COOP applyAction SKIP] no world/coop', !!w, w?.coop); return }
    // make sure whoever is acting has a wallet (covers any id timing hiccup)
    if (w.wallets[act.by] == null) w.wallets[act.by] = w.hardcore ? HARD_START_MONEY : START_MONEY
    if (act.kind === 'build') {
      const t = towerById(act.towerId)
      if (!t || !isBuildable(act.col, act.row)) return
      if (w.towers.some((x) => x.col === act.col && x.row === act.row)) return
      if (moneyOf(w, act.by) < t.cost) return
      addMoney(w, act.by, -t.cost)
      const p = center(act.col, act.row)
      w.towers.push({ ...t, col: act.col, row: act.row, x: p.x, y: p.y, cdLeft: 0, owner: act.by })
    } else if (act.kind === 'sell') {
      const tw = w.towers.find((x) => x.col === act.col && x.row === act.row && x.owner === act.by)
      if (!tw) return
      addMoney(w, act.by, Math.floor(tw.cost * 0.75))
      w.towers = w.towers.filter((x) => x !== tw)
    } else if (act.kind === 'startWave') {
      if (!w.waveActive) { w.wave += 1; w.queue = makeWave(w.wave, w.hardcore); w.spawnTimer = 0; w.waveActive = true }
    }
  }

  // build a compact "picture" of the world for the host to stream to the guest
  function makeSnap(w) {
    return {
      e: w.enemies.map((e) => ({ x: Math.round(e.x), y: Math.round(e.y), r: e.r, color: e.color, hp: e.hp, maxHp: e.maxHp, slowT: e.slowT, dotT: e.dotT })),
      t: w.towers.map((t) => ({ x: t.x, y: t.y, color: t.color, emoji: t.emoji, col: t.col, row: t.row, owner: t.owner })),
      b: w.bullets.map((b) => ({ x: Math.round(b.x), y: Math.round(b.y), px: b.px, py: b.py, color: b.color, r: b.r })),
      bm: w.beams.map((bm) => ({ x1: bm.x1, y1: bm.y1, x2: bm.x2, y2: bm.y2, color: bm.color, style: bm.style, ttl: bm.ttl })),
      fx: w.fx.map((f) => ({ x: f.x, y: f.y, r0: f.r0, r1: f.r1, ttl: f.ttl, max: f.max, color: f.color, fill: f.fill })),
      wallets: w.wallets, lives: w.lives, wave: w.wave, waveActive: w.waveActive, wavesCleared: w.wavesCleared,
    }
  }

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

      // GUEST: don't run the game — just draw the latest picture the host sent.
      if (w.coop && roleRef.current === 'guest') {
        const snap = snapRef.current
        if (snap) {
          w.enemies = snap.e; w.towers = snap.t; w.bullets = snap.b
          w.beams = snap.bm; w.fx = snap.fx
          w.wallets = snap.wallets; w.lives = snap.lives
          w.wave = snap.wave; w.waveActive = snap.waveActive; w.wavesCleared = snap.wavesCleared
          draw(ctx, w)
          pushHud(w)
        }
        raf = requestAnimationFrame(safeFrame)
        return
      }
      // HOST: fold in any clicks the guest sent before we simulate this frame.
      if (w.coop && roleRef.current === 'host') {
        while (actionQ.current.length) applyAction(w, actionQ.current.shift())
      }

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

        if (tw.pulse) {
          // gravity well: pull/slow EVERY enemy inside the tower's whole radius
          addMuzzle(w, tw)
          for (const e of w.enemies) {
            if (e.hp <= 0) continue
            if ((e.x - tw.x) ** 2 + (e.y - tw.y) ** 2 <= eff0.range ** 2) applyHit(e, eff, tw.owner)
          }
          // a big ring sweeping out to the full radius = the pulse you can see
          w.fx.push({ x: tw.x, y: tw.y, r0: 8, r1: eff0.range, ttl: 0.35, max: 0.35, color: tw.color, fill: false })
        } else if (tw.beam) {
          // instant laser/lightning — chain towers crackle, big hitters fire thick beams
          const style = tw.chain ? 'bolt' : (tw.splash || tw.dmg >= 12 ? 'heavy' : 'laser')
          addMuzzle(w, tw)
          applyHit(pick, eff, tw.owner)
          if (eff.splash) splashHit(w, eff, pick.x, pick.y, pick, tw.owner)
          w.beams.push({ x1: tw.x, y1: tw.y, x2: pick.x, y2: pick.y, color: tw.color, ttl: 0.12, style })
          addImpact(w, pick.x, pick.y, tw.color, eff.splash)
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
              applyHit(next, eff, tw.owner)
              w.beams.push({ x1: last.x, y1: last.y, x2: next.x, y2: next.y, color: tw.color, ttl: 0.12, style: 'bolt' })
              addImpact(w, next.x, next.y, tw.color, 0)
              hit.add(next.id); last = next
            }
          }
        } else {
          // a homing bullet that carries the effect (bigger if it explodes)
          addMuzzle(w, tw)
          w.bullets.push({ x: tw.x, y: tw.y, targetId: pick.id, speed: 320, eff, color: tw.color, r: eff.splash ? 6 : 4, owner: tw.owner })
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
          applyHit(e, b.eff, b.owner)
          if (b.eff.splash) splashHit(w, b.eff, e.x, e.y, e, b.owner)
          addImpact(w, e.x, e.y, b.color, b.eff.splash)
          b.dead = true
        } else {
          b.px = b.x; b.py = b.y          // remember last spot, for the trail
          b.x += (dx / d) * step
          b.y += (dy / d) * step
        }
      }
      w.bullets = w.bullets.filter((b) => !b.dead)

      // fade beams + effects
      for (const bm of w.beams) bm.ttl -= dt
      w.beams = w.beams.filter((bm) => bm.ttl > 0)
      for (const f of w.fx) f.ttl -= dt
      w.fx = w.fx.filter((f) => f.ttl > 0)

      // pay out kills
      const alive = []
      for (const e of w.enemies) {
        if (e.hp <= 0) {
          // co-op: pay the coins to whoever's tower landed the final hit
          if (w.coop) addMoney(w, e.lastOwner || w.hostId, e.reward)
          else w.money += e.reward
        } else alive.push(e)
      }
      w.enemies = alive

      // wave cleared?
      if (w.waveActive && w.queue.length === 0 && w.enemies.length === 0) {
        w.waveActive = false
        w.wavesCleared = w.wave
        const bonus = 15 + w.wave * 3
        if (w.coop) { for (const id in w.wallets) w.wallets[id] += bonus }
        else w.money += bonus
        if (autoRef.current) {
          // Auto mode: launch the next wave instantly (same as pressing Start Wave)
          w.wave += 1
          w.queue = makeWave(w.wave, w.hardcore)
          w.spawnTimer = 0
          w.waveActive = true
        }
      }

      if (w.lives <= 0) {
        if (w.coop && roleRef.current === 'host') {
          chanRef.current?.send({ type: 'broadcast', event: 'over', payload: { waves: w.wavesCleared, cashedOut: false } })
        }
        setScore(w.wavesCleared)
        setPhase('done')
        return
      }

      draw(ctx, w)
      pushHud(w)
      // HOST: stream the game picture to the guest ~15×/sec.
      if (w.coop && roleRef.current === 'host') {
        snapClock.current += dt
        if (snapClock.current >= SNAP_EVERY) {
          snapClock.current = 0
          chanRef.current?.send({ type: 'broadcast', event: 'snap', payload: makeSnap(w) })
        }
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

    // beams (lasers / lightning) under towers — style depends on the tower
    for (const bm of w.beams) {
      ctx.globalAlpha = Math.min(1, bm.ttl / 0.12)
      if (bm.style === 'bolt') drawBolt(ctx, bm)
      else drawBeamLine(ctx, bm)
    }
    ctx.globalAlpha = 1
    ctx.shadowBlur = 0

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

    // bullets — glowing projectiles with a short motion trail
    for (const b of w.bullets) {
      if (b.px != null) {
        ctx.strokeStyle = b.color; ctx.globalAlpha = 0.35; ctx.lineWidth = (b.r || 4) * 1.2
        ctx.beginPath(); ctx.moveTo(b.px, b.py); ctx.lineTo(b.x, b.y); ctx.stroke()
        ctx.globalAlpha = 1
      }
      ctx.fillStyle = b.color; ctx.shadowColor = b.color; ctx.shadowBlur = 8
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r || 4, 0, Math.PI * 2); ctx.fill()
    }
    ctx.shadowBlur = 0

    // flashes / impact rings / splash shockwaves (drawn on top of everything)
    for (const f of w.fx) {
      const k = f.ttl / f.max                     // 1 → 0 as it fades out
      const r = f.r0 + (f.r1 - f.r0) * (1 - k)
      ctx.globalAlpha = k
      ctx.beginPath(); ctx.arc(f.x, f.y, Math.max(0.5, r), 0, Math.PI * 2)
      if (f.fill) { ctx.fillStyle = f.color; ctx.fill() }
      else { ctx.strokeStyle = f.color; ctx.lineWidth = 2; ctx.stroke() }
    }
    ctx.globalAlpha = 1
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

    // CO-OP: no pick-up/move. Pick a tower type then tap empty = build.
    // Tap one of YOUR OWN towers (nothing selected) = sell it.
    if (w.coop) {
      if (selectedRef.current) {
        if (!isBuildable(col, row) || occupied) return
        coopAction({ kind: 'build', towerId: selectedRef.current, col, row, by: myId })
      } else if (occupied && occupied.owner === myId) {
        coopAction({ kind: 'sell', col, row, by: myId })
      }
      return
    }

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
    const w = freshWorld(hardcore)
    world.current = w
    setSelected(null)
    setHeld(null)
    setScore(0)
    setCashedOut(false)
    hudRef.current = null
    setHud({ money: w.money, lives: w.lives, wave: 0, waveActive: false, wavesCleared: 0 })
    setPhase('playing')
  }
  function startWave() {
    const w = world.current
    if (w.coop) { coopAction({ kind: 'startWave' }); return }
    if (w.waveActive) return
    w.wave += 1
    w.queue = makeWave(w.wave, w.hardcore)
    w.spawnTimer = 0
    w.waveActive = true
  }
  // end the run on your terms and bank the Smudge's you've earned so far
  function cashOut() {
    const w = world.current
    if (w.coop && roleRef.current === 'host') {
      chanRef.current?.send({ type: 'broadcast', event: 'over', payload: { waves: w.wavesCleared, cashedOut: true } })
    }
    setScore(w.wavesCleared)
    setCashedOut(true)
    setPhase('done')
  }
  function reset() {
    world.current = freshWorld(hardcore)
    setSelected(null)
    setHeld(null)
    setScore(0)
    setCashedOut(false)
    setPhase('ready')
  }

  const selTower = selected ? towerById(selected) : null

  // Co-op LOBBY takes over the whole screen until the battle starts.
  if (coop && coopScreen !== 'play') {
    return (
      <section id="center">
        <DefenseCoop
          screen={coopScreen}
          code={code}
          joinInput={joinInput}
          setJoinInput={setJoinInput}
          members={members}
          messages={messages}
          draft={draft}
          setDraft={setDraft}
          status={netStatus}
          role={coopRole}
          onCreate={createRoom}
          onJoin={joinRoom}
          onSend={sendChat}
          onStart={startCoopBattle}
          onLeave={leaveCoop}
          onBack={() => setCoop(false)}
        />
      </section>
    )
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
            (with nothing selected) to <b>move</b> or <b>sell</b> it. Tap a tower in
            the tray to see <b>what it does</b>.
          </p>
          <button
            className={`def-hardcore ${hardcore ? 'on' : ''}`}
            onClick={() => setHardcore((h) => !h)}
          >
            {hardcore ? '🔥 Hardcore: ON' : '💀 Hardcore: OFF'}
          </button>
          <p className="split-keys def-hard-note">
            Hardcore = <b>7 lives</b> (not 20) and a BRUTAL
            swarm — way more enemies, way tankier, faster — but you earn a huge{' '}
            <b>500 Smudge's</b> per wave (no cap!) and rank on the{' '}
            <b>🔥 Hardcore leaderboard</b>. 🤑
          </p>
          <button className="play-btn" onClick={start}>START</button>
          <button className="def-hardcore" onClick={() => setCoop(true)}>
            🤝 Co-op (2 player)
          </button>
        </>
      )}

      {phase === 'playing' && (
        <>
          <div className="def-bar">
            {hardcore && <span className="def-hard-badge">🔥 HARDCORE</span>}
            {coop && <span className="def-hard-badge">🤝 CO-OP</span>}
            <span className="split-stat">💰 {hud.money}</span>
            {coop && <span className="split-stat" title="your partner's wallet">👥 {hud.money2}</span>}
            <span className="split-stat">❤️ {hud.lives}</span>
            <span className="split-stat">🌊 {hud.wave}</span>
            {!hud.waveActive ? (
              <button className="def-wavebtn" onClick={startWave}>
                ▶️ Start Wave {hud.wave + 1}
              </button>
            ) : (
              <span className="def-incoming">Wave {hud.wave}… 🌊</span>
            )}
            {(!coop || coopRole === 'host') && (
              <>
                <button
                  className={`def-wavebtn ${autoWave ? 'def-auto-on' : ''}`}
                  onClick={() => setAutoWave((a) => !a)}
                  title="Auto-start the next wave the instant this one clears"
                >
                  ⏩ Auto: {autoWave ? 'ON' : 'OFF'}
                </button>
                <button
                  className="def-wavebtn def-cashout"
                  onClick={cashOut}
                  title="End the run now and bank the Smudge's you've earned"
                >
                  💰 Cash Out ({coinsFor(hud.wavesCleared, hardcore)})
                </button>
              </>
            )}
          </div>

          {selTower && (
            <div className="def-desc">
              <span className="def-desc-head">{selTower.emoji} {selTower.name} · 💰{selTower.cost}</span>
              <span className="def-desc-body">{describe(selTower)}</span>
            </div>
          )}

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

          {coop && (
            <>
              <div className="coop-chat coop-chat-mini">
                {messages.slice(-6).map((m, i) => (
                  <div key={i} className={`coop-msg ${m.mine ? 'mine' : ''}`}>
                    <b>{m.name}:</b> {m.text}
                  </div>
                ))}
              </div>
              <div className="coop-card">
                <input
                  className="coop-input"
                  placeholder="Chat with your partner…"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendChat()}
                />
                <button className="play-btn" onClick={sendChat}>Send</button>
              </div>
            </>
          )}
        </>
      )}

      {phase === 'done' && (
        <>
          <h2 className="split-result">{cashedOut ? '💰 Cashed out!' : 'Your base fell!'}</h2>
          <p className="split-stat">
            You cleared {score} wave{score === 1 ? '' : 's'} 🌊{hardcore ? ' · 🔥 Hardcore' : ''}
            {coop ? ' · 🤝 Co-op' : ''}
          </p>
          <ScoreSaver game={hardcore ? 'defense_hard' : 'defense'} score={score} />
          {coop ? (
            <button className="play-btn" onClick={() => { setCoopScreen('lobby'); setPhase('ready') }}>
              ← Back to lobby
            </button>
          ) : (
            <button className="play-btn" onClick={reset}>Try again</button>
          )}
        </>
      )}
    </section>
  )
}

export default SmudgeDefense
