"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface AuditCategory {
  name: string;
  grade: string;
  score: number;
  findings: string[];
  recommendations: string[];
}

interface TopFix {
  priority: number;
  title: string;
  description: string;
  impact: string;
}

interface AuditResult {
  property_name: string;
  overall_score: number;
  summary: string;
  categories: AuditCategory[];
  top_5_fixes: TopFix[];
  optimized_title: string;
  optimized_description_preview: string;
}

function gradeColor(grade: string) {
  const colors: Record<string, string> = {
    A: "text-brand-600 bg-brand-50 border-brand-200",
    B: "text-blue-600 bg-blue-50 border-blue-200",
    C: "text-yellow-600 bg-yellow-50 border-yellow-200",
    D: "text-orange-600 bg-orange-50 border-orange-200",
    F: "text-red-600 bg-red-50 border-red-200",
  };
  return colors[grade] || colors.C;
}

function scoreColor(score: number) {
  if (score >= 80) return "text-brand-600";
  if (score >= 60) return "text-yellow-600";
  if (score >= 40) return "text-orange-600";
  return "text-red-600";
}

function ScoreRing({ score }: { score: number }) {
  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? "#22c55e" : score >= 60 ? "#eab308" : score >= 40 ? "#f97316" : "#ef4444";

  return (
    <div className="relative w-36 h-36">
      <svg className="w-36 h-36 -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r="54" stroke="#f3f4f6" strokeWidth="8" fill="none" />
        <circle
          cx="60" cy="60" r="54"
          stroke={color} strokeWidth="8" fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-4xl font-bold ${scoreColor(score)}`}>{score}</span>
        <span className="text-stone-400 text-sm">/ 100</span>
      </div>
    </div>
  );
}

export default function AuditPage() {
  const [audit, setAudit] = useState<AuditResult | null>(null);
  const [url, setUrl] = useState("");
  const [expandedCategory, setExpandedCategory] = useState<number | null>(null);
  const [lifestyleImage, setLifestyleImage] = useState<string | null>(null);
  const [lifestyleCaption, setLifestyleCaption] = useState("");
  const [lifestyleHashtags, setLifestyleHashtags] = useState("");
  const [generatingLifestyle, setGeneratingLifestyle] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const stored = sessionStorage.getItem("audit_result");
    if (!stored) {
      router.push("/");
      return;
    }
    const data = JSON.parse(stored);
    setAudit(data.audit);
    setUrl(data.url);

    // Auto-generate a lifestyle photo from the first listing image
    const photos = data.listingPhotos || [];
    if (photos.length > 0 && !lifestyleImage) {
      setGeneratingLifestyle(true);

      // Generate image and caption in parallel
      Promise.all([
        fetch("/api/generate-lifestyle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            propertyImageUrl: photos[0],
            season: (() => { const m = new Date().getMonth(); if (m >= 2 && m <= 4) return "spring"; if (m >= 5 && m <= 7) return "summer"; if (m >= 8 && m <= 10) return "fall"; return "winter"; })(),
            sceneType: "morning-coffee",
            propertyDescription: `${data.propertyDescription || ""}. Show a couple enjoying the space.`,
          }),
        }).then(r => r.ok ? r.json() : null).catch(() => null),
        fetch("/api/generate-caption", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scene: "morning-coffee",
            season: "spring",
            propertyDescription: data.propertyDescription || data.audit?.property_name || "",
          }),
        }).then(r => r.ok ? r.json() : null).catch(() => null),
      ]).then(([imgData, captionData]) => {
        if (imgData?.imageUrl) setLifestyleImage(imgData.imageUrl);
        if (captionData?.caption) setLifestyleCaption(captionData.caption);
        if (captionData?.hashtags) setLifestyleHashtags(captionData.hashtags);
        setGeneratingLifestyle(false);

        // Cache listing photos for Photo Studio
        if (photos.length > 0) {
          localStorage.setItem("hg_listing_photos", JSON.stringify({
            photos,
            description: data.propertyDescription || "",
          }));
        }
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  if (!audit) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-brand-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-subtle">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-xl border-b border-stone-200 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <span className="text-base font-semibold tracking-tight text-stone-900">Hospitality God</span>
          <a href="/" className="text-sm text-stone-500 hover:text-stone-900 transition">
            ← Audit another listing
          </a>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-10">
        {/* Score Header */}
        <div className="bg-white rounded-2xl border border-stone-200 p-8 mb-6">
          <div className="flex flex-col md:flex-row items-center gap-8">
            <ScoreRing score={audit.overall_score} />
            <div className="flex-1 text-center md:text-left">
              <h1 className="text-2xl font-bold mb-1">{audit.property_name}</h1>
              <p className="text-stone-400 text-sm mb-3 break-all">{url}</p>
              <p className="text-stone-600">{audit.summary}</p>
            </div>
          </div>
        </div>

        {/* Lifestyle Photo Preview — The Magic Moment */}
        <div className="bg-white rounded-2xl border border-stone-200 p-8 mb-6">
          <h2 className="text-xl font-bold mb-2">Here&apos;s what your Instagram could look like this week</h2>
          <p className="text-stone-500 text-sm mb-6">We generated this from your listing photos — ready to post.</p>

          {generatingLifestyle && (
            <div className="flex items-center gap-4 p-8 bg-stone-50 rounded-xl">
              <svg className="animate-spin h-6 w-6 text-green-500 flex-shrink-0" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <div>
                <p className="font-medium text-stone-700">Creating a lifestyle photo of your property...</p>
                <p className="text-sm text-stone-400">Our AI is placing guests in your space — takes about 30 seconds</p>
              </div>
            </div>
          )}

          {lifestyleImage && (
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <img
                  src={lifestyleImage}
                  alt="AI-generated lifestyle photo of your property"
                  className="w-full rounded-xl shadow-lg"
                />
              </div>
              <div className="flex flex-col justify-center">
                <p className="text-sm text-stone-500 uppercase tracking-wide font-medium mb-2">Ready-to-post caption</p>
                <div className="bg-stone-50 rounded-xl p-4 mb-3">
                  <p className="text-sm text-stone-700">{lifestyleCaption}</p>
                  {lifestyleHashtags && (
                    <p className="text-sm text-blue-500 mt-2">{lifestyleHashtags}</p>
                  )}
                </div>
                <button
                  onClick={() => navigator.clipboard.writeText(`${lifestyleCaption}\n\n${lifestyleHashtags}`)}
                  className="self-start px-4 py-2 bg-stone-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition"
                >
                  Copy caption + hashtags
                </button>
                <p className="text-sm text-stone-400 mt-4">
                  Get 5 of these every week with captions, hashtags, and seasonal variations — all for $59/mo.
                </p>
              </div>
            </div>
          )}

          {!generatingLifestyle && !lifestyleImage && (
            <div className="p-6 bg-stone-50 rounded-xl text-center">
              <p className="text-stone-400 text-sm">Could not generate a preview this time. Subscribe to get weekly lifestyle content.</p>
            </div>
          )}
        </div>

        {/* Category Grades */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
          {audit.categories.map((cat, i) => (
            <button
              key={cat.name}
              onClick={() => setExpandedCategory(expandedCategory === i ? null : i)}
              className="bg-white rounded-xl border border-stone-200 p-4 text-left hover:border-gray-300 transition"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-stone-700">{cat.name}</span>
                <span className={`text-lg font-bold px-2.5 py-0.5 rounded-lg border ${gradeColor(cat.grade)}`}>
                  {cat.grade}
                </span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div
                  className="h-2 rounded-full transition-all duration-500"
                  style={{
                    width: `${cat.score}%`,
                    backgroundColor: cat.score >= 80 ? "#22c55e" : cat.score >= 60 ? "#eab308" : cat.score >= 40 ? "#f97316" : "#ef4444",
                  }}
                />
              </div>
            </button>
          ))}
        </div>

        {/* Expanded Category Detail */}
        {expandedCategory !== null && (
          <div className="bg-white rounded-xl border border-stone-200 p-6 mb-6">
            <h3 className="font-semibold text-lg mb-4">
              {audit.categories[expandedCategory].name}
            </h3>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="text-sm font-medium text-stone-500 uppercase tracking-wide mb-3">Findings</h4>
                <ul className="space-y-2">
                  {audit.categories[expandedCategory].findings.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-stone-700">
                      <span className="text-orange-500 mt-0.5">●</span>
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="text-sm font-medium text-stone-500 uppercase tracking-wide mb-3">Recommendations</h4>
                <ul className="space-y-2">
                  {audit.categories[expandedCategory].recommendations.map((r, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-stone-700">
                      <span className="text-green-500 mt-0.5">✓</span>
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Top 5 Fixes */}
        <div className="bg-white rounded-2xl border border-stone-200 p-8 mb-6">
          <h2 className="text-xl font-bold mb-6">🔥 Top 5 Fixes — Do These First</h2>
          <div className="space-y-4">
            {audit.top_5_fixes.map((fix) => (
              <div key={fix.priority} className="flex gap-4 p-4 bg-stone-50 rounded-xl">
                <div className="flex-shrink-0 w-8 h-8 bg-brand-500 text-white rounded-full flex items-center justify-center font-bold text-sm">
                  {fix.priority}
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold mb-1">{fix.title}</h4>
                  <p className="text-stone-600 text-sm mb-2">{fix.description}</p>
                  <span className="inline-flex items-center gap-1 text-brand-600 text-sm font-medium">
                    📈 {fix.impact}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Optimized Copy Preview */}
        <div className="bg-white rounded-2xl border border-stone-200 p-8 mb-6">
          <h2 className="text-xl font-bold mb-6">✨ Here&apos;s what your listing COULD look like</h2>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-stone-500 uppercase tracking-wide">Optimized Title</label>
              <div className="mt-2 p-4 bg-brand-50 border border-brand-200 rounded-xl text-lg font-medium">
                {audit.optimized_title}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-stone-500 uppercase tracking-wide">Optimized Description (Preview)</label>
              <div className="mt-2 p-4 bg-brand-50 border border-brand-200 rounded-xl text-stone-700">
                {audit.optimized_description_preview}
              </div>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="bg-gradient-to-br from-stone-900 to-brand-950 rounded-2xl p-8 text-center text-white">
          <h2 className="text-2xl font-bold mb-3">
            Want fixes like these delivered every week?
          </h2>
          <p className="text-stone-400 mb-6 max-w-lg mx-auto">
            A full marketing team for your rental — listing optimization, lifestyle photos, social content, review responses — all for under $600 a year.
          </p>
          <a href="/dashboard" className="inline-block px-8 py-4 bg-brand-600 hover:bg-brand-700 text-white font-medium rounded-xl transition-all shadow-sm hover:shadow-md active:scale-[0.98] text-lg">
            Start Pro — $49/mo
          </a>
          <p className="mt-3 text-stone-500 text-sm">Cancel anytime. Less than one night&apos;s booking.</p>
        </div>
      </div>
    </div>
  );
}
