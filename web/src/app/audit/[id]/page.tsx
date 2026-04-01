import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { AuditResultsClient } from '@/components/audit/AuditResultsClient'
import { getAuditById } from '@/lib/audit/getAudit'

type Props = {
  params: { id: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const audit = await getAuditById(params.id)
  if (!audit) {
    return { title: 'Audit Not Found — Hospitality God' }
  }
  const score = audit.overall_score ?? 0
  return {
    title: `Listing Audit: ${score}/100 — Hospitality God`,
    description: `Your listing scored ${score}/100. See exactly what's hurting your bookings and how to fix it.`,
  }
}

export default async function AuditPage({ params }: Props) {
  const audit = await getAuditById(params.id)

  // If audit doesn't exist at all, 404
  if (audit === null) {
    notFound()
  }

  return <AuditResultsClient audit={audit} auditId={params.id} />
}
