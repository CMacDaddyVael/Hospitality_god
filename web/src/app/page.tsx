"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BarChart3,
  Image,
  MessageSquare,
  Calendar,
  Zap,
  Star,
  CheckCircle2,
  TrendingUp,
  Shield,
  Sparkles,
  Search,
  ChevronRight,
  ArrowUpRight,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Animated gradient mesh background                                  */
/* ------------------------------------------------------------------ */
function HeroGradient() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Primary warm gradient */}
      <div
        className="absolute -top-1/2 -right-1/4 w-[800px] h-[800px] rounded-full opacity-[0.12]"
        style={{
          background:
            "radial-gradient(circle, #e11d48 0%, #f97316 40%, transparent 70%)",
          animation: "float 20s ease-in-out infinite",
        }}
      />
      {/* Secondary cooler accent */}
      <div
        className="absolute -bottom-1/3 -left-1/4 w-[600px] h-[600px] rounded-full opacity-[0.08]"
        style={{
          background:
            "radial-gradient(circle, #f97316 0%, #e11d48 50%, transparent 70%)",
          animation: "float 25s ease-in-out infinite reverse",
        }}
      />
      {/* Subtle dot grid */}
      <div className="absolute inset-0 bg-dots opacity-40" />
      <style jsx>{`
        @keyframes float {
          0%,
          100% {
            transform: translate(0, 0) scale(1);
          }
          33% {
            transform: translate(30px, -20px) scale(1.05);
          }
          66% {
            transform: translate(-20px, 15px) scale(0.95);
          }
        }
      `}</style>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Spinner                                                            */
/* ------------------------------------------------------------------ */
function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
        fill="none"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Data                                                               */
/* ------------------------------------------------------------------ */

const FEATURES = [
  {
    icon: BarChart3,
    title: "Listing Optimization",
    desc: "Rewritten titles, descriptions, and tags tuned for Airbnb's search algorithm. Every word earns its place.",
    accent: "from-rose-500/10 to-orange-500/10",
    iconBg: "bg-rose-50",
    iconColor: "text-rose-600",
  },
  {
    icon: Image,
    title: "Lifestyle Photos",
    desc: "AI-generated photos of real people enjoying your property. Seasonal updates keep your listing fresh.",
    accent: "from-violet-500/10 to-blue-500/10",
    iconBg: "bg-violet-50",
    iconColor: "text-violet-600",
  },
  {
    icon: MessageSquare,
    title: "Review Responses",
    desc: "Drafted replies to every guest review -- positive and negative -- in your voice. Posted within hours.",
    accent: "from-blue-500/10 to-cyan-500/10",
    iconBg: "bg-blue-50",
    iconColor: "text-blue-600",
  },
  {
    icon: Calendar,
    title: "Social Content",
    desc: "Instagram and TikTok posts with captions, hashtags, and images. A content calendar, executed for you.",
    accent: "from-amber-500/10 to-yellow-500/10",
    iconBg: "bg-amber-50",
    iconColor: "text-amber-600",
  },
  {
    icon: Zap,
    title: "Seasonal Refreshes",
    desc: "Updated copy and photos that match the season. Winter cozy, summer vibes, holiday charm -- automatically.",
    accent: "from-emerald-500/10 to-teal-500/10",
    iconBg: "bg-emerald-50",
    iconColor: "text-emerald-600",
  },
  {
    icon: Shield,
    title: "Competitive Intel",
    desc: "How you compare to nearby listings, what they changed, and what moves the needle in your market.",
    accent: "from-stone-500/10 to-stone-400/10",
    iconBg: "bg-stone-100",
    iconColor: "text-stone-600",
  },
];

const STEPS = [
  {
    step: "01",
    title: "Paste your listing URL",
    desc: "Drop your Airbnb or Vrbo link. Our AI audits your title, description, photos, reviews, and competitive positioning in under 60 seconds.",
  },
  {
    step: "02",
    title: "Get your score and fixes",
    desc: "See exactly what's holding you back -- and what to fix first. Plus a free AI-generated lifestyle photo of your property, ready to post.",
  },
  {
    step: "03",
    title: "Your agent delivers weekly",
    desc: "Every week, your AI marketing team delivers optimized copy, lifestyle photos, social content, and review responses. You just approve and post.",
  },
];

