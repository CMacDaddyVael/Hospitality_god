import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: 'Hospitality God — Your AI Marketing Team for Your Airbnb',
  description:
    'Stop losing bookings to better-marketed listings. Hospitality God is your autonomous AI CMO — it optimizes your listings, manages reviews, and handles guest communication automatically. Beta launching April 2026.',
  keywords: [
    'Airbnb marketing',
    'STR marketing automation',
    'vacation rental marketing',
    'Airbnb listing optimization',
    'AI for Airbnb hosts',
    'short term rental tools',
    'Vrbo marketing',
  ],
  authors: [{ name: 'Hospitality God' }],
  openGraph: {
    title: 'Hospitality God — Your AI Marketing Team for Your Airbnb',
    description:
      'Your autonomous AI CMO for short-term rentals. Does the work, not just the advice.',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hospitality God — Your AI Marketing Team for Your Airbnb',
    description:
      'Your autonomous AI CMO for short-term rentals. Does the work, not just the advice.',
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <meta name="theme-color" content="#0a0a0f" />
      </head>
      <body className={`${inter.className} antialiased`}>{children}</body>
    </html>
  )
}
