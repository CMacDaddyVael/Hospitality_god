'use client'

import { useState, useCallback } from 'react'
import type { Deliverable, DeliverableStatus, DeliverableType } from '@/app/dashboard/deliverables/page'
import { CopyBlock } from './CopyBlock'
import { formatForPlatform } from '@/lib/deliverables/formatters'

interface Props {
  deliverable: Deliverable
  onStatusUpdate: (id: string, status: DeliverableStatus) => Promise<void>
}

const TYPE_META: Record<
  DeliverableType,
  { label: string; icon: string; platform: string; color: string }
> = {
  airbnb_title: {
    label: 'Airbnb Title',
    icon: '🏠',
    platform: 'Airbnb',
    color: 'bg-rose-500/10 border-rose-500/20 text-rose-400',
  },
  airbnb_description: {
    label: 'Airbnb Description',
    icon: '🏠',
    platform: 'Airbnb',
    color: 'bg-rose-500/10 border-rose-500/20 text-rose-400',
  },
  instagram_caption: {
    label: 'Instagram Caption',
    icon: '📸',
    platform: 'Instagram',
    color: 'bg-purple-500/10 border-purple-500/20 text-purple-400',
  },
  review_response: {
    label: 'Review Response',
    icon: '⭐',
    platform: 'Airbnb',
    color: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
  },
  guest_message: {
    label: 'Guest Message',
    icon: '💬',
    platform: 'Airbnb / Direct',
    color: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
  },
  seo_content: {
    label: 'SEO Content',
    icon: '🔍',
    platform: 'Website',
    color: 'bg-green-500/10 border-green-500/20 text-green-400',
  },
}

const STATUS_STYLES: Record<DeliverableStatus, string> = {
  pending: 'bg-slate-700/50 text-slate-300 border-slate-600/50',
  approved: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  posted: 'bg-green-500/10 text-green-400 border-green-500/20',
}

const STATUS_LABELS: Record<DeliverableStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  posted: 'Posted',
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

export function DeliverableCard({ deliverable, onStatusUpdate }: Props) {
  const [isUpdating, setIsUpdating] = useState(false)
  const [isExpanded, setIsExpanded] = useState(
    deliverable.status === 'pending' || deliverable.status === 'approved'
  )

  const meta = TYPE_META[deliverable.type]
  const blocks = formatForPlatform(deliverable)

  const handleMarkPosted = useCallback(async () => {
    setIsUpdating(true)
    try {
      await onStatusUpdate(deliverable.id, 'posted')
    } finally {
      setIsUpdating(false)
    }
  }, [deliverable.id, onStatusUpdate])

  const handleMarkApproved = useCallback(async () => {
    setIsUpdating(true)
    try {
      await onStatusUpdate(deliverable.id, 'approved')
    } finally {
      setIsUpdating(false)
    }
  }, [deliverable.id, onStatusUpdate])

  const handleMarkPending = useCallback(async () => {
    setIsUpdating(true)
    try {
      await onStatusUpdate(deliverable.id, 'pending')
    } finally {
      setIsUpdating(false)
    }
  }, [deliverable.id, onStatusUpdate])

  return (
    <div
      className={`rounded-2xl border bg-slate-900/60 overflow-hidden transition-all duration-200 ${
        deliverable.status === 'posted'
          ? 'border-slate-700/40 opacity-75'
          : 'border-slate-700/60'
      }`}
    >
      {/* Card header */}
      <button
        className="w-full flex items-start sm:items-center justify-between p-4 sm:p-5 gap-3 text-left hover:bg-slate-800/30 transition-colors"
        onClick={() => setIsExpanded((v) => !v)}
        aria-expanded={isExpanded}
      >
        <div className="flex items-start sm:items-center gap-3 min-w-0">
          <span className="text-xl flex-shrink-0 mt-0.5 sm:mt-0">{meta.icon}</span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-0.5">
              <h3 className="text-white font-semibold text-sm sm:text-base truncate">
                {deliverable.title}
              </h3>
              <span
                className={`px-2 py-0.5 rounded-full border text-xs font-medium flex-shrink-0 ${STATUS_STYLES[deliverable.status]}`}
              >
                {STATUS_LABELS[deliverable.status]}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span
                className={`px-2 py-0.5 rounded-full border text-xs ${meta.color}`}
              >
                {meta.platform}
              </span>
              <span>{timeAgo(deliverable.created_at)}</span>
              {deliverable.posted_at && (
                <span className="text-green-500">
                  Posted {timeAgo(deliverable.posted_at)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Expand/collapse chevron */}
        <svg
          className={`w-5 h-5 text-slate-500 flex-shrink-0 transition-transform duration-200 ${
            isExpanded ? 'rotate-180' : ''
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-slate-700/50 px-4 sm:px-5 py-4 space-y-4">
          {/* Original review context for review responses */}
          {deliverable.type === 'review_response' &&
            deliverable.metadata?.review_text && (
              <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/40">
                <p className="text-xs font-medium text-slate-400 mb-1.5 flex items-center gap-1.5">
                  <span>⭐</span>
                  <span>
                    {deliverable.metadata.reviewer_name as string} ·{' '}
                    {deliverable.metadata.review_rating as number}/5
                  </span>
                </p>
                <p className="text-slate-400 text-sm italic leading-relaxed">
                  "{deliverable.metadata.review_text as string}"
                </p>
              </div>
            )}

          {/* Copy blocks */}
          <div className="space-y-3">
            {blocks.map((block, i) => (
              <CopyBlock key={i} block={block} />
            ))}
          </div>

          {/* Action buttons */}
          {deliverable.status !== 'posted' && (
            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              {deliverable.status === 'pending' && (
                <button
                  onClick={handleMarkApproved}
                  disabled={isUpdating}
                  className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-50 disabled:cursor-not-allowed text-slate-900 font-semibold text-sm transition-colors flex items-center justify-center gap-2"
                >
                  {isUpdating ? (
                    <>
                      <span className="w-4 h-4 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
                      Approving…
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      Mark Approved
                    </>
                  )}
                </button>
              )}

              <button
                onClick={handleMarkPosted}
                disabled={isUpdating}
                className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2"
              >
                {isUpdating ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Updating…
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    Mark as Posted ✓
                  </>
                )}
              </button>

              {deliverable.status === 'approved' && (
                <button
                  onClick={handleMarkPending}
                  disabled={isUpdating}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-400 text-sm transition-colors"
                >
                  Undo
                </button>
              )}
            </div>
          )}

          {/* Posted state actions */}
          {deliverable.status === 'posted' && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-green-500 text-sm">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Posted {deliverable.posted_at ? timeAgo(deliverable.posted_at) : ''}
              </div>
              <button
                onClick={handleMarkPending}
                disabled={isUpdating}
                className="text-xs text-slate-600 hover:text-slate-400 transition-colors"
              >
                Undo
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
