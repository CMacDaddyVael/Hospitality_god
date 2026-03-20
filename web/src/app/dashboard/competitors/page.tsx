"use client";

import { useState, useEffect } from "react";
import { AlertTriangle, TrendingUp, Lightbulb, Shield, ArrowRight, RefreshCw, ExternalLink, Star, DollarSign, Eye, Check, X, Minus } from "lucide-react";

interface Alert {
  type: "opportunity" | "threat" | "trend";
  severity: "high" | "medium" | "low";
  title: string;
  description: string;
  action: string;
  impact: string;
}

interface MarketInsight { insight: string; source: string; }

interface Competitor {
  name: string; url: string; strengths: string[]; weaknesses: string[];
  price: string; rating: string; reviews: string; keyDifference: string;
}

interface HeadToHead {
  title: { user: string; bestCompetitor: string; verdict: string };
  photos: { user: string; competitors: string; verdict: string };
  amenities: { userMissing: string[]; userAdvantage: string[] };
  reviews: { user: string; competitors: string; verdict: string };
  pricing: { user: string; competitors: string; verdict: string };
}

interface CompetitorData {
  location: string; propertyType: string; priceRange: string;
  competitors: Competitor[]; alerts: Alert[]; headToHead: HeadToHead;
  strengths: string[]; weaknesses: string[];
  marketInsights: MarketInsight[]; suggestedAmenities: string[]; pricingInsight: string;
}

const alertIcons = { opportunity: TrendingUp, threat: AlertTriangle, trend: Lightbulb };
const alertStyles = {
  opportunity: "border-l-emerald-500 bg-emerald-50/50",
  threat: "border-l-red-500 bg-red-50/50",
  trend: "border-l-amber-500 bg-amber-50/50",
};
const severityDot = { high: "bg-red-500", medium: "bg-amber-500", low: "bg-stone-400" };

