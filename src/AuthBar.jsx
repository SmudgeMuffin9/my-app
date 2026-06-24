import { useState } from 'react'
import { supabase } from './supabase'
import { useAuth } from './auth'
import { isOwner } from './owner'
import UsernamePicker from './UsernamePicker'

function AuthBar() {
  const { user, username, coins } = useAuth()
  const [error, setError] = useState(null)

  // send the player to Google to sign in, then back to our site
  async function signInWithGoogle() {
    setError(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    if (error) setError(error.message)
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
        <span className="coin-balance">🪙 {coins} Smudge's</span>
        <button className="auth-link" onClick={signOut}>Sign out</button>
      </div>
    )
  }

  // logged out → one-click Google sign in
  return (
    <div className="authbar">
      <button className="google-btn" onClick={signInWithGoogle}>
        <span className="google-g">G</span> Sign in with Google
      </button>
      {error && <span className="lb-error">⚠️ {error}</span>}
    </div>
  )
}

export default AuthBar
