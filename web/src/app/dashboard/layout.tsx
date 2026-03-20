import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Dashboard — VAEL Host',
  description: 'Your AI CMO dashboard',
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Top nav */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="text-amber-400 font-bold text-xl tracking-tight">VAEL</span>
            <span className="text-slate-400 text-sm font-medium hidden sm:block">Host</span>
          </Link>

          <nav className="hidden md:flex items-center gap-6">
            <Link href="/dashboard" className="text-slate-400 hover:text-white text-sm transition-colors">
              Overview
            </Link>
            <Link href="/dashboard/deliverables" className="text-slate-400 hover:text-white text-sm transition-colors">
              Deliverables
            </Link>
            <Link href="/dashboard/optimization" className="text-slate-400 hover:text-white text-sm transition-colors">
              Optimization
            </Link>
            <Link href="/dashboard/competitors" className="text-slate-400 hover:text-white text-sm transition-colors">
              Competitors
            </Link>
            <Link href="/dashboard/photos" className="text-slate-400 hover:text-white text-sm transition-colors">
              Photos
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-400/10 border border-amber-400/30 text-amber-400 text-xs font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              Pro
            </span>
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  )
}
