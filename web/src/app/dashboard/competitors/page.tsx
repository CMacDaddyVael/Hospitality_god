"use client";

import { useState, useEffect } from "react";
import { AlertTriangle, TrendingUp, Lightbulb, Shield, ArrowRight, RefreshCw } from "lucide-react";

interface Alert {
  type: "opportunity" | "threat" | "trend";
  severity: "high" | "medium" | "low";
  title: string;
  description: string;
  action: string;
  impact: string;
}

interface MarketInsight {
  insight: string;
  source: string;
}

interface Competitor {
  name: string;
  url: string;
  strengths: string[];
  weaknesses: string[];
  price: string;
  rating: string;
  reviews: string;
  keyDifference: string;
}

interface HeadToHead {
  title: { user: string; bestCompetitor: string; verdict: string };
  photos: { user: string; competitors: string; verdict: string };
  amenities: { userMissing: string[]; userAdvantage: string[] };
  reviews: { user: string; competitors: string; verdict: string };
  pricing: { user: string; competitors: string; verdict: string };
}

interface CompetitorData {
  location: string;
  propertyType: string;
  priceRange: string;
  competitors: Competitor[];
  alerts: Alert[];
  headToHead: HeadToHead;
  strengths: string[];
  weaknesses: string[];
  marketInsights: MarketInsight[];
  suggestedAmenities: string[];
  pricingInsight: string;
}

