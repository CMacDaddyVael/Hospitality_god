import { resend, FROM_ADDRESS } from './resend'
import { logEmailEvent } from './log'
import type {
  WelcomeTemplateData,
  AuditCompleteTemplateData,
  DeliverablesReadyTemplateData,
} from './templates'
import {
  welcomeTemplate,
  auditCompleteTemplate,
  deliverablesReadyTemplate,
} from './templates'

export type EmailType = 'welcome' | 'audit_complete' | 'deliverable_ready'

interface SendResult {
  success: boolean
  messageId?: string
  error?: string
}

// ─── Welcome Email ────────────────────────────────────────────────────────────

export async function sendWelcomeEmail(
  to: string,
  userId: string,
  data: WelcomeTemplateData
): Promise<SendResult> {
  const { subject, html, text } = welcomeTemplate(data)
  return _send({ to, userId, subject, html, text, type: 'welcome' })
}

// ─── Audit Complete Email ─────────────────────────────────────────────────────

export async function sendAuditCompleteEmail(
  to: string,
  userId: string,
  data: AuditCompleteTemplateData
): Promise<SendResult> {
  const { subject, html, text } = auditCompleteTemplate(data)
  return _send({ to, userId, subject, html, text, type: 'audit_complete' })
}

// ─── Deliverables Ready Email ─────────────────────────────────────────────────

export async function sendDeliverablesReadyEmail(
  to: string,
  userId: string,
  data: DeliverablesReadyTemplateData
): Promise<SendResult> {
  const { subject, html, text } = deliverablesReadyTemplate(data)
  return _send({ to, userId, subject, html, text, type: 'deliverable_ready' })
}

// ─── Internal send wrapper ────────────────────────────────────────────────────

interface InternalSendParams {
  to: string
  userId: string
  subject: string
  html: string
  text: string
  type: EmailType
}

async function _send(params: InternalSendParams): Promise<SendResult> {
  const { to, userId, subject, html, text, type } = params

  // Skip if API key is missing (dev / CI environments)
  if (!process.env.RESEND_API_KEY) {
    console.warn(`[email] Skipping ${type} send to ${to} — RESEND_API_KEY not set`)
    await logEmailEvent({ userId, recipient: to, type, status: 'skipped' })
    return { success: false, error: 'RESEND_API_KEY not configured' }
  }

  try {
    const result = await resend.emails.send({
      from: FROM_ADDRESS,
      to,
      subject,
      html,
      text,
    })

    const messageId = result.data?.id

    await logEmailEvent({
      userId,
      recipient: to,
      type,
      status: 'sent',
      messageId,
    })

    return { success: true, messageId }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    console.error(`[email] Failed to send ${type} to ${to}:`, errorMsg)

    await logEmailEvent({
      userId,
      recipient: to,
      type,
      status: 'failed',
      error: errorMsg,
    })

    return { success: false, error: errorMsg }
  }
}
