import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { AuditReportCard } from '@/components/audit/AuditReportCard'
import { AuditLoading } from '@/components/audit/AuditLoading'
import { AuditNotFound } from '@/components/audit/AuditNotFound'
import { getAuditByPropertyId } from '@/lib/audit/fetchAudit'

type Props = {
  params: { propertyId: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return {
    title: 'Your Listing Audit Results | VAEL Host',
    description: 'See your free listing score and exactly what to fix to get more bookings.',
  }
}

export default async function AuditResultsPage({ params }: Props) {
  const { propertyId } = params

  if (!propertyId) {
    notFound()
  }

  const audit = await getAuditByPropertyId(propertyId)

  if (!audit) {
    return <AuditNotFound propertyId={propertyId} />
  }

  if (audit.status === 'processing' || audit.status === 'pending') {
    return <AuditLoading propertyId={propertyId} listingTitle={audit.listing_title} />
  }

  if (audit.status === 'failed') {
    return <AuditNotFound propertyId={propertyId} failed />
  }

  return <AuditReportCard audit={audit} />
}
