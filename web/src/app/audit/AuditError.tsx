'use client'

type Props = {
  message: string
  onRetry: () => void
}

export default function AuditError({ message, onRetry }: Props) {
  return (
    <div className="w-full max-w-md text-center space-y-6">
      <div className="flex justify-center">
        <div className="w-20 h-20 rounded-full bg-red-500/10 border-2 border-red-500/30 flex items-center justify-center">
          <span className="text-4xl">⚠️</span>
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-white">Something went wrong</h2>
        <p className="text-slate-400 text-sm max-w-sm mx-auto">{message}</p>
      </div>

      <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-5 text-left space-y-2">
        <p className="text-slate-300 text-sm font-medium">Common fixes:</p>
        <ul className="text-slate-400 text-sm space-y-1 list-disc list-inside">
          <li>Make sure the listing URL is public and not blocked</li>
          <li>Try copying the URL directly from your browser</li>
          <li>
            The listing should be a full URL like{' '}
            <code className="text-amber-400">airbnb.com/rooms/12345</code>
          </li>
        </ul>
      </div>

      <button
        onClick={onRetry}
        className="px-8 py-3 bg-amber-400 hover:bg-amber-300 text-slate-900 font-bold rounded-xl transition-all duration-200 text-sm"
      >
        ← Try a different URL
      </button>
    </div>
  )
}
