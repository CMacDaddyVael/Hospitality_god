'use client'

import { useState } from 'react'

type Props = {
  score: number
  problemCount: number
}

const WHAT_YOU_GET = [
  { icon: '✏️', text: 'Rewritten title with location keyword + emotional hook' },
  { icon: '📝', text: 'Optimized description targeting Airbnb\'s search algorithm' },
  { icon: '📸', text: 'AI lifestyle photos guests actually stop to look at' },
  { icon: '🔁', text: 'Weekly score tracking — see improvements over time' },
  { icon: '⭐', text: 'Review responses written in your voice, ready to post' },
  { icon: '📱', text: 'Social captions for Instagram & TikTok, ready to copy-paste' },
]

export function UpgradeCTA({ score, problemCount }: Props) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleUpgrade = async () => {
    setIsLoading(true)
    setError('')

    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: 'pro' }),
      })

      const data = await response.json()

      if (!response.ok || !data.url) {
        throw new Error(data.error || 'Failed to start checkout')
      }

      window.location.href = data.url
    } catch (err) {
      console.error('[UpgradeCTA] Checkout error:', err)
      setError('Something went wrong. Please try again or email hello@vael.ai')
      setIsLoading(false)
    }
  }

  const projectedScore = Math.min(100, score + 30)

  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-amber-950/80 via-slate-900 to-slate-900 border border-amber-800/50 rounded-3xl p-8 md:p-10 space-y-7">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-400/5 rounded-full -translate-y-1/2 translate-x-1/4 blur-3xl" />
      </div>

      {/* Header */}
      <div className="relative space-y-3">
        <div className="inline-flex items-center gap-2 bg-amber-400/10 border border-amber-800/50 rounded-full px-3 py-1 text-xs font-semibold text-amber-400 uppercase tracking-widest">
          VAEL Pro — $49/mo
        </div>
        <h2 className="text-2xl md:text-3xl font-bold text-white leading-tight">
          Your listing score is{' '}
          <span className="text-amber-400">{score}/100.</span>
          <br />
          Let's get it to{' '}
          <span className="text-emerald-400">{projectedScore}+</span>.
        </h2>
        <p className="text-slate-400 text-base">
          VAEL fixes{' '}
          <span className="text-white font-medium">{problemCount > 0 ? `all ${problemCount}` : 'every'}</span>{' '}
          issue{problemCount !== 1 ? 's' : ''} above — then keeps working every week to stay ahead of the competition.
        </p>
      </div>

      {/* What you get */}
      <div className="relative grid sm:grid-cols-2 gap-3">
        {WHAT_YOU_GET.map((item, i) => (
          <div key={i} className="flex items-start gap-3">
            <span className="text-base flex-shrink-0 mt-0.5">{item.icon}</span>
            <span className="text-slate-300 text-sm leading-snug">{item.text}</span>
          </div>
        ))}
      </div>

      {/* CTA Button */}
      <div className="relative space-y-3">
        <button
          onClick={handleUpgrade}
          disabled={isLoading}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-3 bg-amber-400 hover:bg-amber-300 disabled:bg-amber-800 disabled:cursor-not-allowed text-slate-900 font-bold text-lg px-10 py-4 rounded-2xl transition-all duration-200 shadow-lg shadow-amber-400/20 hover:shadow-amber-400/30 hover:scale-[1.02] active:scale-[0.98]"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Starting checkout…
            </>
          ) : (
            <>
              Fix this listing for $49/mo
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </>
          )}
        </button>

        {error && (
          <p className="text-red-400 text-sm">{error}</p>
        )}

        <p className="text-slate-600 text-xs">
          Cancel anytime · No contracts · 7-day money-back guarantee
        </p>
      </div>

      {/* Social proof */}
      <div className="relative border-t border-slate-800 pt-5 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex -space-x-2">
          {['🧑‍💼', '👩‍💻', '🧑‍🍳', '👨‍💼'].map((emoji, i) => (
            <div
              key={i}
              className="w-8 h-8 rounded-full bg-slate-800 border-2 border-slate-900 flex items-center justify-center text-sm"
            >
              {emoji}
            </div>
          ))}
        </div>
        <div>
          <p className="text-slate-300 text-sm font-medium">Join hosts already using VAEL</p>
          <p className="text-slate-500 text-xs">Average score improvement: +31 points in 30 days</p>
        </div>
      </div>
    </div>
  )
}
