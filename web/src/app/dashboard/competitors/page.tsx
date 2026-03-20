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

interface CompetitorData {
  location: string;
  propertyType: string;
  priceRange: string;
  alerts: Alert[];
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
