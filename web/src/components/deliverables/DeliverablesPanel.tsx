'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { DeliverableCard } from './DeliverableCard'
import { CompletedDeliverables } from './CompletedDeliverables'

export type DeliverableType = 'social_post' | 'review_response' | 'competitive_intel' | 'listing_optimization'

export type Deliverable = {
  id: string
  property_id: string
  type: DeliverableType
  content: string
  status: 'pending_approval' | 'edited_approved' | 'used'
  created_at: string
  used_at: string | null
  metadata?: Record<string, unknown>
}

const TYPE_CONFIG: Record<DeliverableType, { label: string; icon: string; color: string }> = {
  social_post: {
    label: 'Social Post',
    icon: '📱',
    color: 'bg-purple-500/10 text-purple-300 border-purple-500/20',
  },
  review_response: {
    label: 'Review Response',
    icon: '⭐',
    color: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
  },
  competitive_intel: {
    label: 'Competitive Intel',
    icon: '🔍',
    color: 'bg-blue-500/10 text-blue-300 border-blue-500/20',
  },
  listing_optimization: {
    label: 'Listing Optimization',
    icon: '✨',
    color: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
  },
}

const TYPE_ORDER: DeliverableType[] = [
  'social_post',
  'review_response',
  'competitive_intel',
  'listing_optimization',
]

