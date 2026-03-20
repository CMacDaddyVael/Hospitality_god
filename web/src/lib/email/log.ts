import { createClient } from '@supabase/supabase-js'
import type { EmailType } from './send'

// Use service-role key so we can write from server-side without auth context
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export interface EmailLogEntry {
  userId: string
  recipient: string
  type: EmailType
  status: 'sent' | 'failed' | 'skipped'
  messageId?: string
  error?: string
}

export async function logEmailEvent(entry: EmailLogEntry): Promise<void> {
  try {
    const { error } = await supabase.from('email_log').insert({
      user_id: entry.userId,
      recipient: entry.recipient,
      type: entry.type,
      status: entry.status,
      message_id: entry.messageId ?? null,
      error: entry.error ?? null,
      sent_at: new Date().toISOString(),
    })

    if (error) {
      console.error('[email-log] Failed to write email log:', error.message)
    }
  } catch (err) {
    // Logging must never throw — silently swallow
    console.error('[email-log] Unexpected error:', err)
  }
}

/**
 * Check whether a specific email type has already been sent for a given
 * reference ID (audit_id, deliverable_batch_id, etc.).
 *
 * Used to prevent duplicate sends.
 */
export async function hasEmailBeenSent(
  type: EmailType,
  referenceId: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('email_log')
      .select('id')
      .eq('type', type)
      .eq('reference_id', referenceId)
      .eq('status', 'sent')
      .limit(1)
      .maybeSingle()

    if (error) {
      console.error('[email-log] Duplicate-check query failed:', error.message)
      return false // fail open — let it send rather than silently skip
    }

    return data !== null
  } catch {
    return false
  }
}
