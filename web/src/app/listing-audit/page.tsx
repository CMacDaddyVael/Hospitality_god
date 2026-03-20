import { Metadata } from 'next'
import { AuditEntryForm } from '@/components/audit/AuditEntryForm'

export const metadata: Metadata = {
  title: 'Free Listing Audit — VAEL Host',
  description:
    'Paste your Airbnb or Vrbo listing URL and get a free, instant audit score. See exactly what\'s holding your listing back.',
}

export default function ListingAuditPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex flex-col">
      {/* Nav bar — minimal, no auth required */}
      <header className="w-full px-6 py-5 flex items-center justify-between max-w-6xl mx-auto">
        <div className="flex items-center gap-2">
          <span className="text-amber-400 font-bold text-xl tracking-tight">VAEL</span>
          <span className="text-slate-400 text-sm font-medium">Host</span>
        </div>
        <span className="text-slate-500 text-xs hidden sm:block">Free audit — no account required</span>
      </header>

      {/* Hero + Form */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12 sm:py-16">
        <div className="w-full max-w-2xl mx-auto space-y-10">
          {/* Hero copy */}
          <div className="text-center space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-400/10 border border-amber-400/20 text-amber-400 text-xs font-semibold uppercase tracking-wider mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              Free — takes 60 seconds
            </div>

            <h1 className="text-4xl sm:text-5xl font-bold text-white leading-tight tracking-tight">
              Is your listing leaving{' '}
              <span className="text-amber-400">money on the table?</span>
            </h1>

            <p className="text-slate-400 text-lg sm:text-xl max-w-xl mx-auto leading-relaxed">
              Paste your Airbnb or Vrbo URL and we'll score your listing in under a
              minute — photos, title, description, pricing signals, and more.
            </p>
          </div>

          {/* The form */}
          <AuditEntryForm />

          {/* Social proof / trust signals */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8 text-slate-500 text-sm">
            <div className="flex items-center gap-1.5">
              <svg className="w-4 h-4 text-emerald-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              No account needed
            </div>
            <div className="flex items-center gap-1.5">
              <svg className="w-4 h-4 text-emerald-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              100% free
            </div>
            <div className="flex items-center gap-1.5">
              <svg className="w-4 h-4 text-emerald-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              We never touch your accounts
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="w-full px-6 py-6 text-center text-slate-600 text-xs">
        © {new Date().getFullYear()} VAEL Host · AI CMO for short-term rental owners
      </footer>
    </main>
  )
}
