import { Resend } from 'resend'

if (!process.env.RESEND_API_KEY) {
  console.warn('[Resend] RESEND_API_KEY not set — email sending will fail')
}

export const resend = new Resend(process.env.RESEND_API_KEY ?? '')

export const FROM_ADDRESS = process.env.EMAIL_FROM ?? 'VAEL Host <briefs@vael.host>'
export const REPLY_TO = process.env.EMAIL_REPLY_TO ?? 'support@vael.host'
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.vael.host'
