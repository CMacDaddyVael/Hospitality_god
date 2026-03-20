"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Sparkles, BarChart3, Image, MessageSquare, Calendar, Zap } from "lucide-react";

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
      if (!res.ok) throw new Error("Audit failed. Check the URL and try again.");
      const data = await res.json();
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
      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-xl border-b border-stone-200/60">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <span className="text-lg font-semibold tracking-tight text-stone-900">Hospitality God</span>
          <div className="hidden md:flex items-center gap-8 text-sm text-stone-500">
            <a href="#features" className="hover:text-stone-900 transition">Features</a>
            <a href="#pricing" className="hover:text-stone-900 transition">Pricing</a>
          </div>
          <a href="#audit" className="text-sm font-medium text-brand-600 hover:text-brand-700 transition">
            Free Audit <ArrowRight className="inline w-3.5 h-3.5 ml-0.5" />
          </a>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-brand-50/40 via-transparent to-transparent" />
        <div className="relative max-w-4xl mx-auto px-6 text-center">
          <div className="animate-fade-in">
            <div className="inline-flex items-center gap-2 bg-brand-50 border border-brand-200 rounded-full px-4 py-1.5 mb-8">
              <Sparkles className="w-3.5 h-3.5 text-brand-500" />
              <span className="text-brand-700 text-sm font-medium">AI-powered listing optimization</span>
            </div>
          </div>

          <h1 className="animate-slide-up text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-stone-900 leading-[1.1] mb-6">
            Your Airbnb listings,
            <br />
            <span className="text-brand-600">perfected by AI.</span>
          </h1>

          <p className="animate-slide-up-delay text-lg sm:text-xl text-stone-500 max-w-2xl mx-auto mb-10 leading-relaxed">
            A full marketing team for your rental — listing optimization, lifestyle photos, social content, review responses — all for under $600 a year.
          </p>

          {/* Audit Form */}
          <form onSubmit={handleAudit} id="audit" className="animate-slide-up-delay-2 max-w-xl mx-auto">
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Paste your Airbnb or Vrbo URL..."
                className="flex-1 px-5 py-3.5 bg-white border border-stone-300 rounded-xl text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-base shadow-sm"
                required
              />
              <button
                type="submit"
                disabled={loading}
                className="px-7 py-3.5 bg-brand-600 hover:bg-brand-700 disabled:bg-brand-300 text-white font-medium rounded-xl transition-all shadow-sm hover:shadow-md active:scale-[0.98] whitespace-nowrap"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Analyzing...
                  </span>
                ) : (
                  <>Free Audit <ArrowRight className="inline w-4 h-4 ml-1" /></>
                )}
              </button>
            </div>
            {error && <p className="mt-3 text-red-500 text-sm">{error}</p>}
            <p className="mt-4 text-stone-400 text-sm">
              No signup required. Results in 60 seconds.
            </p>
          </form>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 bg-white border-y border-stone-200">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold tracking-tight text-stone-900 mb-3">
              Your AI marketing team delivers weekly
            </h2>
            <p className="text-stone-500 max-w-xl mx-auto">
              Pick what you need. Your team works on it daily and sends you ready-to-use content.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: BarChart3, title: "Listing Optimization", desc: "Rewritten titles, descriptions, and tags tuned for Airbnb's search algorithm." },
              { icon: Image, title: "Lifestyle Photos", desc: "AI-generated photos of real people enjoying your property. Seasonal updates included." },
              { icon: MessageSquare, title: "Review Responses", desc: "Drafted replies to every guest review — positive and negative — in your voice." },
              { icon: Calendar, title: "Social Content", desc: "Instagram and TikTok posts with captions, hashtags, and images. Ready to post." },
              { icon: Zap, title: "Seasonal Refreshes", desc: "Updated copy and photos that match the season. Winter cozy, summer vibes, holiday charm." },
              { icon: Sparkles, title: "Competitive Intel", desc: "How you compare to nearby listings and what they're doing that you're not." },
            ].map((f) => (
              <div key={f.title} className="group p-6 rounded-xl border border-stone-200 hover:border-stone-300 hover:shadow-sm transition-all">
                <div className="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center mb-4 group-hover:bg-brand-100 transition">
                  <f.icon className="w-5 h-5 text-brand-600" />
                </div>
                <h3 className="font-semibold text-stone-900 mb-1">{f.title}</h3>
                <p className="text-sm text-stone-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-3xl font-bold tracking-tight text-stone-900 text-center mb-14">
            Three steps. Five minutes.
          </h2>
          <div className="grid md:grid-cols-3 gap-10">
            {[
              { step: "01", title: "Paste your URL", desc: "Drop your Airbnb or Vrbo listing link. Our AI audits your title, description, photos, reviews, and competitive positioning." },
              { step: "02", title: "Get your score", desc: "See exactly what's wrong — and what to fix first. Plus a free AI-generated lifestyle photo of your property, ready to post." },
              { step: "03", title: "Copy, paste, post", desc: "Every week, your AI team delivers optimized copy, lifestyle photos, and social content. You just approve and post." },
            ].map((s) => (
              <div key={s.step}>
                <span className="text-sm font-mono font-semibold text-brand-500 mb-3 block">{s.step}</span>
                <h3 className="text-lg font-semibold text-stone-900 mb-2">{s.title}</h3>
                <p className="text-sm text-stone-500 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 bg-white border-y border-stone-200">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-3xl font-bold tracking-tight text-stone-900 text-center mb-14">
            Simple pricing
          </h2>
          <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {/* Free */}
            <div className="rounded-2xl border border-stone-200 p-8">
              <h3 className="font-semibold text-lg text-stone-900 mb-1">Free Audit</h3>
              <div className="text-4xl font-bold text-stone-900 mb-1 font-mono">$0</div>
              <p className="text-stone-400 text-sm mb-6">One-time analysis</p>
              <ul className="space-y-3 text-stone-600 text-sm mb-8">
                {["Full listing analysis", "Score out of 100", "Top 5 critical fixes", "One AI lifestyle photo preview"].map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-stone-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-stone-500 text-xs">✓</span>
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
              <a href="#audit" className="block w-full text-center py-3 border border-stone-300 rounded-xl font-medium text-stone-700 hover:bg-stone-50 transition">
                Get Free Audit
              </a>
            </div>

            {/* Pro */}
            <div className="rounded-2xl border-2 border-brand-500 p-8 relative">
              <div className="absolute -top-3 left-6 bg-brand-600 text-white text-xs font-semibold px-3 py-1 rounded-full tracking-wide">
                MOST POPULAR
              </div>
              <h3 className="font-semibold text-lg text-stone-900 mb-1">Pro</h3>
              <div className="text-4xl font-bold text-stone-900 mb-1">
                <span className="font-mono">$49</span>
                <span className="text-lg text-stone-400 font-normal">/mo</span>
              </div>
              <p className="text-stone-400 text-sm mb-6">A full marketing team for under $600/year</p>
              <ul className="space-y-3 text-stone-600 text-sm mb-8">
                {[
                  "Everything in Free",
                  "Weekly content deliverables",
                  "AI lifestyle photos (unlimited)",
                  "Review response drafts",
                  "Social media content + captions",
                  "Seasonal listing updates",
                  "Monthly performance reports",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-brand-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-brand-600 text-xs">✓</span>
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
              <button className="block w-full text-center py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-medium transition-all shadow-sm hover:shadow-md active:scale-[0.98]">
                Start Pro — $49/mo
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 border-t border-stone-200">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between">
          <span className="text-sm text-stone-400">© 2026 Hospitality God</span>
          <span className="text-sm text-stone-400">AI-powered marketing for short-term rentals</span>
        </div>
      </footer>
    </div>
  );
}