export default function CompetitorsPage() {
  const [data, setData] = useState<CompetitorData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [scanProgress, setScanProgress] = useState(0);

  useEffect(() => {
    const cached = localStorage.getItem("hg_competitor_data");
    if (cached) setData(JSON.parse(cached));
  }, []);

  async function runScan() {
    setLoading(true);
    setError("");
    setScanProgress(0);

    const progressInterval = setInterval(() => {
      setScanProgress((p) => Math.min(p + Math.random() * 8, 90));
    }, 3000);

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

      clearInterval(progressInterval);
      setScanProgress(100);

      if (!res.ok) throw new Error("Scan failed. Try again.");

      const result = await res.json();
      setData(result);
      localStorage.setItem("hg_competitor_data", JSON.stringify(result));
    } catch (err) {
      clearInterval(progressInterval);
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-heading font-bold tracking-tight text-stone-900">Competitive Intel</h1>
          {data && (
            <p className="text-stone-400 mt-1 text-sm font-mono">
              {data.location} · {data.propertyType} · {data.priceRange}/night
            </p>
          )}
          {!data && <p className="text-stone-400 mt-1 text-sm">Scrape real competitor listings and compare head-to-head</p>}
        </div>
        <button
          onClick={runScan}
          disabled={loading}
          className="flex items-center gap-2 px-5 py-2.5 bg-stone-900 text-white rounded-xl text-sm font-medium hover:bg-stone-800 transition-all active:scale-[0.98] disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Scanning..." : data ? "Rescan" : "Scan competitors"}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Empty State */}
      {!data && !loading && (
        <div className="bg-white rounded-2xl border border-stone-200 glow-soft overflow-hidden">
          <div className="bg-gradient-to-br from-stone-900 via-stone-800 to-stone-900 p-12 text-center relative">
            <div className="absolute inset-0 bg-grid opacity-10" />
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur flex items-center justify-center mx-auto mb-5">
                <Shield className="w-8 h-8 text-white/70" />
              </div>
              <h3 className="text-xl font-heading font-semibold text-white mb-2">Know your competition</h3>
              <p className="text-white/50 max-w-md mx-auto mb-8 text-sm leading-relaxed">
                We&apos;ll scrape real Airbnb listings in your area, compare pricing, amenities, reviews, and content — then tell you exactly how to win.
              </p>
              <button
                onClick={runScan}
                className="px-8 py-3 bg-white text-stone-900 rounded-xl font-medium hover:bg-stone-50 transition-all active:scale-[0.98] text-sm"
              >
                Run competitive scan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="bg-white rounded-2xl border border-stone-200 p-10 text-center">
          <div className="max-w-sm mx-auto">
            <div className="w-12 h-12 rounded-xl bg-stone-100 flex items-center justify-center mx-auto mb-4">
              <Eye className="w-6 h-6 text-stone-400 animate-pulse" />
            </div>
            <h3 className="text-base font-heading font-semibold text-stone-900 mb-1">Scanning your market</h3>
            <p className="text-sm text-stone-400 mb-6">Finding and scraping competitor listings in your area...</p>
            <div className="w-full bg-stone-100 rounded-full h-1.5 mb-2">
              <div
                className="h-1.5 bg-stone-900 rounded-full transition-all duration-1000 ease-out"
                style={{ width: `${scanProgress}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] text-stone-400 font-mono">
              <span>Searching listings...</span>
              <span>{Math.round(scanProgress)}%</span>
            </div>
          </div>
        </div>
      )}

      {data && (
        <div className="space-y-5">

          {/* Pricing Insight — hero card */}
          <div className="bg-stone-900 rounded-2xl p-6 relative overflow-hidden">
            <div className="absolute inset-0 bg-grid opacity-5" />
            <div className="relative flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
                <DollarSign className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-xs font-medium text-white/40 uppercase tracking-wider mb-1.5">Pricing intelligence</p>
                <p className="text-sm text-white/80 leading-relaxed">{data.pricingInsight}</p>
                <p className="text-xs text-white/30 mt-2 font-mono">Market range: {data.priceRange}/night</p>
              </div>
            </div>
          </div>

          {/* Competitor Cards */}
          {data.competitors && data.competitors.length > 0 && (
            <div>
              <h2 className="text-base font-heading font-semibold text-stone-900 mb-3">Nearby competitors</h2>
              <div className="grid gap-3">
                {data.competitors.map((comp, i) => (
                  <div key={i} className="bg-white rounded-xl border border-stone-200 hover:border-stone-300 hover:shadow-sm transition-all overflow-hidden">
                    <div className="p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-stone-900 text-sm truncate">{comp.name}</h3>
                            <a href={comp.url} target="_blank" rel="noopener noreferrer" className="text-stone-400 hover:text-brand-600 transition flex-shrink-0">
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          </div>
                          <p className="text-xs text-stone-400 mt-0.5 italic">{comp.keyDifference}</p>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                          <div className="text-right">
                            <p className="text-base font-mono font-bold text-stone-900">{comp.price}</p>
                            <div className="flex items-center gap-1 justify-end">
                              <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                              <span className="text-xs text-stone-500">{comp.rating} ({comp.reviews})</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 pt-3 border-t border-stone-100">
                        <div>
                          <p className="text-[10px] font-semibold text-red-500 uppercase tracking-wider mb-2">They win on</p>
                          {comp.strengths.map((s, j) => (
                            <div key={j} className="flex items-start gap-1.5 mb-1.5">
                              <Minus className="w-3 h-3 text-red-400 mt-0.5 flex-shrink-0" />
                              <span className="text-xs text-stone-600 leading-snug">{s}</span>
                            </div>
                          ))}
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold text-emerald-500 uppercase tracking-wider mb-2">You win on</p>
                          {comp.weaknesses.map((w, j) => (
                            <div key={j} className="flex items-start gap-1.5 mb-1.5">
                              <Check className="w-3 h-3 text-emerald-500 mt-0.5 flex-shrink-0" />
                              <span className="text-xs text-stone-600 leading-snug">{w}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Head to Head */}
          {data.headToHead && (
            <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-stone-100 bg-stone-50/50">
                <h2 className="text-base font-heading font-semibold text-stone-900">Head-to-head comparison</h2>
              </div>
              <div className="divide-y divide-stone-100">
                {[
                  { label: "Title", icon: "Aa", data: data.headToHead.title },
                  { label: "Photos", icon: "Img", data: data.headToHead.photos },
                  { label: "Reviews", icon: "★", data: data.headToHead.reviews },
                  { label: "Pricing", icon: "$", data: data.headToHead.pricing },
                ].map((item) => (
                  <div key={item.label} className="px-6 py-4">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="w-6 h-6 rounded-md bg-stone-100 flex items-center justify-center text-[10px] font-mono font-bold text-stone-500">{item.icon}</span>
                      <span className="text-sm font-medium text-stone-800">{item.label}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mb-2">
                      <div className="rounded-lg bg-brand-50/60 border border-brand-100 p-3">
                        <p className="text-[9px] font-bold text-brand-500 uppercase tracking-[0.15em] mb-1">Your listing</p>
                        <p className="text-xs text-stone-700 leading-relaxed">{item.data.user}</p>
                      </div>
                      <div className="rounded-lg bg-stone-50 border border-stone-100 p-3">
                        <p className="text-[9px] font-bold text-stone-400 uppercase tracking-[0.15em] mb-1">Top competitor</p>
                        <p className="text-xs text-stone-700 leading-relaxed">
                          {"bestCompetitor" in item.data ? item.data.bestCompetitor : ("competitors" in item.data ? item.data.competitors : "")}
                        </p>
                      </div>
                    </div>
                    <p className="text-[11px] text-stone-500 leading-relaxed">{item.data.verdict}</p>
                  </div>
                ))}

                {/* Amenity Gap */}
                {data.headToHead.amenities && (
                  <div className="px-6 py-4">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="w-6 h-6 rounded-md bg-stone-100 flex items-center justify-center text-[10px] font-mono font-bold text-stone-500">+/-</span>
                      <span className="text-sm font-medium text-stone-800">Amenity gap</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-[9px] font-bold text-red-500 uppercase tracking-[0.15em] mb-2">You&apos;re missing</p>
                        <div className="flex flex-wrap gap-1.5">
                          {data.headToHead.amenities.userMissing?.map((a, i) => (
                            <span key={i} className="text-[11px] bg-red-50 text-red-600 px-2 py-1 rounded-md border border-red-100">
                              <X className="w-2.5 h-2.5 inline mr-0.5" />{a}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-[9px] font-bold text-emerald-500 uppercase tracking-[0.15em] mb-2">Your advantage</p>
                        <div className="flex flex-wrap gap-1.5">
                          {data.headToHead.amenities.userAdvantage?.map((a, i) => (
                            <span key={i} className="text-[11px] bg-emerald-50 text-emerald-600 px-2 py-1 rounded-md border border-emerald-100">
                              <Check className="w-2.5 h-2.5 inline mr-0.5" />{a}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Alerts */}
          <div>
            <h2 className="text-base font-heading font-semibold text-stone-900 mb-3">Action items</h2>
            <div className="space-y-2">
              {data.alerts.map((alert, i) => {
                const Icon = alertIcons[alert.type];
                return (
                  <div key={i} className={`rounded-xl border border-stone-200 border-l-[3px] ${alertStyles[alert.type]} p-4 hover:shadow-sm transition-all`}>
                    <div className="flex items-start gap-3">
                      <Icon className="w-4 h-4 text-stone-500 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <h3 className="text-sm font-medium text-stone-900">{alert.title}</h3>
                          <span className={`w-1.5 h-1.5 rounded-full ${severityDot[alert.severity]}`} />
                        </div>
                        <p className="text-xs text-stone-500 mb-2 leading-relaxed">{alert.description}</p>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1">
                            <ArrowRight className="w-3 h-3 text-stone-400" />
                            <span className="text-xs text-stone-700 font-medium">{alert.action}</span>
                          </div>
                          <span className="text-[10px] text-stone-400 font-mono">{alert.impact}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Strengths & Weaknesses — compact */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-stone-200 p-5">
              <h3 className="text-sm font-heading font-semibold text-stone-900 mb-3">Your strengths</h3>
              {data.strengths.map((s, i) => (
                <div key={i} className="flex items-start gap-2 mb-2 last:mb-0">
                  <Check className="w-3.5 h-3.5 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <span className="text-xs text-stone-600 leading-relaxed">{s}</span>
                </div>
              ))}
            </div>
            <div className="bg-white rounded-xl border border-stone-200 p-5">
              <h3 className="text-sm font-heading font-semibold text-stone-900 mb-3">Improve these</h3>
              {data.weaknesses.map((w, i) => (
                <div key={i} className="flex items-start gap-2 mb-2 last:mb-0">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
                  <span className="text-xs text-stone-600 leading-relaxed">{w}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Market Insights */}
          <div className="bg-white rounded-xl border border-stone-200 p-5">
            <h3 className="text-sm font-heading font-semibold text-stone-900 mb-3">Market insights</h3>
            <div className="space-y-3">
              {data.marketInsights.map((mi, i) => (
                <div key={i} className="border-l-2 border-stone-200 pl-3 hover:border-brand-300 transition-colors">
                  <p className="text-xs text-stone-700 leading-relaxed">{mi.insight}</p>
                  <p className="text-[10px] text-stone-400 mt-0.5 font-mono">{mi.source}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Suggested Amenities */}
          {data.suggestedAmenities.length > 0 && (
            <div className="bg-white rounded-xl border border-stone-200 p-5">
              <h3 className="text-sm font-heading font-semibold text-stone-900 mb-3">Amenities to consider adding</h3>
              <div className="flex flex-wrap gap-2">
                {data.suggestedAmenities.map((a, i) => (
                  <span key={i} className="text-xs bg-stone-50 text-stone-600 px-3 py-1.5 rounded-lg border border-stone-200 hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700 transition-all cursor-default">
                    {a}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