const SOCIAL_PROOF = [
  { metric: "2,400+", label: "Listings audited" },
  { metric: "37%", label: "Avg. booking increase" },
  { metric: "4.9", label: "Host satisfaction" },
  { metric: "<60s", label: "Audit turnaround" },
];

const FREE_FEATURES = [
  "Full listing analysis",
  "Score out of 100",
  "Top 5 critical fixes",
  "One AI lifestyle photo preview",
];

const PRO_FEATURES = [
  "Everything in Free Audit",
  "Weekly content deliverables",
  "AI lifestyle photos (unlimited)",
  "Review response drafts",
  "Social media content + captions",
  "Seasonal listing updates",
  "Monthly performance reports",
];

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

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
      if (!res.ok)
        throw new Error("Audit failed. Check the URL and try again.");
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
    <div className="min-h-screen bg-[#FAF9F7] film-grain">
      {/* ============================================================ */}
      {/*  Nav                                                          */}
      {/* ============================================================ */}
      <nav className="fixed top-0 w-full z-50 bg-[#FAF9F7]/80 backdrop-blur-xl border-b border-stone-200/50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-sm">
              <span className="text-white text-sm font-bold">V</span>
            </div>
            <span className="text-[17px] font-heading font-semibold tracking-tight text-stone-900">
              VAEL Host
            </span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-stone-500">
            <a
              href="#features"
              className="hover:text-stone-900 transition-colors"
            >
              Features
            </a>
            <a
              href="#how-it-works"
              className="hover:text-stone-900 transition-colors"
            >
              How it works
            </a>
            <a
              href="#pricing"
              className="hover:text-stone-900 transition-colors"
            >
              Pricing
            </a>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="/dashboard"
              className="text-sm font-medium text-stone-500 hover:text-stone-900 transition-colors"
            >
              Sign In
            </a>
            <a
              href="#audit"
              className="group inline-flex items-center gap-1.5 text-sm font-medium text-white bg-stone-900 hover:bg-stone-800 px-5 py-2.5 rounded-lg transition-all active:scale-[0.98] shadow-sm"
            >
              Start Free Audit
              <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
            </a>
          </div>
        </div>
      </nav>

      {/* ============================================================ */}
      {/*  Hero                                                         */}
      {/* ============================================================ */}
      <section className="relative pt-36 pb-24 overflow-hidden">
        <HeroGradient />
        <div className="relative max-w-4xl mx-auto px-6 text-center">
          {/* Badge */}
          <div className="animate-fade-in">
            <div className="inline-flex items-center gap-2 glass rounded-full px-4 py-1.5 mb-8 shadow-sm">
              <div className="flex items-center gap-1">
                <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
              </div>
              <span className="text-stone-600 text-sm font-medium">
                Trusted by 2,400+ hosts
              </span>
            </div>
          </div>

          {/* Heading */}
          <h1 className="animate-slide-up font-display text-5xl sm:text-6xl lg:text-[4.5rem] font-semibold tracking-tight leading-[1.08] mb-6">
            <span className="text-stone-900">Your rental deserves</span>
            <br />
            <span className="text-stone-900">a </span>
            <span className="text-gradient italic">real marketing team.</span>
          </h1>

          {/* Subheading */}
          <p className="animate-slide-up-delay text-lg sm:text-xl text-stone-500 max-w-2xl mx-auto mb-12 leading-relaxed font-sans">
            Listing optimization, lifestyle photos, social content, review
            responses -- an entire marketing department for your rental. All
            powered by AI.
          </p>

          {/* Audit Form */}
          <form
            onSubmit={handleAudit}
            id="audit"
            className="animate-slide-up-delay-2 max-w-xl mx-auto"
          >
            <div className="relative flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="Paste your Airbnb or Vrbo URL..."
                  className="w-full pl-11 pr-5 py-4 bg-white border border-stone-200 rounded-xl text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-400 text-base shadow-sm glow-soft transition-all"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="group px-7 py-4 bg-brand-600 hover:bg-brand-700 disabled:bg-brand-300 text-white font-semibold rounded-xl transition-all shadow-md hover:shadow-lg active:scale-[0.98] whitespace-nowrap"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <Spinner />
                    Analyzing...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    Free Audit
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                  </span>
                )}
              </button>
            </div>
            {error && (
              <p className="mt-3 text-red-500 text-sm font-medium">{error}</p>
            )}
            <p className="mt-4 text-stone-400 text-sm">
              No signup required. Results in 60 seconds.
            </p>
          </form>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  Social Proof Bar                                             */}
      {/* ============================================================ */}
      <section className="border-y border-stone-200/60 bg-white/60 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {SOCIAL_PROOF.map((item) => (
              <div key={item.label} className="text-center">
                <div className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-stone-900">
                  {item.metric}
                </div>
                <div className="text-sm text-stone-500 mt-1">{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  Features                                                     */}
      {/* ============================================================ */}
      <section id="features" className="py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-600 mb-3">
              Everything you need
            </p>
            <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-stone-900 mb-4">
              Your AI marketing team delivers weekly
            </h2>
            <p className="text-stone-500 max-w-xl mx-auto text-lg">
              Pick what you need. Your team works on it daily and sends you
              ready-to-use content.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="group relative bg-white rounded-2xl border border-stone-200/80 p-7 transition-all duration-300 hover:shadow-lg hover:shadow-stone-200/50 hover:border-stone-300 hover:-translate-y-1"
              >
                {/* Subtle gradient overlay on hover */}
                <div
                  className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${f.accent} opacity-0 group-hover:opacity-100 transition-opacity duration-300`}
                />
                <div className="relative">
                  <div
                    className={`w-11 h-11 rounded-xl ${f.iconBg} flex items-center justify-center mb-5 transition-transform duration-300 group-hover:scale-110`}
                  >
                    <f.icon className={`w-5 h-5 ${f.iconColor}`} />
                  </div>
                  <h3 className="font-sans font-semibold text-stone-900 mb-2 tracking-tight">
                    {f.title}
                  </h3>
                  <p className="text-sm text-stone-500 leading-relaxed">
                    {f.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  How It Works                                                 */}
      {/* ============================================================ */}
      <section id="how-it-works" className="py-24 bg-white border-y border-stone-200/60">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-600 mb-3">
              Simple process
            </p>
            <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-stone-900">
              Three steps. Five minutes.
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-12">
            {STEPS.map((s, i) => (
              <div key={s.step} className="relative">
                {/* Connector line on desktop */}
                {i < STEPS.length - 1 && (
                  <div className="hidden md:block absolute top-6 left-full w-full h-px bg-gradient-to-r from-stone-200 to-transparent z-0" />
                )}
                <div className="relative">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-50 to-brand-100 border border-brand-200/50 flex items-center justify-center mb-5">
                    <span className="text-sm font-mono font-bold text-brand-600">
                      {s.step}
                    </span>
                  </div>
                  <h3 className="font-heading text-lg font-semibold text-stone-900 mb-2 tracking-tight">
                    {s.title}
                  </h3>
                  <p className="text-sm text-stone-500 leading-relaxed">
                    {s.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  Pricing                                                      */}
      {/* ============================================================ */}
      <section id="pricing" className="py-24">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-600 mb-3">
              Pricing
            </p>
            <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-stone-900 mb-4">
              Less than one night's booking
            </h2>
            <p className="text-stone-500 text-lg max-w-lg mx-auto">
              A full marketing team for your rental. Cancel anytime.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {/* Free */}
            <div className="relative bg-white rounded-2xl border border-stone-200 p-8 transition-all duration-300 hover:shadow-lg hover:shadow-stone-200/40 hover:-translate-y-0.5">
              <h3 className="font-heading font-semibold text-lg text-stone-900 mb-1">
                Free Audit
              </h3>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-4xl font-bold font-mono text-stone-900">
                  $0
                </span>
              </div>
              <p className="text-stone-400 text-sm mb-6">One-time analysis</p>
              <ul className="space-y-3 text-stone-600 text-sm mb-8">
                {FREE_FEATURES.map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-stone-400 flex-shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
              <a
                href="#audit"
                className="block w-full text-center py-3.5 border border-stone-300 rounded-xl font-medium text-stone-700 hover:bg-stone-50 transition-all active:scale-[0.98]"
              >
                Get Free Audit
              </a>
            </div>

            {/* Pro */}
            <div className="relative bg-white rounded-2xl border-2 border-brand-500 p-8 transition-all duration-300 hover:shadow-xl hover:shadow-brand-500/10 hover:-translate-y-0.5">
              {/* Glow effect */}
              <div className="absolute -inset-px rounded-2xl bg-gradient-to-b from-brand-500/20 to-transparent opacity-0 hover:opacity-100 transition-opacity pointer-events-none" />
              <div className="absolute -top-3.5 left-6 bg-gradient-to-r from-brand-600 to-brand-500 text-white text-[11px] font-bold px-3.5 py-1 rounded-full tracking-wider uppercase shadow-sm">
                Most Popular
              </div>
              <h3 className="font-heading font-semibold text-lg text-stone-900 mb-1">
                Pro
              </h3>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-4xl font-bold font-mono text-stone-900">
                  $49
                </span>
                <span className="text-lg text-stone-400 font-normal">/mo</span>
              </div>
              <p className="text-stone-400 text-sm mb-6">
                A full marketing team for under $600/year
              </p>
              <ul className="space-y-3 text-stone-600 text-sm mb-8">
                {PRO_FEATURES.map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-brand-500 flex-shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
              <button className="block w-full text-center py-3.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-semibold transition-all shadow-md hover:shadow-lg active:scale-[0.98]">
                Start Pro -- $49/mo
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  Bottom CTA                                                   */}
      {/* ============================================================ */}
      <section className="py-24 bg-stone-950 relative overflow-hidden">
        {/* Grid overlay */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
        {/* Gradient glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] rounded-full bg-brand-600/10 blur-[100px]" />
        <div className="relative max-w-3xl mx-auto px-6 text-center">
          <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-white mb-4">
            Stop leaving bookings on the table
          </h2>
          <p className="text-stone-400 text-lg mb-10 max-w-xl mx-auto leading-relaxed">
            Every week your listing sits un-optimized is revenue lost. Let your
            AI marketing team start working today.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="#audit"
              className="group inline-flex items-center gap-2 px-8 py-4 bg-white text-stone-900 font-semibold rounded-xl transition-all shadow-lg hover:shadow-xl active:scale-[0.98] text-base"
            >
              Run free audit
              <ArrowUpRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </a>
            <a
              href="#pricing"
              className="inline-flex items-center gap-2 px-8 py-4 text-stone-400 hover:text-white font-medium rounded-xl transition-all text-base"
            >
              View pricing
              <ChevronRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  Footer                                                       */}
      {/* ============================================================ */}
      <footer className="bg-stone-950 border-t border-white/[0.06] py-12">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
                <span className="text-white text-xs font-bold">V</span>
              </div>
              <span className="text-sm font-heading font-semibold text-white/60">
                VAEL Host
              </span>
            </div>
            <div className="flex items-center gap-8 text-sm text-white/30">
              <a
                href="#features"
                className="hover:text-white/60 transition-colors"
              >
                Features
              </a>
              <a
                href="#pricing"
                className="hover:text-white/60 transition-colors"
              >
                Pricing
              </a>
              <span>hello@vaelhost.com</span>
            </div>
            <span className="text-sm text-white/20">
              &copy; 2026 VAEL Host
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
