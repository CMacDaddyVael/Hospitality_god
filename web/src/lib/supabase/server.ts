import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

/**
 * Creates a Supabase client for use in Server Components / API routes.
 * Uses the service role key so it can read the auth session from cookies.
 *
 * For actual user-scoped queries in components, pass the user_id explicitly
 * and use the service role client with row-level filters.
 */
export function createServerClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false,
        detectSessionInUrl: false,
      },
      global: {
        headers: {
          // Forward cookies for session detection
          Cookie: cookies().toString(),
        },
      },
    }
  )
}
