import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-16">
      <div className="max-w-3xl w-full text-center">
        {/* Logo / Badge */}
        <div className="inline-flex items-center gap-2 bg-brand-900/50 border border-brand-700/50 rounded-full px-4 py-1.5 mb-8">
          <span className="text-brand-500 text-sm font-medium">✦ Hospitality God</span>
          <span className="text-gray-400 text-sm">AI CMO for STR Owners</span>
        </div>

        <h1 className="text-5xl font-bold tracking-tight mb-6 bg-gradient-to-br from-white via-gray-100 to-gray-400 bg-clip-text text-transparent">
          Your listing is leaving money on the table.
        </h1>
        <p className="text-xl text-gray-400 mb-10 leading-relaxed">
          Paste your Airbnb or Vrbo listing. Get a rewritten title, description,
          and tags that rank higher and book faster — in 30 seconds.
        </p>

        <Link
          href="/listings/optimize"
          className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white font-semibold px-8 py-4 rounded-xl text-lg transition-colors"
        >
          Optimize My Listing Free
          <span>→</span>
        </Link>

        <p className="mt-4 text-sm text-gray-500">
          No account required. See results instantly.
        </p>

        {/* Feature hints */}
        <div className="mt-20 grid grid-cols-1 sm:grid-cols-3 gap-6 text-left">
          {[
            {
              icon: "🔍",
              title: "Search-Optimized Title",
              desc: "Keyword-rich titles under 50 chars that rank on Airbnb and Vrbo search.",
            },
            {
              icon: "✍️",
              title: "Scannable Description",
              desc: "Structured copy with amenity highlights guests actually read.",
            },
            {
              icon: "🏷️",
              title: "5 Targeted Tags",
              desc: "Relevant tags that surface your listing in the right searches.",
            },
          ].map((f) => (
            <div
              key={f.title}
              className="bg-gray-900 border border-gray-800 rounded-xl p-5"
            >
              <div className="text-2xl mb-3">{f.icon}</div>
              <div className="font-semibold text-white mb-1">{f.title}</div>
              <div className="text-sm text-gray-400">{f.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
