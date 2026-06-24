import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'

// A shared place that knows the logged-in user AND their chosen username.
const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [username, setUsername] = useState(null)
  const [coins, setCoins] = useState(0)        // wallet balance
  const [owned, setOwned] = useState([])       // game keys this user has bought
  const [playtime, setPlaytime] = useState(0)  // total seconds played (for time-locked games)
  const [loading, setLoading] = useState(true)

  // look up this user's username + coin balance from the profiles table
  const loadProfile = useCallback(async (u) => {
    if (!u) {
      setUsername(null)
      setCoins(0)
      setOwned([])
      setPlaytime(0)
      return
    }
    const { data } = await supabase
      .from('profiles')
      .select('username, coins, playtime_seconds')
      .eq('id', u.id)
      .maybeSingle()
    setUsername(data?.username ?? null)
    setCoins(data?.coins ?? 0)
    setPlaytime(data?.playtime_seconds ?? 0)

    // which locked games has this user unlocked? newest purchase first
    const { data: unlocks } = await supabase
      .from('unlocks')
      .select('game')
      .eq('user_id', u.id)
      .order('created_at', { ascending: false })
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

  // Playtime tracker: while signed in with the tab visible, add 15 seconds
  // every 15 seconds to the database (server caps it so it can't be faked).
  useEffect(() => {
    if (!user) return
    const id = setInterval(async () => {
      if (document.visibilityState !== 'visible') return
      const { data } = await supabase.rpc('add_playtime', { p_seconds: 15 })
      if (typeof data === 'number') setPlaytime(data)
    }, 15000)
    return () => clearInterval(id)
  }, [user])

  const reloadProfile = useCallback(() => loadProfile(user), [loadProfile, user])

  return (
    <AuthContext.Provider
      value={{ user, username, coins, owned, playtime, loading, reloadProfile }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
