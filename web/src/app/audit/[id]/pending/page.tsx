import Link from 'next/link'

interface Props {
  params: Promise<{ id: string }>
}

export default async function AuditPendingPage({ params }: Props) {
  const { id } = await params

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white flex flex-col">
      {/* Nav */}
      <nav className="px-6 py-5 flex items-center max-w-6xl mx-auto w-full">
        <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <span className="text-xl font-bold tracking-tight text-white">VAEL Host</span>
          <span className="text-xs bg-amber-400/20 text-amber-400 px-2 py-0.5 rounded-full font-medium border border-amber-400/30">
            Beta
          </span>
        </Link>
      </nav>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="max-w-lg w-full text-center">
          {/* Animated icon */}
          <div className="relative mx-auto w-20 h-20 mb-8">
            {/* Outer pulse ring */}
            <div className="absolute inset-0 rounded-full bg-amber-400/20 animate-ping" />
            {/* Inner circle */}
            <div className="relative w-20 h-20 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center">
              <span className="text-3xl" role="img" aria-label="Robot analyzing">🤖</span>
            </div>
          </div>

          <h1 className="text-3xl sm:text-4xl font-bold mb-4">
            Analyzing your listing…
          </h1>

          <p className="text-slate-400 text-lg leading-relaxed mb-3">
            We&apos;re running your audit now. This usually takes about{' '}
            <span className="text-white font-medium">2 minutes</span>.
          </p>

          <p className="text-slate-500 text-base mb-10">
            Your results will be sent to your email as soon as they&apos;re ready.
            You can close this tab.
          </p>

          {/* Progress steps */}
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 text-left mb-8">
            <p className="text-xs text-slate-500 uppercase tracking-widest mb-4 font-medium">
              What we&apos;re checking
            </p>
            <ul className="space-y-3">
              {AUDIT_STEPS.map((step, i) => (
                <li key={i} className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-amber-400/20 border border-amber-400/40 flex items-center justify-center flex-shrink-0">
                    <span className="text-amber-400 text-xs">{step.icon}</span>
                  </div>
                  <span className="text-sm text-slate-300">{step.label}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Audit ID for reference */}
          <p className="text-xs text-slate-600 font-mono">
            Audit ID: {id}
          </p>

          {/* Back to home */}
          <div className="mt-8">
            <Link
              href="/"
              className="text-sm text-slate-500 hover:text-slate-300 transition-colors underline underline-offset-4"
            >
              ← Run another audit
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-6 text-center">
        <p className="text-xs text-slate-600">
          © {new Date().getFullYear()} VAEL Host · Questions? hello@vaelhost.com
        </p>
      </footer>
    </div>
  )
}

const AUDIT_STEPS = [
  { icon: '📸', label: 'Scoring your photos and visual appeal' },
  { icon: '✍️', label: 'Analyzing title and description quality' },
  { icon: '💰', label: 'Checking pricing against your market' },
  { icon: '⭐', label: 'Reviewing your ratings and review responses' },
  { icon: '🔍', label: 'Evaluating search ranking signals' },
]
