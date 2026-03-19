'use client'

import { useState } from 'react'
import { DeliverablesInbox } from './DeliverablesInbox'
import { ScoreWidget } from './ScoreWidget'
import { PropertySettings } from './PropertySettings'

export type ContentItem = {
  id: string
  user_id: string
  property_id: string | null
  type: 'social_post' | 'listing_rewrite' | 'review_response' | 'guest_message' | 'seo_content' | 'seasonal_update'
  title: string
  body: string
  status: 'pending' | 'approved' | 'dismissed'
  platform: string | null
  metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export type Property = {
  id: string
  user_id: string
  platform: 'airbnb' | 'vrbo' | 'website' | 'other'
  url: string
  nickname: string | null
  created_at: string
  updated_at: string
}

export type AuditScore = {
  id: string
  user_id: string
  property_id: string | null
  score: number
  breakdown: Record<string, unknown> | null
  created_at: string
}

type DashboardShellProps = {
  userId: string
  initialContent: ContentItem[]
  initialProperties: Property[]
  auditScores: AuditScore[]
}

type Tab = 'inbox' | 'scores' | 'settings'

export function DashboardShell({
  userId,
  initialContent,
  initialProperties,
  auditScores,
}: DashboardShellProps) {
  const [activeTab, setActiveTab] = useState<Tab>('inbox')
  const [content, setContent] = useState<ContentItem[]>(initialContent)
  const [properties, setProperties] = useState<Property[]>(initialProperties)

  const pendingCount = content.filter((c) => c.status === 'pending').length

  const tabs: { id: Tab; label: string; icon: string; badge?: number }[] = [
    { id: 'inbox', label: 'Deliverables', icon: '📬', badge: pendingCount || undefined },
    { id: 'scores', label: 'Scores', icon: '📊' },
    { id: 'settings', label: 'Properties', icon: '🏡' },
  ]

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Top nav */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-amber-400">Hospitality God</span>
            <span className="hidden sm:inline-block text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">
              Pro
            </span>
          </div>
          <div className="text-xs text-slate-500">
            Your swarm is working
            <span className="inline-block ml-1 w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
          </div>
        </div>
      </header>

      {/* Tab bar */}
      <div className="border-b border-slate-800 bg-slate-900/50 sticky top-[57px] z-10">
        <div className="max-w-5xl mx-auto px-4">
          <nav className="flex gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-1.5 px-3 sm:px-4 py-3.5 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'text-amber-400 border-b-2 border-amber-400'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span className="text-base">{tab.icon}</span>
                <span className="hidden sm:inline">{tab.label}</span>
                {tab.badge != null && tab.badge > 0 && (
                  <span className="ml-1 bg-amber-400 text-slate-900 text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-4 py-6">
        {activeTab === 'inbox' && (
          <DeliverablesInbox
            content={content}
            onContentChange={setContent}
          />
        )}
        {activeTab === 'scores' && (
          <ScoreWidget
            properties={properties}
            auditScores={auditScores}
          />
        )}
        {activeTab === 'settings' && (
          <PropertySettings
            userId={userId}
            properties={properties}
            onPropertiesChange={setProperties}
          />
        )}
      </main>
    </div>
  )
}
