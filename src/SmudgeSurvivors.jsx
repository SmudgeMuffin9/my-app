import { useState, useRef, useEffect } from 'react'
import ScoreSaver from './ScoreSaver'

// ============================================================
// SMUDGE SURVIVORS — an original top-down survival game.
// You're a glowing dot. Enemies chase you. You auto-shoot the
// nearest one. Survive, rack up kills, and every few kills you
// LEVEL UP and pick one of 3 upgrades to build your character.
// Score = total kills.
// ============================================================

// --- arena size (the canvas draws at this internal resolution) ---
const W = 360
const H = 460

// --- tuning knobs (change these to change the whole feel) ---
const PLAYER_R = 12          // player radius (px)
const PLAYER_SPEED = 150     // how fast you move (px/sec)
const START_HP = 5           // starting health
const BULLET_R = 4           // bullet radius
const BULLET_SPEED = 320     // bullet speed (px/sec)
const ENEMY_R = 13           // enemy radius
const ENEMY_START_SPEED = 50 // enemy speed at the start (px/sec)
const ENEMY_SPEED_RAMP = 5   // enemies get this much faster each second
const SPAWN_START = 1.1      // seconds between spawns at the start
const SPAWN_MIN = 0.18       // fastest spawn rate (seconds), late game
const INVULN = 0.8           // seconds you can't be hit again after a hit
const SURGE_EVERY = 16       // seconds between "wave surges" (a ring of enemies)
const FAN_SPREAD = 0.13      // angle between extra bullets (smaller = tighter cone)

// how tough a new enemy is — climbs forever with time, so any build eventually dies
function enemyHp(elapsed) {
  return 1 + Math.floor(elapsed / 10)
}

// XP needed to reach the NEXT level (level 1 -> 2 costs LEVEL_XP[0], etc.)
// Each kill = 1 XP. Later levels cost more.
function xpForLevel(level) {
  return 3 + level * 2 // lvl1->2 = 5, 2->3 = 7, 3->4 = 9 ...
}

// the pool of upgrades you can roll on level-up
const UPGRADES = [
  { id: 'firerate', icon: '🔥', name: 'Faster Shots', desc: 'Shoot 15% faster' },
  { id: 'damage',   icon: '💥', name: 'Bigger Bullets', desc: '+1 damage per hit' },
  { id: 'multi',    icon: '🔱', name: 'Extra Bullet', desc: 'Fire one more bullet' },
  { id: 'speed',    icon: '👟', name: 'Quick Feet', desc: 'Move 12% faster' },
  { id: 'maxhp',    icon: '❤️', name: 'Tougher', desc: '+1 max health & heal 1' },
  { id: 'pierce',   icon: '🏹', name: 'Piercing', desc: 'Bullets pass through +1 enemy' },
]

// a brand-new game world
function freshWorld() {
  return {
    px: W / 2, py: H / 2,        // player position
    hp: START_HP, maxHp: START_HP,
    invuln: 0,                   // seconds of "can't be hit" left
    enemies: [],                 // { x, y, hp }
    bullets: [],                 // { x, y, vx, vy, dmg, pierce, hitIds }
    kills: 0,
    xp: 0,
    level: 1,
    elapsed: 0,
    spawnTimer: SPAWN_START,
    surgeTimer: SURGE_EVERY,     // countdown to the next ring-of-enemies surge
    fireTimer: 0,
    // upgrade-able stats
    fireCooldown: 0.5,           // seconds between shots
    dmg: 1,
    bulletCount: 1,
    moveSpeed: PLAYER_SPEED,
    pierce: 0,                   // how many EXTRA enemies a bullet passes through
    nextId: 1,                   // unique id per enemy (for pierce tracking)
    dead: false,
  }
}

