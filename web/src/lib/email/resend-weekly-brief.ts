import { Resend } from 'resend'
import { renderWeeklyBriefHtml } from './weekly-brief-template'
import { renderWeeklyBriefText } from './weekly-brief-template-text'
import type { WeeklyBriefData } from './weekly-brief-types'

const resend = new Resend(process.env.RESEND_API_KEY)

const FROM_ADDRESS = process.env.RESEND_FROM_EMAIL ?? 'team@vael.host'
const REPLY_TO = process.env.RESEND_REPLY_TO ?? 'hello@vael.host'

/**
 * Sends the weekly brief email to a single owner via Resend.
 * Throws on failure — the pipeline handles retry logging.
 */
export async function sendWeeklyBrief(
  toEmail: string,
  ownerFirstName: string,
  data: WeeklyBriefData
): Promise<void> {
  const subject = buildSubjectLine(data)
  const htmlBody = renderWeeklyBriefHtml(ownerFirstName, data)
  const textBody = renderWeeklyBriefText(ownerFirstName, data)

  const { error } = await resend.emails.send({
    from: `VAEL Host Team <${FROM_ADDRESS}>`,
    to: toEmail,
    replyTo: REPLY_TO,
    subject,
    html: htmlBody,
    text: textBody,
  })

  if (error) {
    throw new Error(`Resend API error: ${error.message}`)
  }
}

function buildSubjectLine(data: WeeklyBriefData): string {
  const totalDeliverables =
    data.deliverableGroups?.reduce((sum, g) => sum + g.count, 0) ?? 0

  if (data.scoreDelta && data.scoreDelta.delta > 0) {
    return `Your listing score jumped ${data.scoreDelta.delta} points this week 📈`
  }

  if (totalDeliverables === 1) {
    return `Your AI team prepared 1 deliverable this week`
  }

  if (totalDeliverables > 0) {
    return `Your AI team prepared ${totalDeliverables} deliverables this week`
  }

  return `Your weekly marketing brief from VAEL Host`
}
