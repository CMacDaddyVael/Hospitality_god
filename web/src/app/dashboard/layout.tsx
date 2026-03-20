import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Dashboard — Hospitality God',
  description: 'Your AI CMO command center',
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
