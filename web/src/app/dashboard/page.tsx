'use client'

import { useState, useEffect } from 'react'
import { ScoreChart } from '@/components/dashboard/ScoreChart'
import { DeliverableCard } from '@/components/dashboard/DeliverableCard'
import { CompetitorPanel } from '@/components/dashboard/CompetitorPanel'
import { PropertyOverview } from '@/components/dashboard/PropertyOverview'
import { UpgradeGate } from '@/components/dashboard/UpgradeGate'
import { DashboardHeader } from '@/components/dashboard/DashboardHeader'
import { EmptyDeliverables } from '@/components/dashboard/EmptyDeliverables'

export type Deliverable = {
  id: string
  type: 'listing_copy' | 'social_post' | 'review_response' | 'seasonal_content' | 'guest_message'
  title: string
  content: string
  status: 'pending' | 'approved' | 'dismissed'
  created_at: string
  metadata?: Record<string, unknown>
}

export type ScoreHistory = {
  score: number
  recorded_at: string
  label?: string
}

export type Competitor = {
  name: string
  url?: string
  score?: number
  strengths: string[]
  weaknesses: string[]
  price_per_night?: number
  rating?: number
  review_count?: number
}

export type PropertyData = {
  title: string
  location: string
  platform: string
  listing_url: string
  current_score: number
  score_change: number
  photos_count: number
  amenities_count: number
  rating: number
  review_count: number
  price_per_night: number
  occupancy_rate?: number
  issues: { severity: 'high' | 'medium' | 'low'; message: string }[]
}

export type DashboardData = {
  is_pro: boolean
  property: PropertyData | null
  deliverables: Deliverable[]
  score_history: ScoreHistory[]
  competitors: Competitor[]
  pending_count: number
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeFilter, setActiveFilter] = useState<string>('all')

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/dashboard')
      if (!res.ok) throw new Error('Failed to load dashboard')
      const json = await res.json()
      setData(json)
    } catch (err) {
      setError('Failed to load your dashboard. Please refresh.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleAction = async (
    id: string,
    action: 'approve' | 'dismiss' | 'edit',
    editedContent?: string
  ) => {
    try {
      const res = await fetch(`/api/dashboard/deliverables/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, content: editedContent }),
      })
      if (!res.ok) throw new Error('Failed to update deliverable')

      setData((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          deliverables: prev.deliverables.map((d) => {
            if (d.id !== id) return d
            return {
              ...d,
              status: action === 'approve' ? 'approved' : action === 'dismiss' ? 'dismissed' : d.status,
              content: editedContent ?? d.content,
            }
          }),
          pending_count:
            action === 'approve' || action === 'dismiss'
              ? Math.max(0, prev.pending_count - 1)
              : prev.pending_count,
        }
      })
    } catch (err) {
      console.error('Action failed:', err)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-2 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-slate-400 text-sm">Loading your dashboard…</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center space-y-4 max-w-sm">
          <div className="text-4xl">⚠️</div>
          <p className="text-white font-semibold">{error}</p>
          <button
            onClick={fetchDashboardData}
            className="px-4 py-2 bg-amber-400 text-slate-900 rounded-lg text-sm font-medium hover:bg-amber-300"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  if (!data) return null

  // Gate: redirect free users to upgrade
  if (!data.is_pro) {
    return <UpgradeGate />
  }

  const filteredDeliverables = data.deliverables.filter((d) => {
    if (activeFilter === 'all') return d.status === 'pending'
    if (activeFilter === 'approved') return d.status === 'approved'
    if (activeFilter === 'dismissed') return d.status === 'dismissed'
    return d.type === activeFilter && d.status === 'pending'
  })

  const typeFilters = [
    { id: 'all', label: 'All Pending', count: data.pending_count },
    { id: 'listing_copy', label: 'Listing Copy', count: data.deliverables.filter((d) => d.type === 'listing_copy' && d.status === 'pending').length },
    { id: 'social_post', label: 'Social Posts', count: data.deliverables.filter((d) => d.type === 'social_post' && d.status === 'pending').length },
    { id: 'review_response', label: 'Review Responses', count: data.deliverables.filter((d) => d.type === 'review_response' && d.status === 'pending').length },
    { id: 'seasonal_content', label: 'Seasonal', count: data.deliverables.filter((d) => d.type === 'seasonal_content' && d.status === 'pending').length },
    { id: 'approved', label: 'Approved', count: data.deliverables.filter((d) => d.status === 'approved').length },
  ]

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <DashboardHeader
        propertyTitle={data.property?.title ?? 'Your Property'}
        pendingCount={data.pending_count}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Property Overview + Score */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {data.property && (
            <div className="lg:col-span-1">
              <PropertyOverview property={data.property} />
            </div>
          )}
          <div className="lg:col-span-2">
            <ScoreChart
              scoreHistory={data.score_history}
              currentScore={data.property?.current_score ?? 0}
              scoreChange={data.property?.score_change ?? 0}
            />
          </div>
        </div>

        {/* Competitive Positioning */}
        {data.competitors.length > 0 && (
          <CompetitorPanel
            competitors={data.competitors}
            myScore={data.property?.current_score ?? 0}
            myRating={data.property?.rating ?? 0}
            myPricePerNight={data.property?.price_per_night ?? 0}
          />
        )}

        {/* Deliverables */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">
              Deliverables
              {data.pending_count > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-amber-400 text-slate-900 rounded-full text-xs font-bold">
                  {data.pending_count} pending
                </span>
              )}
            </h2>
          </div>

          {/* Type filter tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {typeFilters.map((f) => (
              <button
                key={f.id}
                onClick={() => setActiveFilter(f.id)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  activeFilter === f.id
                    ? 'bg-amber-400 text-slate-900'
                    : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                }`}
              >
                {f.label}
                {f.count > 0 && (
                  <span
                    className={`ml-1.5 text-xs ${
                      activeFilter === f.id ? 'text-slate-700' : 'text-slate-500'
                    }`}
                  >
                    {f.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Deliverable cards */}
          {filteredDeliverables.length === 0 ? (
            <EmptyDeliverables filter={activeFilter} />
          ) : (
            <div className="space-y-4">
              {filteredDeliverables.map((deliverable) => (
                <DeliverableCard
                  key={deliverable.id}
                  deliverable={deliverable}
                  onAction={handleAction}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
