import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Set Up Your AI Marketing Team — VAEL Host',
  description: 'Tell us about your property so your AI CMO can get to work.',
}

export default function SubscriberOnboardingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {children}
    </div>
  )
}
