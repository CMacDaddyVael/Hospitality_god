'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'

// ─── Types ───────────────────────────────────────────────────────────────────

type DeliverableStatus = 'pending' | 'approved' | 'revision_requested'

interface Deliverable {
  id: string
  type: string
  content: string
  status: DeliverableStatus
  created_at: string
  approved_at: string | null
  revision_note: string | null
  user_id: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Supabase env vars missing')
  return createClient(url, key)
}

function formatDeliverableType(type: string): string {
  const map: Record<string, string> = {
    listing_copy: 'Listing Copy',
    social_post: 'Social Post',
    review_response: 'Review Response',
    seasonal_update: 'Seasonal Update',
    guest_message: 'Guest Message Template',
    seo_content: 'SEO Content',
  }
  return map[type] ?? type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function typeIcon(type: string): string {
  const icons: Record<string, string> = {
    listing_copy: '🏡',
    social_post: '📸',
    review_response: '⭐',
    seasonal_update: '🍂',
    guest_message: '💬',
    seo_content: '🔍',
  }
  return icons[type] ?? '📄'
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: DeliverableStatus }) {
  if (status === 'approved') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
        Approved
      </span>
    )
  }
  if (status === 'revision_requested') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/15 text-amber-400 border border-amber-500/20">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
        Revision Requested
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/15 text-blue-400 border border-blue-500/20">
      <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
      Pending Review
    </span>
  )
}

// ─── Revision Note Modal ──────────────────────────────────────────────────────

interface RevisionModalProps {
  deliverableId: string
  onConfirm: (id: string, note: string) => Promise<void>
  onClose: () => void
}

