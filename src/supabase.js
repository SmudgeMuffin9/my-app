import { createClient } from '@supabase/supabase-js'

// Your project's address + public key. The publishable key is SAFE to put here:
// it's meant for the browser, and your table's policies (RLS) are what actually
// guard the data.
const SUPABASE_URL = 'https://rpptipltsmafmcetofyd.supabase.co'
const SUPABASE_KEY = 'sb_publishable_HfJk46a42wOvo3U1Yz-FTw_jPj5lZK2'

// Allow more realtime messages/sec than the default 10 — co-op streams the
// game picture ~15×/sec, so we lift the cap so those aren't throttled.
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  realtime: { params: { eventsPerSecond: 40 } },
})
