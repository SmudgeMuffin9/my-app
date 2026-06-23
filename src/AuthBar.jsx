import { useState } from 'react'
import { supabase } from './supabase'
import { useAuth } from './auth'
import { isOwner } from './owner'
import UsernamePicker from './UsernamePicker'

function AuthBar() {
  const { user, username } = useAuth()
  const [email, setEmail] = useState('')
  const [open, setOpen] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState(null)

  async function sendLink(e) {
    e.preventDefault()
    setError(null)
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    })
    if (error) setError(error.message)
    else setSent(true)
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  // logged in but no username yet → make them pick one
  if (user && !username) {
    return (
      <div className="authbar">
        <UsernamePicker />
        <button className="auth-link" onClick={signOut}>Sign out</button>
      </div>
    )
  }

  // logged in with a username
  if (user) {
    return (
      <div className="authbar">
        <span className={`auth-hi ${isOwner(username) ? 'owner' : ''}`}>
          {isOwner(username) ? `🔨 ${username} (owner)` : `👋 ${username}`}
        </span>
        <button className="auth-link" onClick={signOut}>Sign out</button>
      </div>
    )
  }

  // logged out
  return (
    <div className="authbar">
      {!open ? (
        <button className="auth-link" onClick={() => setOpen(true)}>🔐 Sign in</button>
      ) : sent ? (
        <span className="auth-sent">📧 Check your email for the login link!</span>
      ) : (
        <form className="auth-form" onSubmit={sendLink}>
          <input
            className="lb-input"
            type="email"
            required
            placeholder="your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button className="play-btn" type="submit">Send link</button>
          {error && <span className="lb-error">⚠️ {error}</span>}
        </form>
      )}
    </div>
  )
}

export default AuthBar
