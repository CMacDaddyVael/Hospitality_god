"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  ArrowRight,
  TrendingUp,
  Camera,
  Inbox,
  Shield,
  Activity,
  CheckCircle2,
  MessageSquare,
  Image,
  FileText,
  Zap,
  ChevronRight,
  BarChart3,
  Clock,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

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

interface ActivityItem {
  id: number;
  icon: typeof CheckCircle2;
  label: string;
  detail: string;
  time: string;
  color: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function scoreColor(score: number) {
  if (score >= 80) return "text-emerald-600";
  if (score >= 60) return "text-amber-500";
  if (score >= 40) return "text-orange-500";
  return "text-red-500";
}

function scoreTrackColor(score: number) {
  if (score >= 80) return "#059669";
  if (score >= 60) return "#f59e0b";
  if (score >= 40) return "#f97316";
  return "#ef4444";
}

function barColor(score: number) {
  if (score >= 80) return "bg-emerald-500";
  if (score >= 60) return "bg-amber-400";
  if (score >= 40) return "bg-orange-400";
  return "bg-red-400";
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

/** Circular SVG gauge */
function ScoreGauge({ score, size = 128 }: { score: number; size?: number }) {
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#E7E5E4"
          strokeWidth={strokeWidth}
        />
        {/* Score arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={scoreTrackColor(score)}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-3xl font-bold font-mono tracking-tight ${scoreColor(score)}`}>
          {score}
        </span>
        <span className="text-[11px] text-stone-400 font-medium mt-0.5">/ 100</span>
      </div>
    </div>
  );
}

/** Skeleton placeholder */
function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-stone-100 ${className}`} />;
}

/** Stagger wrapper for fade-in animations */
function FadeIn({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  return (
    <div
      className={`transition-all duration-500 ease-out ${className} ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
      }`}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Mock activity feed (would come from API in production)             */
/* ------------------------------------------------------------------ */

const MOCK_ACTIVITY: ActivityItem[] = [
  {
    id: 1,
    icon: CheckCircle2,
    label: "Listing audit completed",
    detail: "Identified 5 optimization opportunities",
    time: "2 hours ago",
    color: "text-emerald-500",
  },
  {
    id: 2,
    icon: Image,
    label: "Generated 2 lifestyle photos",
    detail: "Pool sunset scene, Morning coffee patio",
    time: "4 hours ago",
    color: "text-brand-500",
  },
  {
    id: 3,
    icon: MessageSquare,
    label: "Drafted review response",
    detail: "5-star review from Sarah M.",
    time: "6 hours ago",
    color: "text-blue-500",
  },
  {
    id: 4,
    icon: FileText,
    label: "Social post created",
    detail: "Instagram reel concept for weekend",
    time: "Yesterday",
    color: "text-violet-500",
  },
  {
    id: 5,
    icon: BarChart3,
    label: "Competitor analysis refreshed",
    detail: "Tracked 4 nearby listings",
    time: "Yesterday",
    color: "text-amber-500",
  },
];

/* ------------------------------------------------------------------ */
/*  Quick action cards config                                          */
/* ------------------------------------------------------------------ */

const QUICK_ACTIONS = [
  {
    href: "/dashboard/deliverables",
    icon: Inbox,
    title: "Content Inbox",
    description: "Review social posts, listing updates, and review responses your agent prepared.",
    cta: "Open inbox",
  },
  {
    href: "/dashboard/photos",
    icon: Camera,
    title: "Photo Studio",
    description: "Generate lifestyle photos of guests enjoying your property with AI casting.",
    cta: "Create photos",
  },
  {
    href: "/dashboard/competitors",
    icon: Shield,
    title: "Competitive Intel",
    description: "See how you stack up against nearby listings and get market-change alerts.",
    cta: "View market",
  },
];

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function DashboardPage() {
  const [auditData, setAuditData] = useState<AuditData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = sessionStorage.getItem("audit_result");
    if (stored) setAuditData(JSON.parse(stored));
    // Simulate brief loading to show skeleton then reveal
    const t = setTimeout(() => setIsLoading(false), 400);
    return () => clearTimeout(t);
  }, []);

  const topFix = auditData?.audit.top_5_fixes?.[0];

  /* Agent status summary line */
  const agentSummary = useMemo(() => {
    if (!auditData) return null;
    const fixes = auditData.audit.top_5_fixes?.length ?? 0;
    return `Your agent checked ${auditData.audit.categories.length} listing categories, found ${fixes} optimization${fixes !== 1 ? "s" : ""}, and drafted content for this week.`;
  }, [auditData]);

  /* ---- Loading skeleton ---- */
  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-80" />
        <Skeleton className="h-5 w-60" />
        <Skeleton className="h-16 w-full rounded-xl" />
        <div className="grid md:grid-cols-3 gap-4">
          <Skeleton className="h-52 rounded-xl" />
          <Skeleton className="h-52 rounded-xl md:col-span-2" />
        </div>
        <div className="grid sm:grid-cols-3 gap-4">
          <Skeleton className="h-44 rounded-xl" />
          <Skeleton className="h-44 rounded-xl" />
          <Skeleton className="h-44 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ------------------------------------------------------------ */}
      {/*  Header                                                       */}
      {/* ------------------------------------------------------------ */}
      <FadeIn>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900">
            {auditData ? auditData.audit.property_name : "Welcome back"}
          </h1>
          <p className="text-stone-500 mt-1 text-sm leading-relaxed">
            Here&apos;s what your AI marketing team has been working on.
          </p>
        </div>
      </FadeIn>

      {/* ------------------------------------------------------------ */}
      {/*  Agent Status Bar                                             */}
      {/* ------------------------------------------------------------ */}
      <FadeIn delay={60}>
        <div className="relative overflow-hidden rounded-xl border border-stone-200 bg-gradient-to-r from-stone-900 to-stone-800 px-5 py-4">
          {/* Subtle grid overlay */}
          <div className="pointer-events-none absolute inset-0 opacity-[0.04]" style={{
            backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='40' height='40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h40v40' fill='none' stroke='white' stroke-width='.5'/%3E%3C/svg%3E\")",
          }} />
          <div className="relative flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500/20 ring-1 ring-brand-500/30">
              <Activity className="h-4 w-4 text-brand-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                <span className="text-xs font-semibold uppercase tracking-wider text-stone-400">
                  Agent active
                </span>
              </div>
              <p className="text-sm text-stone-300 leading-relaxed truncate">
                {agentSummary ??
                  "Your agent is ready. Run an audit to start optimizing your listings."}
              </p>
            </div>
            <Link
              href="/dashboard/deliverables"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3.5 py-2 text-xs font-medium text-white backdrop-blur transition hover:bg-white/20"
            >
              View deliverables
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </FadeIn>

      {/* ------------------------------------------------------------ */}
      {/*  This Week's Priority                                         */}
      {/* ------------------------------------------------------------ */}
      {topFix && (
        <FadeIn delay={120}>
          <div className="group relative overflow-hidden rounded-xl border border-brand-200 bg-gradient-to-br from-brand-50/80 via-white to-white p-6 transition-all hover:shadow-md hover:border-brand-300">
            {/* Decorative accent */}
            <div className="absolute top-0 left-0 h-full w-1 bg-brand-500 rounded-l-xl" />
            <div className="flex items-start gap-4 pl-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-100">
                <Zap className="h-5 w-5 text-brand-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-600 mb-1">
                  This week&apos;s priority
                </p>
                <h3 className="text-base font-semibold tracking-tight text-stone-900 mb-1.5">
                  {topFix.title}
                </h3>
                <p className="text-sm text-stone-500 leading-relaxed mb-3">
                  {topFix.description}
                </p>
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
                  <TrendingUp className="h-3 w-3" />
                  {topFix.impact}
                </span>
              </div>
              <Link
                href="/dashboard/deliverables"
                className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-brand-700 hover:shadow-md group-hover:translate-x-0"
              >
                View fix
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
          </div>
        </FadeIn>
      )}

      {/* ------------------------------------------------------------ */}
      {/*  Score + Category Breakdown                                    */}
      {/* ------------------------------------------------------------ */}
      <FadeIn delay={180}>
        <div className="grid md:grid-cols-3 gap-4">
          {/* Score gauge card */}
          <div className="bg-white rounded-xl border border-stone-200 p-6 flex flex-col items-center justify-center transition-all hover:shadow-md hover:border-stone-300">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-400 mb-4 self-start">
              Listing Score
            </p>
            {auditData ? (
              <ScoreGauge score={auditData.audit.overall_score} />
            ) : (
              <div className="flex flex-col items-center justify-center py-4">
                <div className="relative" style={{ width: 128, height: 128 }}>
                  <svg width={128} height={128} className="-rotate-90">
                    <circle cx={64} cy={64} r={54} fill="none" stroke="#E7E5E4" strokeWidth={10} />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-bold font-mono text-stone-200">&mdash;</span>
                  </div>
                </div>
                <p className="text-xs text-stone-400 mt-3">Run an audit to get your score</p>
              </div>
            )}
          </div>

          {/* Categories breakdown */}
          <div className="bg-white rounded-xl border border-stone-200 p-6 md:col-span-2 transition-all hover:shadow-md hover:border-stone-300">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-400 mb-4">
              Category Breakdown
            </p>
            {auditData ? (
              <div className="space-y-3">
                {auditData.audit.categories.map((cat) => (
                  <div key={cat.name} className="group/bar">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium text-stone-700">{cat.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-semibold text-stone-500">
                          {cat.score}
                        </span>
                        <span className="text-[10px] font-semibold text-stone-400 bg-stone-100 rounded px-1.5 py-0.5">
                          {cat.grade}
                        </span>
                      </div>
                    </div>
                    <div className="h-2 w-full rounded-full bg-stone-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ease-out ${barColor(cat.score)}`}
                        style={{ width: `${cat.score}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <BarChart3 className="h-8 w-8 text-stone-200 mb-3" />
                <p className="text-sm text-stone-400">
                  Category scores will appear after your first audit
                </p>
              </div>
            )}
          </div>
        </div>
      </FadeIn>

      {/* ------------------------------------------------------------ */}
      {/*  Quick Actions                                                 */}
      {/* ------------------------------------------------------------ */}
      <FadeIn delay={240}>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-400 mb-3">
            Quick Actions
          </p>
          <div className="grid sm:grid-cols-3 gap-4">
            {QUICK_ACTIONS.map((action, i) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.href}
                  href={action.href}
                  className="group relative bg-white rounded-xl border border-stone-200 p-6 transition-all duration-200 hover:shadow-md hover:border-stone-300 hover:-translate-y-0.5"
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-stone-50 border border-stone-100 mb-4 transition-colors group-hover:bg-brand-50 group-hover:border-brand-100">
                    <Icon className="h-5 w-5 text-stone-400 transition-colors group-hover:text-brand-500" />
                  </div>
                  <h3 className="text-sm font-semibold tracking-tight text-stone-900 mb-1">
                    {action.title}
                  </h3>
                  <p className="text-xs text-stone-500 leading-relaxed mb-4">
                    {action.description}
                  </p>
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 transition-all group-hover:gap-2">
                    {action.cta}
                    <ChevronRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </FadeIn>

      {/* ------------------------------------------------------------ */}
      {/*  Recent Agent Activity                                         */}
      {/* ------------------------------------------------------------ */}
      <FadeIn delay={300}>
        <div className="bg-white rounded-xl border border-stone-200 p-6 transition-all hover:shadow-md hover:border-stone-300">
          <div className="flex items-center justify-between mb-5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
              Recent Activity
            </p>
            <Link
              href="/dashboard/deliverables"
              className="text-xs font-medium text-brand-600 hover:text-brand-700 transition inline-flex items-center gap-1"
            >
              View all
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="relative">
            {/* Vertical timeline line */}
            <div className="absolute left-[15px] top-2 bottom-2 w-px bg-stone-100" />

            <div className="space-y-0">
              {MOCK_ACTIVITY.map((item, i) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.id}
                    className="group relative flex items-start gap-4 py-3 first:pt-0 last:pb-0"
                    style={{
                      animationDelay: `${300 + i * 50}ms`,
                    }}
                  >
                    {/* Timeline dot */}
                    <div className="relative z-10 flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-white border border-stone-200 transition-all group-hover:border-stone-300 group-hover:shadow-sm">
                      <Icon className={`h-3.5 w-3.5 ${item.color}`} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 pt-0.5">
                      <p className="text-sm font-medium text-stone-800 leading-snug">
                        {item.label}
                      </p>
                      <p className="text-xs text-stone-400 mt-0.5 leading-relaxed">
                        {item.detail}
                      </p>
                    </div>

                    {/* Timestamp */}
                    <div className="flex items-center gap-1 pt-1 shrink-0">
                      <Clock className="h-3 w-3 text-stone-300" />
                      <span className="text-[11px] font-mono text-stone-400">{item.time}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </FadeIn>
    </div>
  );
}
