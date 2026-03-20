/**
 * Shared type definitions for the weekly brief pipeline.
 * Kept separate so they can be imported by both the pipeline and the email renderer.
 */

export interface DeliverableItem {
  id: string
  title: string
  summary: string
  status: 'pending' | 'approved' | string
  propertyName: string
  createdAt: string
  deepLink: string
}

export interface DeliverableGroup {
  type: string
  label: string
  icon: string
  description: string
  items: DeliverableItem[]
  count: number
}

export interface ScoreDelta {
  previous: number
  current: number
  delta: number
  propertyName: string
}

export interface WeeklyBriefData {
  hasContent: boolean
  ownerName: string
  deliverableGroups?: DeliverableGroup[]
  scoreDelta?: ScoreDelta | null
  weekOf?: string
  dashboardUrl?: string
}
