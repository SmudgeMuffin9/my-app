import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'

// A shared place that knows the logged-in user AND their chosen username.
const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [username, setUsername] = useState(null)
  const [coins, setCoins] = useState(0)        // wallet balance
  const [owned, setOwned] = useState([])       // game keys this user has bought
  const [loading, setLoading] = useState(true)

  // look up this user's username + coin balance from the profiles table
  const loadProfile = useCallback(async (u) => {
    if (!u) {
      setUsername(null)
      setCoins(0)
      setOwned([])
      return
    }
    const { data } = await supabase
      .from('profiles')
      .select('username, coins')
      .eq('id', u.id)
      .maybeSingle()
    setUsername(data?.username ?? null)
    setCoins(data?.coins ?? 0)

    // which locked games has this user unlocked?
    const { data: unlocks } = await supabase
      .from('unlocks')
      .select('game')
      .eq('user_id', u.id)
    setOwned((unlocks ?? []).map((r) => r.game))
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
    <AuthContext.Provider
      value={{ user, username, coins, owned, loading, reloadProfile }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
