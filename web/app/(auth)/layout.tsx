import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sign In',
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex flex-col">
      {/* Background decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-amber-400/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-amber-400/5 blur-3xl" />
      </div>

      <div className="relative flex flex-1 flex-col items-center justify-center px-4 py-12">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-500 shadow-lg shadow-amber-400/25">
            <span className="text-2xl">🏨</span>
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white tracking-tight">Hospitality God</h1>
            <p className="text-sm text-slate-400 mt-0.5">Your AI CMO for short-term rentals</p>
          </div>
        </div>

        {children}
      </div>
    </div>
  )
}
