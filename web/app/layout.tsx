import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'Hospitality God — AI CMO for STR Owners',
    template: '%s | Hospitality God',
  },
  description:
    'Autonomous AI marketing for short-term rental owners. Listing optimization, review management, guest communications, and social content — all done for you.',
  keywords: ['STR marketing', 'Airbnb automation', 'vacation rental marketing', 'AI CMO'],
  openGraph: {
    type: 'website',
    title: 'Hospitality God — AI CMO for STR Owners',
    description: 'Autonomous AI marketing for short-term rental owners.',
    siteName: 'Hospitality God',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-slate-950 text-slate-50 antialiased">
        {children}
      </body>
    </html>
  )
}
