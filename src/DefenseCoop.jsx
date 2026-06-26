// ============================================================
// SMUDGE DEFENSE — CO-OP lobby + chat SCREEN (presentational).
// ------------------------------------------------------------
// This file only DRAWS the lobby + chat. All the realtime wiring
// (the channel, presence, snapshots, actions) lives in SmudgeDefense.jsx,
// because the connection has to stay alive when we jump from the lobby
// into the actual battle — so the parent owns it and passes data down here.
// ============================================================
import { useEffect, useRef } from 'react'

export default function DefenseCoop({
  screen,            // 'menu' | 'lobby'
  code,              // the room code we're in
  joinInput, setJoinInput,
  members,           // [{ id, name }] currently in the room
  messages,          // chat log [{ name, text, mine }]
  draft, setDraft,
  status,            // 'connecting' | 'live' | 'error'
  role,              // 'host' | 'guest'
  onCreate, onJoin, onSend, onStart, onLeave, onBack,
}) {
  const chatEndRef = useRef(null)
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ---------------- MENU ----------------
  if (screen === 'menu') {
    return (
      <div className="coop-wrap">
        <h2>🤝 Smudge Defense — Co-op</h2>
        <p className="split-keys">Team up and defend together. Make a room and share the code, or join a friend's.</p>

        <div className="coop-card">
          <button className="play-btn" onClick={onCreate}>➕ Create a room</button>
        </div>

        <div className="coop-card">
          <input
            className="coop-input"
            placeholder="ENTER CODE"
            maxLength={4}
            value={joinInput}
            onChange={(e) => setJoinInput(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && onJoin()}
          />
          <button className="play-btn" onClick={onJoin} disabled={joinInput.trim().length !== 4}>
            🔑 Join room
          </button>
        </div>

        <button className="back-btn" onClick={onBack}>← Back</button>
      </div>
    )
  }

  // ---------------- LOBBY (waiting + chat) ----------------
  const canStart = role === 'host' && members.length >= 2
  return (
    <div className="coop-wrap">
      <h2>Room <span className="coop-code">{code}</span></h2>
      <p className="split-keys">
        {status === 'connecting' && '⏳ Connecting…'}
        {status === 'live' && `🟢 In room: ${members.map((m) => m.name).join(', ') || '…'}`}
        {status === 'error' && '🔴 Connection problem — try again.'}
      </p>
      <p className="split-keys">Share the code <b>{code}</b> with your friend so they can join.</p>

      <div className="coop-chat">
        {messages.length === 0 && <p className="coop-empty">No messages yet — say hi! 👋</p>}
        {messages.map((m, i) => (
          <div key={i} className={`coop-msg ${m.mine ? 'mine' : ''}`}>
            <b>{m.name}:</b> {m.text}
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      <div className="coop-card">
        <input
          className="coop-input"
          placeholder="Type a message…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onSend()}
        />
        <button className="play-btn" onClick={onSend}>Send</button>
      </div>

      {role === 'host' ? (
        <button className="play-btn" onClick={onStart} disabled={!canStart}>
          {canStart ? '🚀 START CO-OP BATTLE' : '⏳ Waiting for a friend to join…'}
        </button>
      ) : (
        <p className="split-keys coop-soon">⏳ Waiting for the host to start the battle…</p>
      )}
      <button className="back-btn" onClick={onLeave}>← Leave room</button>
    </div>
  )
}