function SmudgeSurvivors({ onBack }) {
  const [phase, setPhase] = useState('ready') // ready, running, levelup, done
  const [score, setScore] = useState(0)
  const [hud, setHud] = useState({ hp: START_HP, maxHp: START_HP, kills: 0, level: 1 })
  const [choices, setChoices] = useState([]) // the 3 upgrade cards shown on level-up
  const world = useRef(freshWorld())
  const canvasRef = useRef(null)
  const keys = useRef(new Set())          // which movement keys are held
  const pointer = useRef({ active: false, x: 0, y: 0 }) // touch/drag target
  const lastRef = useRef(0)
  const phaseRef = useRef('ready')        // so the loop can read phase without restarting

  // keep a ref copy of phase so the game loop's pause check is always current
  useEffect(() => { phaseRef.current = phase }, [phase])

  // pick 3 random different upgrades to offer
  function rollChoices() {
    const pool = [...UPGRADES]
    const picked = []
    for (let i = 0; i < 3 && pool.length; i++) {
      const idx = Math.floor(Math.random() * pool.length)
      picked.push(pool.splice(idx, 1)[0])
    }
    return picked
  }

  // apply the upgrade the player clicked, then resume
  function chooseUpgrade(up) {
    const w = world.current
    if (up.id === 'firerate') w.fireCooldown = Math.max(0.12, w.fireCooldown * 0.85)
    if (up.id === 'damage') w.dmg += 1
    if (up.id === 'multi') w.bulletCount += 1
    if (up.id === 'speed') w.moveSpeed *= 1.12
    if (up.id === 'maxhp') { w.maxHp += 1; w.hp = Math.min(w.maxHp, w.hp + 1) }
    if (up.id === 'pierce') w.pierce += 1
    setChoices([])
    setPhase('running') // un-pause; the loop's effect restarts the frames
  }

  // ---- the main game loop: runs ~60x/sec while playing ----
  useEffect(() => {
    if (phase !== 'running') return
    let raf
    lastRef.current = performance.now()
    const ctx = canvasRef.current.getContext('2d')

    function frame(now) {
      const w = world.current
      const dt = Math.min((now - lastRef.current) / 1000, 0.05)
      lastRef.current = now
      w.elapsed += dt

      // ---- MOVE THE PLAYER ----
      let dx = 0, dy = 0
      if (keys.current.has('left')) dx -= 1
      if (keys.current.has('right')) dx += 1
      if (keys.current.has('up')) dy -= 1
      if (keys.current.has('down')) dy += 1
      // if no keys but finger/mouse is held down, walk toward it
      if (dx === 0 && dy === 0 && pointer.current.active) {
        const tx = pointer.current.x - w.px
        const ty = pointer.current.y - w.py
        const d = Math.hypot(tx, ty)
        if (d > 4) { dx = tx / d; dy = ty / d }
      }
      const len = Math.hypot(dx, dy) || 1
      w.px += (dx / len) * w.moveSpeed * dt
      w.py += (dy / len) * w.moveSpeed * dt
      // keep the player inside the arena
      w.px = Math.max(PLAYER_R, Math.min(W - PLAYER_R, w.px))
      w.py = Math.max(PLAYER_R, Math.min(H - PLAYER_R, w.py))

      // ---- SPAWN ENEMIES (faster over time) ----
      w.spawnTimer -= dt
      if (w.spawnTimer <= 0) {
        const edge = Math.floor(Math.random() * 4)
        let x, y
        if (edge === 0) { x = Math.random() * W; y = -ENEMY_R }       // top
        else if (edge === 1) { x = W + ENEMY_R; y = Math.random() * H } // right
        else if (edge === 2) { x = Math.random() * W; y = H + ENEMY_R } // bottom
        else { x = -ENEMY_R; y = Math.random() * H }                    // left
        w.enemies.push({ id: w.nextId++, x, y, hp: enemyHp(w.elapsed) })
        const rate = Math.max(SPAWN_MIN, SPAWN_START - w.elapsed * 0.04)
        w.spawnTimer = rate
      }

      // ---- WAVE SURGE: a full ring of enemies closes in from all sides ----
      // This is the anti-camping mechanic: sit still and the ring crushes you,
      // so you HAVE to move to punch a gap and escape (that's "kiting").
      w.surgeTimer -= dt
      if (w.surgeTimer <= 0) {
        const count = 8 + Math.floor(w.elapsed / 12) // bigger rings later
        const ringR = Math.max(W, H) * 0.7           // spawn just outside view
        const start = Math.random() * Math.PI * 2     // random rotation each time
        for (let i = 0; i < count; i++) {
          const a = start + (i / count) * Math.PI * 2
          w.enemies.push({
            id: w.nextId++,
            x: w.px + Math.cos(a) * ringR,
            y: w.py + Math.sin(a) * ringR,
            hp: enemyHp(w.elapsed),
          })
        }
        w.surgeTimer = Math.max(8, SURGE_EVERY - w.elapsed * 0.05)
      }

      // ---- MOVE ENEMIES toward the player ----
      const eSpeed = ENEMY_START_SPEED + w.elapsed * ENEMY_SPEED_RAMP
      for (const e of w.enemies) {
        const ax = w.px - e.x, ay = w.py - e.y
        const d = Math.hypot(ax, ay) || 1
        e.x += (ax / d) * eSpeed * dt
        e.y += (ay / d) * eSpeed * dt
      }

      // ---- AUTO-FIRE at the nearest enemy ----
      w.fireTimer -= dt
      if (w.fireTimer <= 0 && w.enemies.length) {
        // find nearest enemy
        let near = null, best = Infinity
        for (const e of w.enemies) {
          const d = (e.x - w.px) ** 2 + (e.y - w.py) ** 2
          if (d < best) { best = d; near = e }
        }
        if (near) {
          const baseAng = Math.atan2(near.y - w.py, near.x - w.px)
          // spread extra bullets in a tight forward cone (not a 360° spray)
          for (let i = 0; i < w.bulletCount; i++) {
            const offset = (i - (w.bulletCount - 1) / 2) * FAN_SPREAD
            const a = baseAng + offset
            w.bullets.push({
              x: w.px, y: w.py,
              vx: Math.cos(a) * BULLET_SPEED,
              vy: Math.sin(a) * BULLET_SPEED,
              dmg: w.dmg, pierce: w.pierce, hitIds: [],
            })
          }
          w.fireTimer = w.fireCooldown
        }
      }

      // ---- MOVE BULLETS + drop off-screen ones ----
      for (const b of w.bullets) { b.x += b.vx * dt; b.y += b.vy * dt }
      w.bullets = w.bullets.filter(
        (b) => b.x > -10 && b.x < W + 10 && b.y > -10 && b.y < H + 10
      )

      // ---- BULLET vs ENEMY collisions ----
      for (const b of w.bullets) {
        for (const e of w.enemies) {
          if (e.hp <= 0 || b.hitIds.includes(e.id)) continue
          const rr = (BULLET_R + ENEMY_R) ** 2
          if ((b.x - e.x) ** 2 + (b.y - e.y) ** 2 <= rr) {
            e.hp -= b.dmg
            b.hitIds.push(e.id)
            if (b.pierce > 0) b.pierce -= 1
            else b.dead = true
            break
          }
        }
      }
      w.bullets = w.bullets.filter((b) => !b.dead)

      // ---- count kills + give XP ----
      const before = w.enemies.length
      const survivors = w.enemies.filter((e) => e.hp > 0)
      const killed = before - survivors.length
      if (killed > 0) {
        w.kills += killed
        w.xp += killed
      }
      w.enemies = survivors

      // ---- ENEMY vs PLAYER (lose health) ----
      if (w.invuln > 0) w.invuln -= dt
      for (const e of w.enemies) {
        const rr = (PLAYER_R + ENEMY_R) ** 2
        if ((e.x - w.px) ** 2 + (e.y - w.py) ** 2 <= rr && w.invuln <= 0) {
          w.hp -= 1
          w.invuln = INVULN
          e.x -= (e.x - w.px) // shove the enemy back a touch so it doesn't double-hit
          break
        }
      }

      // ---- LEVEL UP? (pause and offer upgrades) ----
      if (w.xp >= xpForLevel(w.level)) {
        w.xp -= xpForLevel(w.level)
        w.level += 1
        setHud({ hp: w.hp, maxHp: w.maxHp, kills: w.kills, level: w.level })
        setChoices(rollChoices())
        setPhase('levelup')
        return // stop the loop; choosing an upgrade restarts it
      }

      // ---- DEATH ----
      if (w.hp <= 0) {
        setScore(w.kills)
        setPhase('done')
        return
      }

      // ---- DRAW EVERYTHING ----
      draw(ctx, w)
      setHud({ hp: w.hp, maxHp: w.maxHp, kills: w.kills, level: w.level })
      raf = requestAnimationFrame(frame)
    }

    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [phase])

  // paint one frame of the arena
  function draw(ctx, w) {
    ctx.clearRect(0, 0, W, H)
    // arena background
    ctx.fillStyle = '#0a0e1a'
    ctx.fillRect(0, 0, W, H)
    ctx.strokeStyle = '#1e2a4a'
    ctx.lineWidth = 2
    ctx.strokeRect(1, 1, W - 2, H - 2)

    // bullets (cyan)
    ctx.fillStyle = '#22d3ee'
    for (const b of w.bullets) {
      ctx.beginPath()
      ctx.arc(b.x, b.y, BULLET_R, 0, Math.PI * 2)
      ctx.fill()
    }

    // enemies (purple)
    for (const e of w.enemies) {
      ctx.fillStyle = e.hp > 1 ? '#c084fc' : '#a855f7'
      ctx.beginPath()
      ctx.arc(e.x, e.y, ENEMY_R, 0, Math.PI * 2)
      ctx.fill()
    }

    // player (cyan dot; blinks while invulnerable)
    if (!(w.invuln > 0 && Math.floor(w.invuln * 20) % 2)) {
      ctx.fillStyle = '#f0f9ff'
      ctx.shadowColor = '#22d3ee'
      ctx.shadowBlur = 14
      ctx.beginPath()
      ctx.arc(w.px, w.py, PLAYER_R, 0, Math.PI * 2)
      ctx.fill()
      ctx.shadowBlur = 0
    }
  }

  // ---- KEYBOARD: track held movement keys ----
  useEffect(() => {
    const map = {
      ArrowLeft: 'left', a: 'left', A: 'left',
      ArrowRight: 'right', d: 'right', D: 'right',
      ArrowUp: 'up', w: 'up', W: 'up',
      ArrowDown: 'down', s: 'down', S: 'down',
    }
    function down(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      const k = map[e.key]
      if (k) { e.preventDefault(); keys.current.add(k) }
    }
    function up(e) {
      const k = map[e.key]
      if (k) keys.current.delete(k)
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [])

  // ---- TOUCH / MOUSE: drag to move toward your finger ----
  function pointAt(e) {
    const rect = canvasRef.current.getBoundingClientRect()
    const cx = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left
    const cy = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top
    // convert from on-screen pixels to the canvas's internal W×H grid
    pointer.current.x = (cx / rect.width) * W
    pointer.current.y = (cy / rect.height) * H
  }
  function pDown(e) { pointer.current.active = true; pointAt(e) }
  function pMove(e) { if (pointer.current.active) pointAt(e) }
  function pUp() { pointer.current.active = false }

  function start() {
    world.current = freshWorld()
    setScore(0)
    setHud({ hp: START_HP, maxHp: START_HP, kills: 0, level: 1 })
    keys.current.clear()
    pointer.current.active = false
    setPhase('running')
  }

  function reset() {
    world.current = freshWorld()
    setScore(0)
    setChoices([])
    setPhase('ready')
  }

  return (
    <section id="center">
      <button className="back-btn" onClick={onBack}>← Menu</button>
      <h1>🧟 Smudge Survivors</h1>

      {phase === 'ready' && (
        <>
          <p>Survive the swarm! You auto-shoot the nearest enemy — your job is to
            <b> dodge</b>. Every few kills you level up and pick an upgrade.</p>
          <p className="split-keys">
            Move: <b>WASD</b> / arrows on desktop, or <b>drag</b> on the arena (mobile).
          </p>
          <button className="play-btn" onClick={start}>START</button>
        </>
      )}

      {(phase === 'running' || phase === 'levelup') && (
        <>
          <div className="surv-hud">
            <span className="surv-hearts">
              {'❤️'.repeat(hud.hp)}{'🖤'.repeat(Math.max(0, hud.maxHp - hud.hp))}
            </span>
            <span className="split-stat">Lv {hud.level}</span>
            <span className="split-stat">💀 {hud.kills}</span>
          </div>
          <div className="surv-wrap">
            <canvas
              ref={canvasRef}
              width={W}
              height={H}
              className="surv-canvas"
              onPointerDown={pDown}
              onPointerMove={pMove}
              onPointerUp={pUp}
              onPointerLeave={pUp}
            />

            {phase === 'levelup' && (
              <div className="surv-levelup">
                <h2 className="surv-lvl-title">⬆️ LEVEL {hud.level}!</h2>
                <p className="surv-lvl-sub">Pick an upgrade</p>
                <div className="surv-cards">
                  {choices.map((up) => (
                    <button
                      key={up.id}
                      className="surv-card"
                      onClick={() => chooseUpgrade(up)}
                    >
                      <span className="surv-card-icon">{up.icon}</span>
                      <span className="surv-card-name">{up.name}</span>
                      <span className="surv-card-desc">{up.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {phase === 'done' && (
        <>
          <h2 className="split-result">You got swarmed!</h2>
          <p className="split-stat">{score} kills 💀 · reached Level {hud.level}</p>
          <ScoreSaver game="survivor" score={score} />
          <button className="play-btn" onClick={reset}>Try again</button>
        </>
      )}
    </section>
  )
}

export default SmudgeSurvivors
