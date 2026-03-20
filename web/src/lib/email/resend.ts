import { Resend } from 'resend'

if (!process.env.RESEND_API_KEY) {
  console.warn('[email] RESEND_API_KEY not set — email sends will be skipped')
}

export const resend = new Resend(process.env.RESEND_API_KEY ?? 'missing')

export const FROM_ADDRESS = process.env.EMAIL_FROM ?? 'VAEL Host <hello@vael.host>'
export const DASHBOARD_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.vael.host'
