import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'

// A shared place that knows the logged-in user AND their chosen username.
const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [username, setUsername] = useState(null)
  const [loading, setLoading] = useState(true)

  // look up this user's username from the profiles table
  const loadProfile = useCallback(async (u) => {
    if (!u) {
      setUsername(null)
      return
    }
    const { data } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', u.id)
      .maybeSingle()
    setUsername(data?.username ?? null)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const u = data.session?.user ?? null
      setUser(u)
      await loadProfile(u)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const u = session?.user ?? null
      setUser(u)
      await loadProfile(u)
    })
    return () => sub.subscription.unsubscribe()
  }, [loadProfile])

  const reloadProfile = useCallback(() => loadProfile(user), [loadProfile, user])

  return (
    <AuthContext.Provider value={{ user, username, loading, reloadProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
