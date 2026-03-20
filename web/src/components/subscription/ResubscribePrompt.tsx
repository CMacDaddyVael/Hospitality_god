'use client'

import { useState } from 'react'
import Link from 'next/link'

type Props = {
  /** true when the user had a subscription that is now inactive/failed */
  isLapsed?: boolean
}

export default function ResubscribePrompt({ isLapsed = false }: Props) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubscribe = async () => {
    setIsLoading(true)
    setError('')

    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: 'pro' }),
      })

      const data = await res.json()

      if (!res.ok || !data.url) {
        setError(data.error || 'Failed to start checkout. Please try again.')
        return
      }

      // Redirect to Stripe Checkout
      window.location.href = data.url
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-8 space-y-6 text-center">
      {/* Icon */}
      <div className="flex justify-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-400/10 border border-amber-400/30 flex items-center justify-center">
          <span className="text-3xl">{isLapsed ? '⚠️' : '🔒'}</span>
        </div>
      </div>

      {/* Heading */}
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-white">
          {isLapsed ? 'Your subscription is inactive' : 'Unlock your AI marketing team'}
        </h1>
        <p className="text-slate-400 text-sm leading-relaxed">
          {isLapsed
            ? 'Your Pro subscription has ended or a recent payment failed. Reactivate to restore full access to your dashboard, deliverables, and content.'
            : 'Get daily content, listing optimization, review responses, and lifestyle photography for your short-term rental — all for $49/mo.'}
        </p>
      </div>

      {/* Feature list */}
      <ul className="text-left space-y-3">
        {[
          'Daily & weekly AI-generated content deliverables',
          'Listing optimization — titles, descriptions, tags',
          'Review response drafts in your voice',
          'Lifestyle photography via VAEL image generation',
          'Competitive analysis & market positioning',
          'Weekly email brief with everything ready to post',
        ].map((feature) => (
          <li key={feature} className="flex items-start gap-3 text-sm text-slate-300">
            <span className="text-amber-400 mt-0.5 shrink-0">✓</span>
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      {/* Price callout */}
      <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700">
        <div className="flex items-baseline justify-center gap-1">
          <span className="text-3xl font-bold text-white">$49</span>
          <span className="text-slate-400 text-sm">/month</span>
        </div>
        <p className="text-slate-500 text-xs mt-1">Cancel anytime. No contracts.</p>
      </div>

      {/* CTA */}
      <button
        onClick={handleSubscribe}
        disabled={isLoading}
        className="w-full py-4 px-6 bg-amber-400 hover:bg-amber-300 disabled:bg-slate-600 disabled:cursor-not-allowed
                   text-slate-900 font-semibold rounded-xl transition-colors duration-200 text-base"
      >
        {isLoading
          ? 'Redirecting to checkout…'
          : isLapsed
          ? 'Reactivate Pro — $49/mo'
          : 'Start Pro — $49/mo'}
      </button>

      {error && (
        <p className="text-red-400 text-sm text-center">{error}</p>
      )}

      {/* Back link */}
      <p className="text-slate-500 text-xs">
        <Link href="/" className="underline hover:text-slate-300 transition-colors">
          ← Back to home
        </Link>
      </p>
    </div>
  )
}
