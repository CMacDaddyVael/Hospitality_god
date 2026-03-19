import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: {
    default: 'Hospitality God — AI CMO for STR Owners',
    template: '%s | Hospitality God',
  },
  description:
    'Autonomous AI marketing team for short-term rental owners. ' +
    'Analyze your listings, create content, and optimize your presence — daily.',
  keywords: ['short-term rental', 'airbnb marketing', 'AI CMO', 'vacation rental', 'STR marketing'],
  authors: [{ name: 'Hospitality God' }],
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: process.env.NEXT_PUBLIC_APP_URL,
    siteName: 'Hospitality God',
    title: 'Hospitality God — AI CMO for STR Owners',
    description:
      'Autonomous AI marketing team for short-term rental owners. ' +
      'Analyze your listings, create content, and optimize your presence — daily.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hospitality God — AI CMO for STR Owners',
    description: 'Autonomous AI marketing for short-term rental owners.',
  },
  robots: {
    index: true,
    follow: true,
  },
}

export const viewport: Viewport = {
  themeColor: '#0f172a',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-neutral-900 text-neutral-50 antialiased">
        {children}
      </body>
    </html>
  )
}
