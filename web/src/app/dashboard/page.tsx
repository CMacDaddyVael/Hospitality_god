"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, TrendingUp, Camera, Inbox, Shield } from "lucide-react";

interface AuditData {
  audit: {
    property_name: string;
    overall_score: number;
    summary: string;
    categories: { name: string; grade: string; score: number }[];
    top_5_fixes: { priority: number; title: string; description: string; impact: string }[];
  };
  url: string;
}

function scoreColor(score: number) {
  if (score >= 80) return "text-emerald-600";
  if (score >= 60) return "text-amber-600";
  if (score >= 40) return "text-orange-600";
  return "text-red-600";
}

export default function DashboardPage() {
  const [auditData, setAuditData] = useState<AuditData | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem("audit_result");
    if (stored) setAuditData(JSON.parse(stored));
  }, []);

  const topFix = auditData?.audit.top_5_fixes?.[0];

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-stone-900">
          {auditData ? auditData.audit.property_name : "Welcome back"}
        </h1>
        <p className="text-stone-500 mt-1 text-sm">
          Here&apos;s what your marketing team has been working on.
        </p>
      </div>

      {/* Priority Card */}
      {topFix && (
        <div className="bg-white rounded-xl border border-stone-200 p-6 mb-6 hover:border-stone-300 transition-colors">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center flex-shrink-0">
              <TrendingUp className="w-5 h-5 text-brand-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-brand-600 uppercase tracking-wide mb-1">This week&apos;s priority</p>
              <h3 className="font-semibold text-stone-900 mb-1">{topFix.title}</h3>
              <p className="text-sm text-stone-500 mb-3">{topFix.description}</p>
              <span className="text-xs text-emerald-600 font-medium">{topFix.impact}</span>
            </div>
            <Link
              href="/dashboard/deliverables"
              className="flex-shrink-0 px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition"
            >
              View fix
            </Link>
          </div>
        </div>
      )}

      {/* Score + Quick Actions */}
      <div className="grid md:grid-cols-3 gap-4 mb-8">
        {/* Score */}
        <div className="bg-white rounded-xl border border-stone-200 p-6">
          <p className="text-xs font-medium text-stone-400 uppercase tracking-wide mb-3">Listing Score</p>
          {auditData ? (
            <>
              <p className={`text-4xl font-bold font-mono ${scoreColor(auditData.audit.overall_score)}`}>
                {auditData.audit.overall_score}
              </p>
              <p className="text-xs text-stone-400 mt-1">out of 100</p>
            </>
          ) : (
            <>
              <p className="text-4xl font-bold font-mono text-stone-300">—</p>
              <p className="text-xs text-stone-400 mt-1">Run an audit to get your score</p>
            </>
          )}
        </div>

        {/* Categories */}
        {auditData && (
          <div className="bg-white rounded-xl border border-stone-200 p-6 md:col-span-2">
            <p className="text-xs font-medium text-stone-400 uppercase tracking-wide mb-3">Breakdown</p>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              {auditData.audit.categories.map((cat) => (
                <div key={cat.name} className="flex items-center justify-between">
                  <span className="text-sm text-stone-600 truncate mr-2">{cat.name}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-12 bg-stone-100 rounded-full h-1.5">
                      <div
                        className="h-1.5 rounded-full"
                        style={{
                          width: `${cat.score}%`,
                          backgroundColor: cat.score >= 80 ? "#059669" : cat.score >= 60 ? "#d97706" : "#ea580c",
                        }}
                      />
                    </div>
                    <span className="text-xs font-semibold text-stone-700 w-4">{cat.grade}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid sm:grid-cols-3 gap-4">
        <Link
          href="/dashboard/deliverables"
          className="group bg-white rounded-xl border border-stone-200 p-6 hover:border-stone-300 hover:shadow-sm transition-all"
        >
          <Inbox className="w-8 h-8 text-stone-300 group-hover:text-brand-500 transition mb-3" />
          <h3 className="font-semibold text-stone-900 mb-1 text-sm">Content Inbox</h3>
          <p className="text-xs text-stone-500">Review social posts, listing updates, and review responses your team prepared.</p>
          <span className="inline-flex items-center gap-1 text-xs text-brand-600 font-medium mt-3 group-hover:gap-2 transition-all">
            Open inbox <ArrowRight className="w-3 h-3" />
          </span>
        </Link>

        <Link
          href="/dashboard/photos"
          className="group bg-white rounded-xl border border-stone-200 p-6 hover:border-stone-300 hover:shadow-sm transition-all"
        >
          <Camera className="w-8 h-8 text-stone-300 group-hover:text-brand-500 transition mb-3" />
          <h3 className="font-semibold text-stone-900 mb-1 text-sm">Photo Studio</h3>
          <p className="text-xs text-stone-500">Generate lifestyle photos of guests enjoying your property. Pick your cast and scene.</p>
          <span className="inline-flex items-center gap-1 text-xs text-brand-600 font-medium mt-3 group-hover:gap-2 transition-all">
            Create photos <ArrowRight className="w-3 h-3" />
          </span>
        </Link>

        <Link
          href="/dashboard/competitors"
          className="group bg-white rounded-xl border border-stone-200 p-6 hover:border-stone-300 hover:shadow-sm transition-all"
        >
          <Shield className="w-8 h-8 text-stone-300 group-hover:text-brand-500 transition mb-3" />
          <h3 className="font-semibold text-stone-900 mb-1 text-sm">Competitive Intel</h3>
          <p className="text-xs text-stone-500">See how you compare to nearby listings and get alerts on market changes.</p>
          <span className="inline-flex items-center gap-1 text-xs text-brand-600 font-medium mt-3 group-hover:gap-2 transition-all">
            View market <ArrowRight className="w-3 h-3" />
          </span>
        </Link>
      </div>
    </div>
  );
}
