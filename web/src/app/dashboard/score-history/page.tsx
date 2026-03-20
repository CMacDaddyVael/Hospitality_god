/**
 * /dashboard/score-history
 *
 * Standalone page that renders the score history chart for a listing.
 * Usage: /dashboard/score-history?listingId=<uuid>
 *
 * This page is NEW and additive — it does not modify the existing
 * dashboard layout or any other dashboard pages.
 */

'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { ScoreHistoryWidget } from '@/components/dashboard/ScoreHistoryWidget'

function ScoreHistoryContent() {
  const searchParams = useSearchParams()
  const listingId = searchParams.get('listingId')

  if (!listingId) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-2">
          <p className="text-slate-400 text-sm">No listing selected.</p>
          <p className="text-slate-500 text-xs">
            Pass <code className="bg-slate-800 px-1.5 py-0.5 rounded text-amber-400">?listingId=...</code> to this page.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Score History</h1>
        <p className="text-slate-400 text-sm mt-1">
          Track how your listing score has improved over time.
        </p>
      </div>
      <ScoreHistoryWidget listingId={listingId} />
    </div>
  )
}

export default function ScoreHistoryPage() {
  return (
    <div className="p-6">
      <Suspense
        fallback={
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 animate-pulse max-w-2xl mx-auto">
            <div className="h-5 w-40 bg-slate-700 rounded mb-4" />
            <div className="h-56 bg-slate-800/50 rounded-xl" />
          </div>
        }
      >
        <ScoreHistoryContent />
      </Suspense>
    </div>
  )
}
