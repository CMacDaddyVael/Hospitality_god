'use client'

import { createClient } from '@/lib/supabase/client'
import { useMemo } from 'react'

/**
 * Returns a stable Supabase client instance for use in Client Components.
 * Memoized to avoid recreating on every render.
 */
export function useSupabase() {
  const client = useMemo(() => createClient(), [])
  return client
}
