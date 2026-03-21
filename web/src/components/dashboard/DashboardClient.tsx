'use client'

import { useEffect, useState, useCallback } from 'react'
import { ScoreCard } from './ScoreCard'
import { ScoreTrendChart } from './ScoreTrendChart'
import { DeliverableFeed } from './DeliverableFeed'
import { SubscriptionBanner } from './SubscriptionBanner'
import { DashboardSkeleton } from './DashboardSkeleton'

export type Subscription = {
  id: string
  user_id: string
  stripe_customer_id: string
  stripe_subscription_id: string
  status: 'active' | 'cancelled' | 'past_due' | 'trialing'
  plan: string
  current_period_end: string
}

export type Deliverable = {
  id: string
  user_id: string
  type: string
  status: 'pending' | 'approved' | 'archived'
  content: string
  title?: string
  created_at: string
  approved_at?: string
  updated_at: string
}

export type ScorePoint = {
  score: number
  scored_at: string
  listing_url?: string
}

type DashboardData = {
  subscription: Subscription | null
  deliverables: Deliverable[]
  scoreHistory: ScorePoint[]
  currentScore: number | null
  pendingCount: number
}

type Props = {
  userId: string
  userEmail: string
}

export default function DashboardClient({ userId, userEmail }: Props) {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/dashboard/data?user_id=${userId}`)
      if (!res.ok) {
        throw new Error('Failed to load dashboard data')
      }
      const json = await res.json()
      setData(json)
    } catch (err) {
      console.error(err)
      setError('Failed to load your dashboard. Please refresh.')
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleApprove = useCallback(
    async (deliverableId: string) => {
      // Optimistic update
      setData((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          deliverables: prev.deliverables.map((d) =>
            d.id === deliverableId ? { ...d, status: 'approved' as const } : d
          ),
          pendingCount: Math.max(0, prev.pendingCount - 1),
        }
      })

      try {
        const res = await fetch('/api/deliverables/approve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deliverable_id: deliverableId, user_id: userId }),
        })
        if (!res.ok) {
          throw new Error('Approve failed')
        }
      } catch (err) {
        console.error('Approve error:', err)
        // Revert optimistic update
        fetchData()
      }
    },
    [userId, fetchData]
  )

  if (loading) return <DashboardSkeleton />

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-red-400 text-lg">{error}</p>
          <button
            onClick={() => { setLoading(true); setError(null); fetchData() }}
            className="px-4 py-2 bg-amber-400 text-slate-900 rounded-lg font-medium hover:bg-amber-300 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  const isActive = data?.subscription?.status === 'active' || data?.subscription?.status === 'trialing'
  const isCancelled = data?.subscription?.status === 'cancelled'
  const hasSubscription = !!data?.subscription

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-400 flex items-center justify-center">
              <span className="text-slate-900 font-bold text-sm">V</span>
            </div>
            <span className="font-semibold text-white text-lg">VAEL Host</span>
          </div>

          <div className="flex items-center gap-4">
            {/* Subscription status badge */}
            {hasSubscription && (
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
                  isActive
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                    : isCancelled
                    ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                    : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isActive ? 'bg-emerald-400' : isCancelled ? 'bg-red-400' : 'bg-amber-400'
                  }`}
                />
                {isActive ? 'Pro — Active' : isCancelled ? 'Cancelled' : 'Past Due'}
              </span>
            )}

            <span className="text-slate-400 text-sm hidden sm:block">{userEmail}</span>

            <form action="/api/auth/signout" method="post">
              <button
                type="submit"
                className="text-slate-400 hover:text-white text-sm transition-colors"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Cancelled subscription banner */}
        {isCancelled && <SubscriptionBanner />}

        {/* No subscription — prompt to subscribe */}
        {!hasSubscription && (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-white font-semibold">Activate your Pro plan</h3>
              <p className="text-slate-400 text-sm mt-1">
                Subscribe to unlock daily deliverables and listing optimization.
              </p>
            </div>
            <a
              href="/api/stripe/checkout"
              onClick={async (e) => {
                e.preventDefault()
                const res = await fetch('/api/stripe/checkout', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    price_id: process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID,
                    user_id: userId,
                  }),
                })
                const json = await res.json()
                if (json.url) window.location.href = json.url
              }}
              className="flex-shrink-0 px-5 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-900 font-semibold rounded-xl text-sm transition-colors"
            >
              Subscribe — $49/mo →
            </a>
          </div>
        )}

        {/* Top stats row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <ScoreCard
            score={data?.currentScore ?? null}
            label="Listing Score"
            sublabel="out of 100"
          />
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between">
            <p className="text-slate-400 text-sm font-medium">Pending Review</p>
            <div className="mt-2">
              <span className="text-4xl font-bold text-white">{data?.pendingCount ?? 0}</span>
              <span className="text-slate-500 text-sm ml-2">deliverables</span>
            </div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between">
            <p className="text-slate-400 text-sm font-medium">Plan</p>
            <div className="mt-2">
              <span className="text-2xl font-bold text-white capitalize">
                {data?.subscription?.plan ?? 'Free'}
              </span>
              {data?.subscription?.current_period_end && isActive && (
                <p className="text-slate-500 text-xs mt-1">
                  Renews{' '}
                  {new Date(data.subscription.current_period_end).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Score trend chart */}
        {data?.scoreHistory && data.scoreHistory.length > 0 && (
          <ScoreTrendChart scores={data.scoreHistory} />
        )}

        {/* Deliverable feed */}
        <DeliverableFeed
          deliverables={data?.deliverables ?? []}
          isActive={isActive}
          onApprove={handleApprove}
        />
      </main>
    </div>
  )
}
