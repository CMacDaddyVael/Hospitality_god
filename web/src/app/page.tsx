"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LandingPage() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleAudit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });

      if (!res.ok) throw new Error("Audit failed. Please check the URL and try again.");

      const data = await res.json();
      // Store audit results and navigate
      sessionStorage.setItem("audit_result", JSON.stringify(data));
      router.push("/audit");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <div className="relative overflow-hidden bg-gradient-to-br from-gray-900 via-green-950 to-gray-900">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(34,197,94,0.15),transparent_50%)]" />
        <div className="relative max-w-5xl mx-auto px-6 pt-12 pb-24">
          {/* Nav */}
          <nav className="flex items-center justify-between mb-20">
            <div className="flex items-center gap-2">
              <span className="text-2xl">⚡</span>
              <span className="text-xl font-bold text-white">Hospitality God</span>
            </div>
            <a href="#audit" className="text-sm text-green-400 hover:text-green-300 transition">
              Get Free Audit →
            </a>
          </nav>

          {/* Hero Content */}
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-full px-4 py-1.5 mb-6">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="text-green-400 text-sm font-medium">Free for Airbnb & Vrbo hosts</span>
            </div>

            <h1 className="text-5xl sm:text-6xl font-bold text-white leading-tight mb-6">
              Your Airbnb listing is leaving money on the table.
              <span className="text-green-400"> We&apos;ll prove it.</span>
            </h1>

            <p className="text-xl text-gray-400 mb-10 max-w-2xl">
              Paste your listing URL. In 60 seconds, get a free audit showing exactly
              what&apos;s wrong with your marketing — and a weekly action plan to fix it. $59/mo.
            </p>

            {/* Audit Form */}
            <form onSubmit={handleAudit} id="audit" className="flex flex-col sm:flex-row gap-3 max-w-xl">
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Paste your Airbnb or Vrbo listing URL..."
                className="flex-1 px-5 py-4 bg-white/10 border border-white/20 rounded-xl text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-lg"
                required
              />
              <button
                type="submit"
                disabled={loading}
                className="px-8 py-4 bg-green-500 hover:bg-green-400 disabled:bg-green-800 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition text-lg whitespace-nowrap"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Analyzing...
                  </span>
                ) : (
                  "Free Audit →"
                )}
              </button>
            </form>

            {error && <p className="mt-3 text-red-400 text-sm">{error}</p>}

            <p className="mt-4 text-gray-500 text-sm">
              No signup required. Takes 60 seconds. Works with Airbnb & Vrbo.
            </p>
          </div>
        </div>
      </div>

      {/* How It Works */}
      <div className="max-w-5xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-bold text-center mb-12">How it works</h2>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              step: "1",
              title: "Free Audit",
              desc: "Paste your listing URL. Our AI analyzes your title, description, photos, reviews, pricing, and competitive positioning. Get a score out of 100.",
              icon: "🔍",
            },
            {
              step: "2",
              title: "Weekly Deliverables",
              desc: "Subscribe for $59/mo. Every week, your AI marketing team creates optimized copy, social posts, review responses, and seasonal content — ready to use.",
              icon: "📦",
            },
            {
              step: "3",
              title: "Copy, Paste, Post",
              desc: "Review what your team prepared, approve what you like, and paste it into Airbnb, Instagram, or wherever you need it. Watch your bookings grow.",
              icon: "📈",
            },
          ].map((item) => (
            <div key={item.step} className="text-center p-6">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-50 rounded-2xl mb-4 text-3xl">
                {item.icon}
              </div>
              <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
              <p className="text-gray-600">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* What You Get */}
      <div className="bg-gray-50 py-20">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-4">Your AI marketing team delivers weekly</h2>
          <p className="text-gray-500 text-center mb-12 max-w-2xl mx-auto">
            Pick what you need. Your team works on it daily and sends you ready-to-use content.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { title: "Listing Optimization", desc: "Rewritten titles, descriptions, and tags optimized for Airbnb's algorithm", icon: "✍️" },
              { title: "Review Responses", desc: "Drafted replies to every guest review — positive and negative — in your voice", icon: "⭐" },
              { title: "Social Content", desc: "Instagram and TikTok posts with AI-generated lifestyle photos of your property", icon: "📸" },
              { title: "Seasonal Updates", desc: "Fresh copy and photos that match the season — winter cozy, summer vibes, holiday charm", icon: "🍂" },
              { title: "Competitive Analysis", desc: "How you compare to nearby listings and what they're doing that you're not", icon: "🏆" },
              { title: "Monthly Report", desc: "Your listing score over time, what improved, and what to focus on next", icon: "📊" },
            ].map((item) => (
              <div key={item.title} className="bg-white rounded-xl border border-gray-200 p-5">
                <span className="text-2xl">{item.icon}</span>
                <h3 className="font-semibold mt-3 mb-1">{item.title}</h3>
                <p className="text-gray-500 text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Pricing */}
      <div className="max-w-5xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-bold text-center mb-12">Simple pricing</h2>
        <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          <div className="border border-gray-200 rounded-2xl p-8">
            <h3 className="font-semibold text-lg mb-1">Free Audit</h3>
            <div className="text-4xl font-bold mb-4">$0</div>
            <ul className="space-y-3 text-gray-600 text-sm mb-8">
              <li className="flex items-start gap-2"><span className="text-green-500 mt-0.5">✓</span> Full listing analysis</li>
              <li className="flex items-start gap-2"><span className="text-green-500 mt-0.5">✓</span> Score out of 100</li>
              <li className="flex items-start gap-2"><span className="text-green-500 mt-0.5">✓</span> Top 5 critical fixes</li>
              <li className="flex items-start gap-2"><span className="text-green-500 mt-0.5">✓</span> Competitive comparison</li>
            </ul>
            <a href="#audit" className="block w-full text-center py-3 border border-gray-300 rounded-xl font-medium hover:bg-gray-50 transition">
              Get Free Audit
            </a>
          </div>
          <div className="border-2 border-green-500 rounded-2xl p-8 relative">
            <div className="absolute -top-3 left-6 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full">POPULAR</div>
            <h3 className="font-semibold text-lg mb-1">Pro</h3>
            <div className="text-4xl font-bold mb-1">$59<span className="text-lg text-gray-400 font-normal">/mo</span></div>
            <p className="text-gray-400 text-sm mb-4">Less than one night&apos;s booking</p>
            <ul className="space-y-3 text-gray-600 text-sm mb-8">
              <li className="flex items-start gap-2"><span className="text-green-500 mt-0.5">✓</span> Everything in Free</li>
              <li className="flex items-start gap-2"><span className="text-green-500 mt-0.5">✓</span> Weekly content deliverables</li>
              <li className="flex items-start gap-2"><span className="text-green-500 mt-0.5">✓</span> AI-generated lifestyle photos</li>
              <li className="flex items-start gap-2"><span className="text-green-500 mt-0.5">✓</span> Review response drafts</li>
              <li className="flex items-start gap-2"><span className="text-green-500 mt-0.5">✓</span> Social media content</li>
              <li className="flex items-start gap-2"><span className="text-green-500 mt-0.5">✓</span> Seasonal updates</li>
              <li className="flex items-start gap-2"><span className="text-green-500 mt-0.5">✓</span> Monthly performance reports</li>
            </ul>
            <button className="block w-full text-center py-3 bg-green-500 text-white rounded-xl font-medium hover:bg-green-400 transition">
              Start Pro — $59/mo
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-200 py-8">
        <div className="max-w-5xl mx-auto px-6 text-center text-gray-400 text-sm">
          © 2026 Hospitality God. AI-powered marketing for short-term rental owners.
        </div>
      </footer>
    </div>
  );
}
