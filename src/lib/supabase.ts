import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null = null
let initialization: Promise<SupabaseClient | null> | null = null

function createConfiguredClient(url: string, publishableKey: string) {
  if (!url || !publishableKey || publishableKey.startsWith('sb_secret_')) return null
  if (!client) {
    client = createClient(url, publishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  }
  return client
}

export function getSupabaseClient() {
  return client || createConfiguredClient(__SUPABASE_URL__, __SUPABASE_PUBLISHABLE_KEY__)
}

export function initializeSupabaseClient() {
  const configured = getSupabaseClient()
  if (configured) return Promise.resolve(configured)
  if (!initialization) {
    initialization = fetch('/api/config', { headers: { Accept: 'application/json' }, cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) return null
        const configuration = await response.json() as { supabaseUrl?: string; supabasePublishableKey?: string }
        return createConfiguredClient(configuration.supabaseUrl || '', configuration.supabasePublishableKey || '')
      })
      .catch(() => null)
  }
  return initialization
}
