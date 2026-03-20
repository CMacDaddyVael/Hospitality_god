import { createBrowserClient } from '@supabase/ssr'

/**
 * Browser-side Supabase client. Safe to use in Client Components.
 * Call this inside a component or hook — do not instantiate at module level
 * to avoid issues with SSR.
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
