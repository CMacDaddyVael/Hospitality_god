export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="flex min-h-screen flex-col items-center justify-start py-8 px-4">
        {/* Logo */}
        <div className="mb-8 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-400">
            <span className="text-lg font-bold text-slate-900">H</span>
          </div>
          <span className="text-lg font-semibold text-white">Hospitality God</span>
        </div>
        {children}
      </div>
    </div>
  )
}