export function DeliverablesPanel() {
  const [pending, setPending] = useState<Deliverable[]>([])
  const [completed, setCompleted] = useState<Deliverable[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  const fetchDeliverables = useCallback(async () => {
    try {
      setError(null)

      // Get current user
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()

      if (authError || !user) {
        setError('Please sign in to view your deliverables.')
        setIsLoading(false)
        return
      }

      // Get user's property IDs
      const { data: properties, error: propError } = await supabase
        .from('properties')
        .select('id')
        .eq('user_id', user.id)

      if (propError) {
        console.error('Property fetch error:', propError)
        setError('Failed to load properties.')
        setIsLoading(false)
        return
      }

      if (!properties || properties.length === 0) {
        setPending([])
        setCompleted([])
        setIsLoading(false)
        return
      }

      const propertyIds = properties.map((p) => p.id)

      // Fetch pending deliverables
      const { data: pendingData, error: pendingError } = await supabase
        .from('deliverables')
        .select('*')
        .in('property_id', propertyIds)
        .eq('status', 'pending_approval')
        .order('created_at', { ascending: false })

      if (pendingError) {
        console.error('Pending deliverables error:', pendingError)
        setError('Failed to load deliverables.')
        setIsLoading(false)
        return
      }

      // Fetch completed deliverables (used + edited_approved)
      const { data: completedData, error: completedError } = await supabase
        .from('deliverables')
        .select('*')
        .in('property_id', propertyIds)
        .in('status', ['used', 'edited_approved'])
        .order('used_at', { ascending: false })
        .limit(20)

      if (completedError) {
        console.error('Completed deliverables error:', completedError)
        // Non-fatal — just don't show completed
      }

      setPending((pendingData as Deliverable[]) || [])
      setCompleted((completedData as Deliverable[]) || [])
    } catch (err) {
      console.error('fetchDeliverables error:', err)
      setError('Something went wrong. Please refresh and try again.')
    } finally {
      setIsLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    fetchDeliverables()
  }, [fetchDeliverables])

  // Real-time subscription for pending_approval deliverables
  useEffect(() => {
    const channel = supabase
      .channel('deliverables-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'deliverables',
        },
        () => {
          // Re-fetch on any change
          fetchDeliverables()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, fetchDeliverables])

  const handleMarkUsed = useCallback(
    async (id: string) => {
      // Optimistic update
      const item = pending.find((d) => d.id === id)
      if (!item) return

      setPending((prev) => prev.filter((d) => d.id !== id))
      const usedAt = new Date().toISOString()
      setCompleted((prev) => [{ ...item, status: 'used', used_at: usedAt }, ...prev])

      const { error } = await supabase
        .from('deliverables')
        .update({ status: 'used', used_at: usedAt })
        .eq('id', id)

      if (error) {
        console.error('Mark used error:', error)
        // Revert optimistic update
        setPending((prev) => [item, ...prev])
        setCompleted((prev) => prev.filter((d) => d.id !== id))
      }
    },
    [pending, supabase]
  )

  const handleSaveEdit = useCallback(
    async (id: string, newContent: string) => {
      // Optimistic update
      const item = pending.find((d) => d.id === id)
      if (!item) return

      setPending((prev) =>
        prev.map((d) => (d.id === id ? { ...d, content: newContent } : d))
      )

      const { error } = await supabase
        .from('deliverables')
        .update({ content: newContent, status: 'edited_approved' })
        .eq('id', id)

      if (error) {
        console.error('Save edit error:', error)
        // Revert
        setPending((prev) =>
          prev.map((d) => (d.id === id ? { ...d, content: item.content } : d))
        )
        throw error
      }

      // Move to completed
      const usedAt = new Date().toISOString()
      setPending((prev) => prev.filter((d) => d.id !== id))
      setCompleted((prev) => [
        { ...item, content: newContent, status: 'edited_approved', used_at: usedAt },
        ...prev,
      ])
    },
    [pending, supabase]
  )

  // Group pending by type
  const pendingByType = TYPE_ORDER.reduce<Record<DeliverableType, Deliverable[]>>(
    (acc, type) => {
      acc[type] = pending.filter((d) => d.type === type)
      return acc
    },
    {
      social_post: [],
      review_response: [],
      competitive_intel: [],
      listing_optimization: [],
    }
  )

  const pendingCount = pending.length

  if (isLoading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400 text-sm">Loading your deliverables…</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-[400px] flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <div className="text-4xl mb-3">⚠️</div>
          <h3 className="text-white font-semibold mb-2">Unable to load deliverables</h3>
          <p className="text-slate-400 text-sm mb-4">{error}</p>
          <button
            onClick={fetchDeliverables}
            className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-slate-900 font-semibold rounded-lg text-sm transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Deliverables</h1>
          <p className="text-slate-400 text-sm mt-1">
            Review, edit, and mark content as used — then copy-paste to post.
          </p>
        </div>
        {pendingCount > 0 && (
          <div className="flex-shrink-0 flex items-center gap-2 bg-amber-400/10 border border-amber-400/20 rounded-xl px-4 py-2">
            <span className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
            <span className="text-amber-300 font-semibold text-sm">
              {pendingCount} pending
            </span>
          </div>
        )}
      </div>

      {/* Empty state */}
      {pendingCount === 0 && (
        <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-12 text-center">
          <div className="text-5xl mb-4">🎉</div>
          <h3 className="text-white font-semibold text-lg mb-2">You're all caught up!</h3>
          <p className="text-slate-400 text-sm max-w-sm mx-auto">
            No pending deliverables right now. Your AI team is working on the next
            batch — check back soon or wait for your weekly brief.
          </p>
        </div>
      )}

      {/* Pending deliverables grouped by type */}
      {pendingCount > 0 &&
        TYPE_ORDER.map((type) => {
          const items = pendingByType[type]
          if (items.length === 0) return null
          const config = TYPE_CONFIG[type]

          return (
            <section key={type} className="space-y-4">
              {/* Section header */}
              <div className="flex items-center gap-3">
                <span className="text-lg">{config.icon}</span>
                <h2 className="text-white font-semibold">{config.label}</h2>
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${config.color}`}
                >
                  {items.length}
                </span>
              </div>

              {/* Cards */}
              <div className="space-y-3">
                {items.map((deliverable) => (
                  <DeliverableCard
                    key={deliverable.id}
                    deliverable={deliverable}
                    typeConfig={config}
                    onMarkUsed={handleMarkUsed}
                    onSaveEdit={handleSaveEdit}
                  />
                ))}
              </div>
            </section>
          )
        })}

      {/* Completed section */}
      {completed.length > 0 && (
        <CompletedDeliverables items={completed} typeConfig={TYPE_CONFIG} />
      )}
    </div>
  )
}
