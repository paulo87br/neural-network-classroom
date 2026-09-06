import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null = null

export function getSupabaseClient() {
  if (!__SUPABASE_URL__ || !__SUPABASE_PUBLISHABLE_KEY__) return null
  if (!client) {
    client = createClient(__SUPABASE_URL__, __SUPABASE_PUBLISHABLE_KEY__, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  }
  return client
}
