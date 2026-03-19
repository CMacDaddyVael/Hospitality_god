import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="max-w-2xl w-full text-center space-y-8">
        {/* Logo / Brand */}
        <div className="space-y-2">
          <div className="text-5xl">🏨</div>
          <h1 className="text-4xl font-bold tracking-tight">
            Hospitality God
          </h1>
          <p className="text-gray-400 text-lg">
            Autonomous AI CMO for short-term rental owners.
            <br />
            <span className="text-purple-400 font-medium">
              Not advice — execution.
            </span>
          </p>
        </div>

        {/* Feature cards */}
        <div className="grid grid-cols-1 gap-4 text-left">
          <Link
            href="/onboarding"
            className="group block p-5 bg-gray-900 border border-gray-800 rounded-xl hover:border-purple-500 transition-all"
          >
            <div className="flex items-start gap-4">
              <div className="text-2xl">⚙️</div>
              <div>
                <h3 className="font-semibold text-white group-hover:text-purple-400 transition-colors">
                  Set Your Voice
                </h3>
                <p className="text-gray-400 text-sm mt-1">
                  Calibrate how the AI sounds like you — tone, length, phrases
                  to avoid.
                </p>
              </div>
            </div>
          </Link>

          <Link
            href="/app/reviews"
            className="group block p-5 bg-gray-900 border border-gray-800 rounded-xl hover:border-purple-500 transition-all"
          >
            <div className="flex items-start gap-4">
              <div className="text-2xl">⭐</div>
              <div>
                <h3 className="font-semibold text-white group-hover:text-purple-400 transition-colors">
                  Review Manager
                </h3>
                <p className="text-gray-400 text-sm mt-1">
                  AI drafts responses to every guest review in your voice.
                  One-click approve and copy.
                </p>
              </div>
            </div>
          </Link>
        </div>

        <p className="text-gray-600 text-sm">
          Save 20-40 minutes per week on review responses alone.
        </p>
      </div>
    </main>
  );
}
