'use client'

import { useEffect, useState, useCallback } from 'react'
import type { AuditData } from '@/lib/audit/getAudit'
import { ScoreGauge } from './ScoreGauge'
import { CategoryCard } from './CategoryCard'
import { LoadingState } from './LoadingState'
import { StickyCtaBar } from './StickyCtaBar'
import { ShareButton } from './ShareButton'

type Props = {
  audit: AuditData
  auditId: string
}

const POLL_INTERVAL_MS = 4000

export function AuditResultsClient({ audit: initialAudit, auditId }: Props) {
  const [audit, setAudit] = useState<AuditData>(initialAudit)
  const [isPolling, setIsPolling] = useState(
    initialAudit.status === 'pending' || initialAudit.status === 'processing'
  )

  const pollAudit = useCallback(async () => {
    try {
      const res = await fetch(`/api/audit/${auditId}`, { cache: 'no-store' })
      if (!res.ok) return
      const data: AuditData = await res.json()
      setAudit(data)
      if (data.status === 'complete' || data.status === 'failed') {
        setIsPolling(false)
      }
    } catch {
      // silently retry
    }
  }, [auditId])

  useEffect(() => {
    if (!isPolling) return
    const interval = setInterval(pollAudit, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [isPolling, pollAudit])

  // Loading / processing state
  if (audit.status === 'pending' || audit.status === 'processing') {
    return <LoadingState audit={audit} />
  }

  // Failed state
  if (audit.status === 'failed') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-md">
          <div className="text-5xl">⚠️</div>
          <h1 className="text-2xl font-bold text-white">Audit Failed</h1>
          <p className="text-slate-400">
            We had trouble analyzing this listing. This sometimes happens with private or
            removed listings.
          </p>
          <a
            href="/"
            className="inline-block mt-4 px-6 py-3 bg-amber-400 hover:bg-amber-300 text-slate-900 font-semibold rounded-xl transition-colors"
          >
            Try Another Listing
          </a>
        </div>
      </div>
    )
  }

  const score = audit.overall_score ?? 0
  const categories = audit.categories ?? []

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-32">
      {/* Header */}
      <header className="bg-slate-900/80 backdrop-blur-sm border-b border-slate-800 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-amber-400">⚡</span>
            <span className="font-bold text-white text-sm md:text-base">Hospitality God</span>
          </div>
          <ShareButton />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        {/* Hero score section */}
        <section className="text-center space-y-4">
          {audit.listing_title && (
            <p className="text-slate-400 text-sm truncate max-w-xs mx-auto">
              {audit.listing_platform && (
                <span className="capitalize">{audit.listing_platform} · </span>
              )}
              {audit.listing_title}
            </p>
          )}
          <h1 className="text-2xl md:text-3xl font-bold text-white">
            Your Listing Report Card
          </h1>

          <ScoreGauge score={score} />

          <p className="text-slate-300 text-sm md:text-base max-w-sm mx-auto">
            {score < 40
              ? 'Critical issues found. Your listing is losing bookings every day.'
              : score < 70
              ? 'Some problems found. A few fixes could meaningfully boost your bookings.'
              : 'Good foundation! A few optimizations could push you to the top.'}
          </p>
        </section>

        {/* Divider */}
        <div className="border-t border-slate-800" />

        {/* What we found intro */}
        <section>
          <h2 className="text-lg font-semibold text-white mb-1">What we found</h2>
          <p className="text-slate-400 text-sm">
            We analyzed {categories.length} categories across your listing. Here's exactly
            what's working and what needs fixing.
          </p>
        </section>

        {/* Category breakdown */}
        <section className="space-y-4">
          {categories.length > 0 ? (
            categories.map((cat, i) => <CategoryCard key={i} category={cat} />)
          ) : (
            <div className="text-slate-500 text-sm italic">No category data available.</div>
          )}
        </section>

        {/* Bottom CTA (inline, above sticky bar) */}
        <section className="bg-gradient-to-br from-amber-400/10 to-amber-600/10 border border-amber-400/30 rounded-2xl p-6 space-y-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">🤖</span>
            <div>
              <h3 className="font-bold text-white text-lg">Your swarm is ready.</h3>
              <p className="text-slate-300 text-sm mt-1">
                For $59/mo, our AI team fixes every issue above — rewriting your title,
                description, and tags, creating social content, drafting review responses,
                and monitoring your ranking weekly.
              </p>
            </div>
          </div>

          <ul className="space-y-2">
            {[
              'Rewritten listing title & description',
              'Optimized tags and amenity copy',
              'Weekly Instagram/TikTok content',
              'Review response drafts in your voice',
              'Seasonal photo set recommendations',
              'Monthly score progress report',
            ].map((item) => (
              <li key={item} className="flex items-center gap-2 text-sm text-slate-300">
                <span className="text-amber-400 flex-shrink-0">✓</span>
                {item}
              </li>
            ))}
          </ul>

          <SubscribeButton auditId={auditId} size="large" />
        </section>
      </main>

      {/* Sticky CTA bar */}
      <StickyCtaBar auditId={auditId} score={score} />
    </div>
  )
}

function SubscribeButton({ auditId, size = 'default' }: { auditId: string; size?: 'default' | 'large' }) {
  const [loading, setLoading] = useState(false)

  const handleSubscribe = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: 'pro', sessionId: auditId }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        // Fallback to direct Stripe payment link if configured
        const paymentLink = process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK
        if (paymentLink) {
          window.location.href = paymentLink
        }
      }
    } catch {
      const paymentLink = process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK
      if (paymentLink) {
        window.location.href = paymentLink
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleSubscribe}
      disabled={loading}
      className={`w-full bg-amber-400 hover:bg-amber-300 disabled:bg-amber-400/50 text-slate-900 font-bold rounded-xl transition-all active:scale-95 ${
        size === 'large' ? 'py-4 text-base' : 'py-3 text-sm'
      }`}
    >
      {loading ? (
        <span className="flex items-center justify-center gap-2">
          <span className="w-4 h-4 border-2 border-slate-900/30 border-t-slate-900 rounded-full animate-spin" />
          Loading...
        </span>
      ) : (
        'Fix all of this — $59/mo →'
      )}
    </button>
  )
}
