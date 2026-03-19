import { createClient } from '@supabase/supabase-js'
import type { Database } from './types'

/**
 * Creates a Supabase admin client with service role key.
 * ONLY use this in server-side code (API routes, server actions).
 * NEVER expose this to the browser.
 */
export function createAdminClient() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set')
  }

  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