function RevisionModal({ deliverableId, onConfirm, onClose }: RevisionModalProps) {
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    setLoading(true)
    try {
      await onConfirm(deliverableId, note)
      onClose()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.65)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="p-6 space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-white">Request a Revision</h3>
            <p className="text-sm text-slate-400 mt-1">
              Optionally tell your AI team what to change. Leave blank to request a general revision.
            </p>
          </div>

          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Make the tone warmer. Mention the hot tub in the first paragraph. Keep it under 150 words."
            rows={4}
            className="w-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400 resize-none"
          />

          <div className="flex gap-3 pt-1">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-slate-600 text-slate-300 text-sm font-medium hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-slate-900 text-sm font-semibold transition-colors"
            >
              {loading ? 'Sending…' : 'Send Revision Request'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Deliverable Card ─────────────────────────────────────────────────────────

interface DeliverableCardProps {
  deliverable: Deliverable
  onApprove: (id: string, editedContent: string) => Promise<void>
  onRequestRevision: (id: string) => void
}

function DeliverableCard({ deliverable, onApprove, onRequestRevision }: DeliverableCardProps) {
  const [editedContent, setEditedContent] = useState(deliverable.content)
  const [approving, setApproving] = useState(false)
  const [copied, setCopied] = useState(false)
  const isApproved = deliverable.status === 'approved'
  const isRevisionRequested = deliverable.status === 'revision_requested'

  const handleApprove = async () => {
    setApproving(true)
    try {
      await onApprove(deliverable.id, editedContent)
    } finally {
      setApproving(false)
    }
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(editedContent)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
        isApproved
          ? 'border-emerald-500/30 bg-slate-800/40'
          : isRevisionRequested
          ? 'border-amber-500/30 bg-slate-800/40'
          : 'border-slate-700 bg-slate-800/60 shadow-lg shadow-slate-900/30'
      }`}
    >
      {/* Card Header */}
      <div className="px-6 py-4 border-b border-slate-700/60 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-2xl flex-shrink-0">{typeIcon(deliverable.type)}</span>
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-white leading-tight">
              {formatDeliverableType(deliverable.type)}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Created {formatDate(deliverable.created_at)}
            </p>
          </div>
        </div>
        <div className="flex-shrink-0">
          <StatusBadge status={deliverable.status} />
        </div>
      </div>

      {/* Content Editor */}
      <div className="px-6 py-4 space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">
            {isApproved ? 'Approved Content' : 'Edit before approving'}
          </label>
          <button
            onClick={handleCopy}
            className="text-xs text-slate-400 hover:text-white transition-colors flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-slate-700"
          >
            {copied ? (
              <>
                <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-emerald-400">Copied!</span>
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copy
              </>
            )}
          </button>
        </div>

        <textarea
          value={editedContent}
          onChange={(e) => setEditedContent(e.target.value)}
          readOnly={isApproved}
          rows={8}
          className={`w-full rounded-xl px-4 py-3 text-sm leading-relaxed resize-y transition-colors focus:outline-none ${
            isApproved
              ? 'bg-slate-900/40 border border-slate-700/50 text-slate-300 cursor-default'
              : 'bg-slate-900 border border-slate-600 text-white placeholder-slate-500 focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400'
          }`}
        />

        {/* Character count */}
        <p className="text-xs text-slate-600 text-right">
          {editedContent.length} characters
        </p>
      </div>

      {/* Approved meta info */}
      {isApproved && deliverable.approved_at && (
        <div className="px-6 pb-4">
          <div className="flex items-center gap-2 text-xs text-emerald-500/80">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Approved on {formatDate(deliverable.approved_at)} — ready to copy and post
          </div>
        </div>
      )}

      {/* Revision note */}
      {isRevisionRequested && deliverable.revision_note && (
        <div className="px-6 pb-4">
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
            <p className="text-xs font-medium text-amber-400 mb-1">Your revision note:</p>
            <p className="text-sm text-amber-200/80">{deliverable.revision_note}</p>
          </div>
        </div>
      )}

      {/* Action Buttons — only show for pending */}
      {deliverable.status === 'pending' && (
        <div className="px-6 pb-5 flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleApprove}
            disabled={approving}
            className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white font-semibold text-sm transition-all duration-150 shadow-md shadow-emerald-900/30"
          >
            {approving ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Approving…
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Approve — Ready to Post
              </>
            )}
          </button>
          <button
            onClick={() => onRequestRevision(deliverable.id)}
            className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-slate-600 hover:border-amber-500/50 hover:bg-amber-500/10 text-slate-300 hover:text-amber-300 font-medium text-sm transition-all duration-150"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Request Revision
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      <div className="w-20 h-20 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center mb-6">
        <span className="text-4xl">✨</span>
      </div>
      <h3 className="text-xl font-semibold text-white mb-2">
        Your marketing team is on it
      </h3>
      <p className="text-slate-400 text-sm max-w-sm leading-relaxed">
        Your AI marketing team is working on this week's content. New deliverables will appear here when they're ready to review.
      </p>
      <div className="mt-6 flex items-center gap-2 text-xs text-slate-600 bg-slate-800/60 border border-slate-700 rounded-full px-4 py-2">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        Swarm is active — check back soon
      </div>
    </div>
  )
}

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({ title, count, accent }: { title: string; count: number; accent?: boolean }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <h2 className={`text-sm font-semibold uppercase tracking-widest ${accent ? 'text-emerald-400' : 'text-slate-400'}`}>
        {title}
      </h2>
      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
        accent
          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
          : 'bg-slate-700 text-slate-400'
      }`}>
        {count}
      </span>
      <div className="flex-1 h-px bg-slate-700/60" />
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DeliverablesPage() {
  const [deliverables, setDeliverables] = useState<Deliverable[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [revisionTargetId, setRevisionTargetId] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // ── Toast helper ──
  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3500)
  }, [])

  // ── Fetch deliverables ──
  useEffect(() => {
    const fetchDeliverables = async () => {
      setLoading(true)
      setError(null)
      try {
        const supabase = getSupabaseClient()

        // Get current user
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
          setError('Please sign in to view your deliverables.')
          setLoading(false)
          return
        }

        const { data, error: fetchError } = await supabase
          .from('deliverables')
          .select('id, type, content, status, created_at, approved_at, revision_note, user_id')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })

        if (fetchError) {
          console.error('Supabase fetch error:', fetchError)
          setError('Failed to load deliverables. Please refresh and try again.')
          return
        }

        setDeliverables(data ?? [])
      } catch (err) {
        console.error('Unexpected error:', err)
        setError('Something went wrong. Please refresh and try again.')
      } finally {
        setLoading(false)
      }
    }

    fetchDeliverables()
  }, [])

  // ── Approve handler ──
  const handleApprove = useCallback(async (id: string, editedContent: string) => {
    try {
      const supabase = getSupabaseClient()

      const { error: updateError } = await supabase
        .from('deliverables')
        .update({
          status: 'approved',
          approved_at: new Date().toISOString(),
          content: editedContent,
        })
        .eq('id', id)

      if (updateError) {
        console.error('Approve error:', updateError)
        showToast('Failed to approve deliverable. Please try again.', 'error')
        return
      }

      setDeliverables((prev) =>
        prev.map((d) =>
          d.id === id
            ? {
                ...d,
                status: 'approved' as const,
                approved_at: new Date().toISOString(),
                content: editedContent,
              }
            : d
        )
      )

      showToast('✅ Approved! Content is ready to copy and post.')
    } catch (err) {
      console.error('Unexpected approve error:', err)
      showToast('Something went wrong. Please try again.', 'error')
    }
  }, [showToast])

  // ── Request Revision handler ──
  const handleRevisionConfirm = useCallback(async (id: string, note: string) => {
    try {
      const supabase = getSupabaseClient()

      const { error: updateError } = await supabase
        .from('deliverables')
        .update({
          status: 'revision_requested',
          revision_note: note || null,
        })
        .eq('id', id)

      if (updateError) {
        console.error('Revision error:', updateError)
        showToast('Failed to send revision request. Please try again.', 'error')
        return
      }

      setDeliverables((prev) =>
        prev.map((d) =>
          d.id === id
            ? {
                ...d,
                status: 'revision_requested' as const,
                revision_note: note || null,
              }
            : d
        )
      )

      showToast('📝 Revision requested — your team will update this soon.')
    } catch (err) {
      console.error('Unexpected revision error:', err)
      showToast('Something went wrong. Please try again.', 'error')
    }
  }, [showToast])

  // ── Partition deliverables ──
  const pending = deliverables.filter((d) => d.status === 'pending')
  const approved = deliverables.filter((d) => d.status === 'approved')
  const revisionRequested = deliverables.filter((d) => d.status === 'revision_requested')

  const hasAnyDeliverables = deliverables.length > 0

  // ── Render ──
  return (
    <div className="min-h-screen bg-slate-900">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl border shadow-2xl text-sm font-medium transition-all duration-300 ${
            toast.type === 'success'
              ? 'bg-slate-800 border-emerald-500/30 text-white'
              : 'bg-slate-800 border-red-500/30 text-red-300'
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Revision Modal */}
      {revisionTargetId && (
        <RevisionModal
          deliverableId={revisionTargetId}
          onConfirm={handleRevisionConfirm}
          onClose={() => setRevisionTargetId(null)}
        />
      )}

      {/* Page Header */}
      <div className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white">Deliverables</h1>
              <p className="text-sm text-slate-400 mt-1">
                Review, edit, and approve your AI-generated marketing content
              </p>
            </div>
            {!loading && hasAnyDeliverables && (
              <div className="flex items-center gap-2 flex-shrink-0">
                {pending.length > 0 && (
                  <span className="text-xs bg-blue-500/15 text-blue-400 border border-blue-500/20 rounded-full px-3 py-1 font-medium">
                    {pending.length} pending
                  </span>
                )}
                {approved.length > 0 && (
                  <span className="text-xs bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 rounded-full px-3 py-1 font-medium">
                    {approved.length} approved
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Loading State */}
        {loading && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-2xl border border-slate-700 bg-slate-800/60 overflow-hidden animate-pulse">
                <div className="px-6 py-4 border-b border-slate-700/60 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-700" />
                    <div className="space-y-1.5">
                      <div className="h-4 w-32 bg-slate-700 rounded" />
                      <div className="h-3 w-24 bg-slate-700/60 rounded" />
                    </div>
                  </div>
                  <div className="h-5 w-20 bg-slate-700 rounded-full" />
                </div>
                <div className="px-6 py-4 space-y-3">
                  <div className="h-32 bg-slate-700/60 rounded-xl" />
                  <div className="flex gap-3">
                    <div className="flex-1 h-11 bg-slate-700 rounded-xl" />
                    <div className="flex-1 h-11 bg-slate-700/60 rounded-xl" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-slate-300 font-medium">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 text-sm text-amber-400 hover:text-amber-300 underline underline-offset-2"
            >
              Try again
            </button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && !hasAnyDeliverables && <EmptyState />}

        {/* Deliverables Content */}
        {!loading && !error && hasAnyDeliverables && (
          <div className="space-y-10">
            {/* Pending Section */}
            {pending.length > 0 && (
              <section>
                <SectionHeader title="Pending Review" count={pending.length} />
                <div className="space-y-5">
                  {pending.map((d) => (
                    <DeliverableCard
                      key={d.id}
                      deliverable={d}
                      onApprove={handleApprove}
                      onRequestRevision={(id) => setRevisionTargetId(id)}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Revision Requested Section */}
            {revisionRequested.length > 0 && (
              <section>
                <SectionHeader title="Revision Requested" count={revisionRequested.length} />
                <div className="space-y-5">
                  {revisionRequested.map((d) => (
                    <DeliverableCard
                      key={d.id}
                      deliverable={d}
                      onApprove={handleApprove}
                      onRequestRevision={(id) => setRevisionTargetId(id)}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Approved Section */}
            {approved.length > 0 && (
              <section>
                <SectionHeader title="Approved — Ready to Post" count={approved.length} accent />
                <div className="space-y-5">
                  {approved.map((d) => (
                    <DeliverableCard
                      key={d.id}
                      deliverable={d}
                      onApprove={handleApprove}
                      onRequestRevision={(id) => setRevisionTargetId(id)}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
