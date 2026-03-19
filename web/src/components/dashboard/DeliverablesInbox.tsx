'use client'

import { useState } from 'react'
import type { ContentItem } from './DashboardShell'

type Filter = 'pending' | 'approved' | 'dismissed' | 'all'

type DeliverablesInboxProps = {
  content: ContentItem[]
  onContentChange: (items: ContentItem[]) => void
}

const TYPE_LABELS: Record<ContentItem['type'], string> = {
  social_post: 'Social Post',
  listing_rewrite: 'Listing Rewrite',
  review_response: 'Review Response',
  guest_message: 'Guest Message',
  seo_content: 'SEO Content',
  seasonal_update: 'Seasonal Update',
}

const TYPE_ICONS: Record<ContentItem['type'], string> = {
  social_post: '📱',
  listing_rewrite: '✍️',
  review_response: '⭐',
  guest_message: '💬',
  seo_content: '🔍',
  seasonal_update: '🍂',
}

const PLATFORM_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  airbnb: 'Airbnb',
  vrbo: 'Vrbo',
  website: 'Website',
  email: 'Email',
}

function ContentCard({
  item,
  onApprove,
  onDismiss,
  onRestore,
  isUpdating,
}: {
  item: ContentItem
  onApprove: (id: string) => void
  onDismiss: (id: string) => void
  onRestore: (id: string) => void
  isUpdating: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const preview = item.body.length > 180 ? item.body.slice(0, 180) + '…' : item.body

  return (
    <div
      className={`rounded-xl border transition-all duration-200 ${
        item.status === 'approved'
          ? 'border-green-800/60 bg-green-950/30'
          : item.status === 'dismissed'
          ? 'border-slate-800 bg-slate-900/30 opacity-60'
          : 'border-slate-700 bg-slate-900/60 hover:border-slate-600'
      }`}
    >
      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-lg" aria-hidden>
              {TYPE_ICONS[item.type]}
            </span>
            <span className="text-xs font-semibold text-slate-300 bg-slate-800 px-2 py-0.5 rounded-full">
              {TYPE_LABELS[item.type]}
            </span>
            {item.platform && PLATFORM_LABELS[item.platform] && (
              <span className="text-xs text-slate-400 bg-slate-800/60 px-2 py-0.5 rounded-full">
                {PLATFORM_LABELS[item.platform]}
              </span>
            )}
            {item.status === 'approved' && (
              <span className="text-xs font-medium text-green-400 bg-green-950 px-2 py-0.5 rounded-full">
                ✓ Approved
              </span>
            )}
            {item.status === 'dismissed' && (
              <span className="text-xs font-medium text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">
                Dismissed
              </span>
            )}
          </div>
          <span className="text-xs text-slate-500 whitespace-nowrap flex-shrink-0">
            {formatDate(item.created_at)}
          </span>
        </div>

        {/* Title */}
        <h3 className="font-semibold text-white text-sm mb-2 leading-snug">{item.title}</h3>

        {/* Body preview */}
        <div className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
          {expanded ? item.body : preview}
        </div>
        {item.body.length > 180 && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="mt-1 text-xs text-amber-400 hover:text-amber-300 transition-colors"
          >
            {expanded ? 'Show less' : 'Show more'}
          </button>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 mt-4">
          {item.status === 'pending' && (
            <>
              <button
                onClick={() => onApprove(item.id)}
                disabled={isUpdating}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-slate-900 font-semibold text-sm rounded-lg transition-colors"
              >
                {isUpdating ? (
                  <span className="inline-block w-3 h-3 border-2 border-slate-900/40 border-t-slate-900 rounded-full animate-spin" />
                ) : (
                  '✓'
                )}
                Approve
              </button>
              <button
                onClick={() => onDismiss(item.id)}
                disabled={isUpdating}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 font-medium text-sm rounded-lg transition-colors border border-slate-700"
              >
                Dismiss
              </button>
            </>
          )}
          {item.status === 'approved' && (
            <button
              onClick={() => onRestore(item.id)}
              disabled={isUpdating}
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              Undo
            </button>
          )}
          {item.status === 'dismissed' && (
            <button
              onClick={() => onRestore(item.id)}
              disabled={isUpdating}
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              Restore
            </button>
          )}

          {/* Copy button for approved items */}
          {item.status === 'approved' && (
            <CopyButton text={item.body} />
          )}
        </div>
      </div>
    </div>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback
    }
  }

  return (
    <button
      onClick={handleCopy}
      className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors border border-slate-700"
    >
      {copied ? '✓ Copied!' : '📋 Copy'}
    </button>
  )
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffHours / 24)

  if (diffHours < 1) return 'Just now'
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function DeliverablesInbox({ content, onContentChange }: DeliverablesInboxProps) {
  const [filter, setFilter] = useState<Filter>('pending')
  const [updating, setUpdating] = useState<Set<string>>(new Set())

  const updateStatus = async (id: string, status: 'approved' | 'dismissed' | 'pending') => {
    // Optimistic update
    const prev = content
    onContentChange(
      content.map((item) =>
        item.id === id ? { ...item, status, updated_at: new Date().toISOString() } : item
      )
    )

    setUpdating((s) => new Set(s).add(id))

    try {
      const res = await fetch('/api/dashboard/content', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      })
      if (!res.ok) throw new Error('Failed')
    } catch {
      // Revert on failure
      onContentChange(prev)
    } finally {
      setUpdating((s) => {
        const next = new Set(s)
        next.delete(id)
        return next
      })
    }
  }

  const filtered = content.filter((item) =>
    filter === 'all' ? true : item.status === filter
  )

  const pendingCount = content.filter((c) => c.status === 'pending').length
  const approvedCount = content.filter((c) => c.status === 'approved').length
  const dismissedCount = content.filter((c) => c.status === 'dismissed').length

  const filterOptions: { id: Filter; label: string; count: number }[] = [
    { id: 'pending', label: 'Pending', count: pendingCount },
    { id: 'approved', label: 'Approved', count: approvedCount },
    { id: 'dismissed', label: 'Dismissed', count: dismissedCount },
    { id: 'all', label: 'All', count: content.length },
  ]

  // Empty state — no content at all
  if (content.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center px-4">
        <div className="text-6xl mb-4">🐝</div>
        <h2 className="text-xl font-bold text-white mb-2">Your swarm is getting to work</h2>
        <p className="text-slate-400 text-sm max-w-sm">
          We're analyzing your listing and preparing your first deliverables. Check back
          in a few minutes — or we'll email you when they're ready.
        </p>
        <div className="mt-6 flex items-center gap-2 text-xs text-slate-500 bg-slate-900 border border-slate-800 rounded-full px-4 py-2">
          <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse" />
          Agents running in the background…
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-bold text-white">Deliverables Inbox</h1>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-5 bg-slate-900 border border-slate-800 rounded-xl p-1 w-fit">
        {filterOptions.map((opt) => (
          <button
            key={opt.id}
            onClick={() => setFilter(opt.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === opt.id
                ? 'bg-slate-700 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {opt.label}
            {opt.count > 0 && (
              <span
                className={`text-xs px-1.5 py-0.5 rounded-full ${
                  filter === opt.id
                    ? opt.id === 'pending'
                      ? 'bg-amber-400 text-slate-900'
                      : 'bg-slate-600 text-slate-200'
                    : 'bg-slate-800 text-slate-500'
                }`}
              >
                {opt.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content list */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          {filter === 'pending' && (
            <p className="text-sm">
              🎉 You're all caught up! No pending deliverables.
            </p>
          )}
          {filter === 'approved' && <p className="text-sm">No approved items yet.</p>}
          {filter === 'dismissed' && <p className="text-sm">No dismissed items.</p>}
          {filter === 'all' && <p className="text-sm">No items found.</p>}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => (
            <ContentCard
              key={item.id}
              item={item}
              onApprove={(id) => updateStatus(id, 'approved')}
              onDismiss={(id) => updateStatus(id, 'dismissed')}
              onRestore={(id) => updateStatus(id, 'pending')}
              isUpdating={updating.has(item.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
