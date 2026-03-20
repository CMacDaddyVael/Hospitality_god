export function AuditSkeleton() {
  return (
    <div className="min-h-screen bg-slate-950 text-white animate-pulse">
      {/* Header skeleton */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 py-4">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <div className="h-6 w-32 bg-slate-800 rounded" />
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8 pb-32 lg:pb-8 lg:grid lg:grid-cols-3 lg:gap-8">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Score ring skeleton */}
          <div className="bg-slate-900 rounded-2xl p-8 flex flex-col items-center gap-4">
            <div className="w-48 h-48 rounded-full bg-slate-800" />
            <div className="h-6 w-48 bg-slate-800 rounded" />
            <div className="h-4 w-64 bg-slate-800 rounded" />
          </div>

          {/* Categories skeleton */}
          <div className="bg-slate-900 rounded-2xl p-6 space-y-4">
            <div className="h-5 w-40 bg-slate-800 rounded" />
            {[...Array(5)].map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="flex justify-between">
                  <div className="h-4 w-24 bg-slate-800 rounded" />
                  <div className="h-4 w-8 bg-slate-800 rounded" />
                </div>
                <div className="h-2 w-full bg-slate-800 rounded-full" />
                <div className="h-3 w-3/4 bg-slate-800 rounded" />
              </div>
            ))}
          </div>

          {/* Recommendations skeleton */}
          <div className="bg-slate-900 rounded-2xl p-6 space-y-4">
            <div className="h-5 w-48 bg-slate-800 rounded" />
            {[...Array(4)].map((_, i) => (
              <div key={i} className="border border-slate-800 rounded-xl p-4 space-y-2">
                <div className="flex gap-2">
                  <div className="h-5 w-16 bg-slate-800 rounded-full" />
                  <div className="h-5 w-40 bg-slate-800 rounded" />
                </div>
                <div className="h-4 w-full bg-slate-800 rounded" />
                <div className="h-4 w-5/6 bg-slate-800 rounded" />
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar skeleton — desktop */}
        <div className="hidden lg:block">
          <div className="sticky top-6 bg-slate-900 rounded-2xl p-6 space-y-4">
            <div className="h-6 w-48 bg-slate-800 rounded" />
            <div className="h-4 w-full bg-slate-800 rounded" />
            <div className="h-4 w-4/5 bg-slate-800 rounded" />
            <div className="h-12 w-full bg-slate-800 rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  )
}