const alertConfig = {
  opportunity: { icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200" },
  threat: { icon: AlertTriangle, color: "text-red-600", bg: "bg-red-50", border: "border-red-200" },
  trend: { icon: Lightbulb, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200" },
};

const severityBadge = {
  high: "bg-red-100 text-red-700",
  medium: "bg-amber-100 text-amber-700",
  low: "bg-stone-100 text-stone-600",
};

export default function CompetitorsPage() {
  const [data, setData] = useState<CompetitorData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const cached = localStorage.getItem("hg_competitor_data");
    if (cached) setData(JSON.parse(cached));
  }, []);

  async function runScan() {
    setLoading(true);
    setError("");

    try {
      const auditData = sessionStorage.getItem("audit_result");
      if (!auditData) throw new Error("Run an audit first to connect your property.");

      const parsed = JSON.parse(auditData);

      const res = await fetch("/api/competitor-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listingUrl: parsed.url,
          propertyName: parsed.audit?.property_name,
          propertyDescription: parsed.audit?.summary,
        }),
      });

      if (!res.ok) throw new Error("Scan failed. Try again.");

      const result = await res.json();
      setData(result);
      localStorage.setItem("hg_competitor_data", JSON.stringify(result));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900">Competitive Intel</h1>
          <p className="text-stone-500 mt-1">
            {data ? `${data.location} · ${data.propertyType}` : "Monitor your market and stay ahead"}
          </p>
        </div>
        <button
          onClick={runScan}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-700 transition disabled:opacity-50"
        >
          {loading ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              Scanning...
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4" />
              {data ? "Refresh Scan" : "Run Competitive Scan"}
            </>
          )}
        </button>
      </div>

      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

      {/* Empty State */}
      {!data && !loading && (
        <div className="bg-white rounded-xl border border-stone-200 p-12 text-center">
          <Shield className="w-12 h-12 text-stone-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-stone-900 mb-2">Know your competition</h3>
          <p className="text-stone-500 max-w-md mx-auto mb-6">
            We&apos;ll analyze your market, identify threats and opportunities,
            and tell you exactly what nearby listings are doing that you&apos;re not.
          </p>
          <button
            onClick={runScan}
            className="px-6 py-3 bg-brand-600 text-white rounded-xl font-medium hover:bg-brand-700 transition"
          >
            Run Competitive Scan
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="bg-white rounded-xl border border-stone-200 p-12 text-center">
          <RefreshCw className="w-8 h-8 text-brand-500 mx-auto mb-4 animate-spin" />
          <h3 className="text-lg font-semibold text-stone-900 mb-2">Scanning your market...</h3>
          <p className="text-stone-500">Analyzing comparable listings and market trends</p>
        </div>
      )}

      {data && (
        <div className="space-y-6">
          {/* Pricing Insight */}
          <div className="bg-gradient-to-r from-brand-50 to-rose-50 border border-brand-200 rounded-xl p-5">
            <p className="text-sm font-medium text-brand-800">
              <span className="font-semibold">Pricing insight:</span> {data.pricingInsight}
            </p>
            <p className="text-xs text-brand-600 mt-1">Estimated market range: {data.priceRange}/night</p>
          </div>

          {/* Alerts */}
          <div>
            <h2 className="text-lg font-semibold text-stone-900 mb-4">Alerts</h2>
            <div className="space-y-3">
              {data.alerts.map((alert, i) => {
                const config = alertConfig[alert.type];
                const Icon = config.icon;
                return (
                  <div key={i} className={`bg-white rounded-xl border ${config.border} p-5`}>
                    <div className="flex items-start gap-4">
                      <div className={`w-10 h-10 rounded-lg ${config.bg} flex items-center justify-center flex-shrink-0`}>
                        <Icon className={`w-5 h-5 ${config.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-stone-900">{alert.title}</h3>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${severityBadge[alert.severity]}`}>
                            {alert.severity}
                          </span>
                        </div>
                        <p className="text-sm text-stone-500 mb-3">{alert.description}</p>
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-1.5 text-sm">
                            <ArrowRight className={`w-3.5 h-3.5 ${config.color}`} />
                            <span className="text-stone-700 font-medium">{alert.action}</span>
                          </div>
                          <span className="text-xs text-stone-400">{alert.impact}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Competitor Cards */}
          {data.competitors && data.competitors.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-stone-900 mb-4">Nearby Competitors</h2>
              <div className="space-y-3">
                {data.competitors.map((comp, i) => (
                  <div key={i} className="bg-white rounded-xl border border-stone-200 p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-stone-900">{comp.name}</h3>
                        <a href={comp.url} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-600 hover:text-brand-700 transition">
                          View listing →
                        </a>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-mono font-semibold text-stone-900">{comp.price}</p>
                        <p className="text-xs text-stone-400">{comp.rating} ({comp.reviews} reviews)</p>
                      </div>
                    </div>
                    <p className="text-sm text-stone-600 mb-3 italic">{comp.keyDifference}</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs font-medium text-red-600 mb-1.5">They beat you on:</p>
                        {comp.strengths.map((s, j) => (
                          <p key={j} className="text-xs text-stone-500 flex items-start gap-1.5 mb-1">
                            <span className="text-red-400 mt-0.5">−</span>{s}
                          </p>
                        ))}
                      </div>
                      <div>
                        <p className="text-xs font-medium text-emerald-600 mb-1.5">You beat them on:</p>
                        {comp.weaknesses.map((w, j) => (
                          <p key={j} className="text-xs text-stone-500 flex items-start gap-1.5 mb-1">
                            <span className="text-emerald-400 mt-0.5">+</span>{w}
                          </p>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Head to Head */}
          {data.headToHead && (
            <div className="bg-white rounded-xl border border-stone-200 p-6">
              <h2 className="text-lg font-semibold tracking-tight text-stone-900 mb-4">Head-to-Head</h2>
              <div className="space-y-4">
                {[
                  { label: "Title", data: data.headToHead.title },
                  { label: "Photos", data: data.headToHead.photos },
                  { label: "Reviews", data: data.headToHead.reviews },
                  { label: "Pricing", data: data.headToHead.pricing },
                ].map((item) => (
                  <div key={item.label} className="border-b border-stone-100 pb-4 last:border-0 last:pb-0">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-stone-700">{item.label}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mb-2">
                      <div className="bg-brand-50 rounded-lg p-3">
                        <p className="text-[10px] font-medium text-brand-600 uppercase tracking-wide mb-1">You</p>
                        <p className="text-xs text-stone-700">{item.data.user}</p>
                      </div>
                      <div className="bg-stone-50 rounded-lg p-3">
                        <p className="text-[10px] font-medium text-stone-400 uppercase tracking-wide mb-1">Competitors</p>
                        <p className="text-xs text-stone-700">{"bestCompetitor" in item.data ? item.data.bestCompetitor : ("competitors" in item.data ? item.data.competitors : "")}</p>
                      </div>
                    </div>
                    <p className="text-xs text-stone-500">{item.data.verdict}</p>
                  </div>
                ))}

                {/* Amenity Gap */}
                {data.headToHead.amenities && (
                  <div className="pt-2">
                    <span className="text-sm font-medium text-stone-700">Amenity Gap</span>
                    <div className="grid grid-cols-2 gap-4 mt-2">
                      <div>
                        <p className="text-[10px] font-medium text-red-600 uppercase tracking-wide mb-2">You're missing</p>
                        <div className="flex flex-wrap gap-1.5">
                          {data.headToHead.amenities.userMissing?.map((a, i) => (
                            <span key={i} className="text-xs bg-red-50 text-red-700 px-2 py-0.5 rounded-md">{a}</span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] font-medium text-emerald-600 uppercase tracking-wide mb-2">Your advantage</p>
                        <div className="flex flex-wrap gap-1.5">
                          {data.headToHead.amenities.userAdvantage?.map((a, i) => (
                            <span key={i} className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md">{a}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Strengths & Weaknesses */}
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-stone-200 p-6">
              <h3 className="font-semibold text-stone-900 mb-4">Your Strengths</h3>
              <ul className="space-y-2.5">
                {data.strengths.map((s, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-stone-600">
                    <span className="w-5 h-5 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-emerald-600 text-xs">✓</span>
                    </span>
                    {s}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-white rounded-xl border border-stone-200 p-6">
              <h3 className="font-semibold text-stone-900 mb-4">Areas to Improve</h3>
              <ul className="space-y-2.5">
                {data.weaknesses.map((w, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-stone-600">
                    <span className="w-5 h-5 rounded-full bg-amber-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-amber-600 text-xs">!</span>
                    </span>
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Suggested Amenities */}
          {data.suggestedAmenities.length > 0 && (
            <div className="bg-white rounded-xl border border-stone-200 p-6">
              <h3 className="font-semibold text-stone-900 mb-4">Amenities top listings in your area offer</h3>
              <div className="flex flex-wrap gap-2">
                {data.suggestedAmenities.map((a, i) => (
                  <span key={i} className="px-3 py-1.5 bg-stone-100 text-stone-600 rounded-lg text-sm">
                    {a}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Market Insights */}
          <div className="bg-white rounded-xl border border-stone-200 p-6">
            <h3 className="font-semibold text-stone-900 mb-4">Market Insights</h3>
            <div className="space-y-4">
              {data.marketInsights.map((mi, i) => (
                <div key={i} className="border-l-2 border-brand-200 pl-4">
                  <p className="text-sm text-stone-700">{mi.insight}</p>
                  <p className="text-xs text-stone-400 mt-1">Based on: {mi.source}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
