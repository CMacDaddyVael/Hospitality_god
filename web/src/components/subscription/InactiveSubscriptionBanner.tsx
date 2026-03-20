'use client'

import Link from 'next/link'

/**
 * Banner shown inside the dashboard when subscription is inactive.
 * The middleware redirects users away, but this component provides an
 * in-dashboard fallback in case the server-side check is bypassed (e.g.
 * subscription lapses mid-session).
 */
export default function InactiveSubscriptionBanner() {
  return (
    <div className="w-full bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div className="flex items-start gap-3">
        <span className="text-red-400 text-xl shrink-0">⚠️</span>
        <div>
          <p className="text-white font-semibold text-sm">Your subscription is inactive</p>
          <p className="text-slate-400 text-xs mt-0.5">
            A recent payment failed or your subscription was cancelled. Reactivate to restore full
            access.
          </p>
        </div>
      </div>
      <Link
        href="/subscribe?reason=subscription_required"
        className="shrink-0 px-4 py-2 bg-amber-400 hover:bg-amber-300 text-slate-900 font-semibold text-sm rounded-lg transition-colors"
      >
        Reactivate →
      </Link>
    </div>
  )
}
