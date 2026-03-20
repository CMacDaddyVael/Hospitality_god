import type { SubscriberBriefPayload } from '../weekly-brief'

interface TemplateParams extends SubscriberBriefPayload {
  dashboardUrl: string
  unsubscribeUrl: string
  subject: string
}

const DELIVERABLE_TYPE_LABELS: Record<string, string> = {
  social_post: 'Social Post',
  listing_rewrite: 'Listing Rewrite',
  review_response: 'Review Response',
  seasonal_update: 'Seasonal Update',
  guest_message: 'Guest Message',
  seo_content: 'SEO Content',
  competitor_analysis: 'Competitor Analysis',
  image_set: 'Image Set',
}

function typeLabel(type: string): string {
  return DELIVERABLE_TYPE_LABELS[type] ?? type.replace(/_/g, ' ')
}

export function renderWeeklyBriefText(params: TemplateParams): string {
  const {
    propertyName,
    currentScore,
    previousScore,
    scoreDelta,
    deliverables,
    dashboardUrl,
    unsubscribeUrl,
    email,
  } = params

  const lines: string[] = []

  lines.push('VAEL Host — Weekly Marketing Brief')
  lines.push(`Prepared for: ${propertyName}`)
  lines.push(`Date: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`)
  lines.push('')
  lines.push('─'.repeat(60))
  lines.push('')
  lines.push('Your marketing team showed up this week.')
  lines.push(`Here's what we prepared for ${propertyName}.`)
  lines.push('')

  // Score block
  if (currentScore !== null) {
    lines.push('LISTING SCORE')
    lines.push(`Current score: ${currentScore}/100`)
    if (previousScore !== null) {
      lines.push(`Last week: ${previousScore}/100`)
    }
    if (scoreDelta !== null) {
      const sign = scoreDelta >= 0 ? '+' : ''
      const trend = scoreDelta > 0 ? '▲ Up' : scoreDelta < 0 ? '▼ Down' : '→ Unchanged'
      lines.push(`${trend} ${sign}${scoreDelta} pts this week`)
    }
    lines.push('')
    lines.push('─'.repeat(60))
    lines.push('')
  }

  // Deliverables
  lines.push(`READY FOR REVIEW (${deliverables.length} item${deliverables.length !== 1 ? 's' : ''})`)
  lines.push('')

  deliverables.forEach((d, i) => {
    lines.push(`${i + 1}. [${typeLabel(d.type).toUpperCase()}]`)
    lines.push(`   ${d.title}`)
    lines.push(`   ${d.summary}`)
    lines.push('')
  })

  lines.push('─'.repeat(60))
  lines.push('')
  lines.push('REVIEW YOUR DELIVERABLES')
  lines.push(dashboardUrl)
  lines.push('')
  lines.push('Log in to approve, edit, and copy-paste to publish.')
  lines.push('')
  lines.push('─'.repeat(60))
  lines.push('')
  lines.push(`You're receiving this as a VAEL Host Pro subscriber (${email}).`)
  lines.push('Your AI marketing team sends this every Monday.')
  lines.push('')
  lines.push(`Unsubscribe: ${unsubscribeUrl}`)
  lines.push('VAEL Host · AI CMO for STR Owners')

  return lines.join('\n')
}
