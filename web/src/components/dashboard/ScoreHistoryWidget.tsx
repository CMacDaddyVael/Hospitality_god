'use client'

/**
 * ScoreHistoryWidget
 *
 * A self-contained wrapper that handles auth-token retrieval from
 * the Supabase client session, then renders ScoreHistoryChart.
 *
 * Usage in dashboard:
 *   <ScoreHistoryWidget listingId={listing.id} />
 */

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { ScoreHistoryChart } from './ScoreHistoryChart'

type Props = {
  listingId: string
}

function getSupabaseBrowserClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export function ScoreHistoryWidget({ listingId }: Props) {
  const [token, setToken] = useState<string | undefined>(undefined)
  const [tokenLoaded, setTokenLoaded] = useState(false)

  useEffect(() => {
    const supabase = getSupabaseBrowserClient()

    const loadToken = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      setToken(session?.access_token)
      setTokenLoaded(true)
    }

    loadToken()

    // Listen for auth changes (e.g. token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setToken(session?.access_token)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (!tokenLoaded) {
    return (
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 animate-pulse">
        <div className="h-5 w-40 bg-slate-700 rounded mb-4" />
        <div className="h-56 bg-slate-800/50 rounded-xl" />
      </div>
    )
  }

  return <ScoreHistoryChart listingId={listingId} authToken={token} />
}
