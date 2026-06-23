import { useState } from 'react'
import { supabase } from './supabase'
import { useAuth } from './auth'
import { checkUsername } from './profanity'

function UsernamePicker() {
  const { user, reloadProfile } = useAuth()
  const [name, setName] = useState('')
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  async function submit(e) {
    e.preventDefault()
    const problem = checkUsername(name)
    if (problem) {
      setError(problem)
      return
    }
    setSaving(true)
    setError(null)
    // inserting a profile = locking in your username (no update rule = can't change later)
    const { error } = await supabase
      .from('profiles')
      .insert({ id: user.id, username: name.trim() })
    setSaving(false)
    if (error) {
      if (error.code === '23505') setError('That username is taken — try another!')
      else setError(error.message)
    } else {
      reloadProfile()
    }
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      <span className="auth-hi">Pick a username (you only get one!):</span>
      <input
        className="lb-input"
        value={name}
        maxLength={12}
        placeholder="username"
        onChange={(e) => setName(e.target.value)}
      />
      <button className="play-btn" type="submit" disabled={saving}>
        {saving ? 'Locking…' : 'Lock it in 🔒'}
      </button>
      {error && <span className="lb-error">⚠️ {error}</span>}
    </form>
  )
}

export default UsernamePicker
