"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface AuditData {
  audit: {
    property_name: string;
    overall_score: number;
    summary: string;
    categories: { name: string; grade: string; score: number }[];
  };
  url: string;
}

function scoreColor(score: number) {
  if (score >= 80) return "text-green-600";
  if (score >= 60) return "text-yellow-600";
  if (score >= 40) return "text-orange-600";
  return "text-red-600";
}

export default function DashboardPage() {
  const [auditData, setAuditData] = useState<AuditData | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem("audit_result");
    if (stored) setAuditData(JSON.parse(stored));
  }, []);

  const activities = [
    { time: "Just now", action: "Listing audit completed", type: "audit", icon: "🔍" },
    { time: "Ready", action: "3 social posts prepared for your review", type: "social", icon: "📸" },
    { time: "Ready", action: "Optimized listing copy ready to copy-paste", type: "listing", icon: "✍️" },
    { time: "Ready", action: "2 review response drafts waiting", type: "review", icon: "⭐" },
    { time: "Upcoming", action: "Seasonal update: Spring content scheduled", type: "seasonal", icon: "🌸" },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-gray-500 mt-1">
            {auditData ? auditData.audit.property_name : "Your property overview"}
          </p>
        </div>
        <Link
          href="/dashboard/deliverables"
          className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-400 transition"
        >
          📦 View Deliverables
          <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs">5 new</span>
        </Link>
      </div>

      {/* Score + Stats */}
      <div className="grid md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <p className="text-sm text-gray-500 mb-1">Listing Score</p>
          <p className={`text-3xl font-bold ${scoreColor(auditData?.audit.overall_score || 0)}`}>
            {auditData?.audit.overall_score || "—"}
            <span className="text-gray-300 text-lg font-normal">/100</span>
          </p>
          <p className="text-xs text-gray-400 mt-1">Updated today</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <p className="text-sm text-gray-500 mb-1">Pending Deliverables</p>
          <p className="text-3xl font-bold text-gray-900">5</p>
          <p className="text-xs text-green-600 mt-1">Ready for review</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <p className="text-sm text-gray-500 mb-1">Tasks This Week</p>
          <p className="text-3xl font-bold text-gray-900">12</p>
          <p className="text-xs text-gray-400 mt-1">Completed by your AI team</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <p className="text-sm text-gray-500 mb-1">Score Trend</p>
          <p className="text-3xl font-bold text-green-600">+0</p>
          <p className="text-xs text-gray-400 mt-1">Since last week</p>
        </div>
      </div>

      {/* Category Scores */}
      {auditData && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
          <h2 className="font-semibold mb-4">Category Breakdown</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {auditData.audit.categories.map((cat) => (
              <div key={cat.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-700">{cat.name}</span>
                <div className="flex items-center gap-2">
                  <div className="w-16 bg-gray-200 rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full"
                      style={{
                        width: `${cat.score}%`,
                        backgroundColor: cat.score >= 80 ? "#22c55e" : cat.score >= 60 ? "#eab308" : "#f97316",
                      }}
                    />
                  </div>
                  <span className="text-sm font-semibold w-6 text-right">{cat.grade}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Activity Feed */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="font-semibold mb-4">Recent Activity</h2>
        <div className="space-y-4">
          {activities.map((item, i) => (
            <div key={i} className="flex items-start gap-3">
              <span className="text-xl mt-0.5">{item.icon}</span>
              <div className="flex-1">
                <p className="text-sm text-gray-700">{item.action}</p>
                <p className="text-xs text-gray-400">{item.time}</p>
              </div>
              {item.type !== "seasonal" && (
                <Link
                  href="/dashboard/deliverables"
                  className="text-xs text-green-600 font-medium hover:text-green-700"
                >
                  Review →
                </Link>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
