'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '../../lib/supabase/client'
import type { User } from '@supabase/supabase-js'

type AuthState = {
  user: User | null
  isLoading: boolean
}

/**
 * Lightweight hook that exposes the current Supabase auth user and
 * a loading flag. Subscribe to auth state changes so the UI stays in sync.
 */
export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ user: null, isLoading: true })
  const supabase = createClient()

  useEffect(() => {
    // Get current session on mount
    supabase.auth.getUser().then(({ data: { user } }) => {
      setState({ user, isLoading: false })
    })

    // Subscribe to future changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({ user: session?.user ?? null, isLoading: false })
    })

    return () => subscription.unsubscribe()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return state
}

/**
 * Returns a signOut function that clears the Supabase session
 * and optionally redirects.
 */
export function useSignOut() {
  const supabase = createClient()

  return useCallback(async (redirectTo = '/audit') => {
    await supabase.auth.signOut()
    window.location.href = redirectTo
  }, [supabase]) // eslint-disable-line react-hooks/exhaustive-deps
}
