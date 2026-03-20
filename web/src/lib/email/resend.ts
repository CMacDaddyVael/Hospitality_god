import { Resend } from 'resend'

if (!process.env.RESEND_API_KEY) {
  throw new Error('RESEND_API_KEY environment variable is required')
}

export const resend = new Resend(process.env.RESEND_API_KEY)

export const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'hello@hospitality.god'
export const FROM_NAME = process.env.RESEND_FROM_NAME || 'Hospitality God'
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.hospitality.god'
