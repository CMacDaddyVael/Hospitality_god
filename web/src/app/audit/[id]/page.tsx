import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { buildFakeAudit } from '@/lib/fake-audit'
import { getAuditResult } from '@/lib/audit-data'
import type { AuditScoreResult } from '@/lib/audit-types'
import { AuditReportCard } from './AuditReportCard'
import { AuditSkeleton } from './AuditSkeleton'

type Props = {
  params: Promise<{ id: string }>
}

async function fetchAudit(id: string): Promise<AuditScoreResult | null> {
  // Always serve the demo audit from fake data (no DB required)
  if (id === 'demo') {
    return buildFakeAudit('demo')
  }

  // Try real data from Supabase
  const result = await getAuditResult(id)
  return result
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const audit = await fetchAudit(id)

  if (!audit) {
    return {
      title: 'Audit Not Found — Hospitality God',
    }
  }

  const scoreLabel =
    audit.overall_score <= 40
      ? 'needs urgent attention'
      : audit.overall_score <= 70
        ? 'has room to grow'
        : 'is performing well'

  return {
    title: `Your Listing Score: ${audit.overall_score}/100 — Hospitality God`,
    description: `Your listing "${audit.listing_title}" scored ${audit.overall_score}/100 and ${scoreLabel}. See exactly what to fix to get more bookings.`,
    openGraph: {
      title: `Listing Score: ${audit.overall_score}/100`,
      description: `See exactly what's holding back your ${audit.location ?? 'rental'} listing — and how to fix it.`,
    },
  }
}

export default async function AuditPage({ params }: Props) {
  const { id } = await params

  return (
    <Suspense fallback={<AuditSkeleton />}>
      <AuditPageInner id={id} />
    </Suspense>
  )
}

async function AuditPageInner({ id }: { id: string }) {
  const audit = await fetchAudit(id)

  if (!audit) {
    notFound()
  }

  return <AuditReportCard audit={audit} />
}
