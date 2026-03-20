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
  Sparkles,
  ArrowUpRight,
  RefreshCw,
  Target,
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
    top_5_fixes: {
      priority: number;
      title: string;
      description: string;
      impact: string;
    }[];
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
  bg: string;
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

function scoreTrackGlow(score: number) {
  if (score >= 80) return "rgba(5, 150, 105, 0.2)";
  if (score >= 60) return "rgba(245, 158, 11, 0.2)";
  if (score >= 40) return "rgba(249, 115, 22, 0.2)";
  return "rgba(239, 68, 68, 0.2)";
}

function barColor(score: number) {
  if (score >= 80) return "bg-emerald-500";
  if (score >= 60) return "bg-amber-400";
  if (score >= 40) return "bg-orange-400";
  return "bg-red-400";
}

function gradeColorClass(grade: string) {
  const m: Record<string, string> = {
    A: "text-emerald-700 bg-emerald-50 border-emerald-200",
    B: "text-blue-700 bg-blue-50 border-blue-200",
    C: "text-amber-700 bg-amber-50 border-amber-200",
    D: "text-orange-700 bg-orange-50 border-orange-200",
    F: "text-red-700 bg-red-50 border-red-200",
  };
  return m[grade] || m.C;
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

/** Circular SVG gauge with glow and label */
function ScoreGauge({ score, size = 140 }: { score: number; size?: number }) {
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        {/* Glow */}
        <div
          className="absolute inset-2 rounded-full transition-all duration-1000"
          style={{ boxShadow: `0 0 40px ${scoreTrackGlow(score)}` }}
        />
        <svg width={size} height={size} className="-rotate-90">
          {/* Background track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#F5F5F4"
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
          <span
            className={`text-4xl font-bold font-mono tracking-tight ${scoreColor(score)}`}
          >
            {score}
          </span>
          <span className="text-xs text-stone-400 font-medium mt-0.5">
            / 100
          </span>
        </div>
      </div>
      <span className="text-xs font-medium text-stone-400 mt-3">
        Listing Score
      </span>
    </div>
  );
}

/** Skeleton placeholder */
function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-xl bg-stone-100 ${className}`} />
  );
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
/*  Mock activity feed                                                 */
/* ------------------------------------------------------------------ */

const MOCK_ACTIVITY: ActivityItem[] = [
  {
    id: 1,
    icon: CheckCircle2,
    label: "Listing audit completed",
    detail: "Identified 5 optimization opportunities",
    time: "2h ago",
    color: "text-emerald-500",
    bg: "bg-emerald-50",
  },
  {
    id: 2,
    icon: Image,
    label: "Generated 2 lifestyle photos",
    detail: "Pool sunset scene, Morning coffee patio",
    time: "4h ago",
    color: "text-brand-500",
    bg: "bg-brand-50",
  },
  {
    id: 3,
    icon: MessageSquare,
    label: "Drafted review response",
    detail: "5-star review from Sarah M.",
    time: "6h ago",
    color: "text-blue-500",
    bg: "bg-blue-50",
  },
  {
    id: 4,
    icon: FileText,
    label: "Social post created",
    detail: "Instagram reel concept for weekend",
    time: "1d ago",
    color: "text-violet-500",
    bg: "bg-violet-50",
  },
  {
    id: 5,
    icon: BarChart3,
    label: "Competitor analysis refreshed",
    detail: "Tracked 4 nearby listings",
    time: "1d ago",
    color: "text-amber-500",
    bg: "bg-amber-50",
  },
];

/* ------------------------------------------------------------------ */
/*  Quick action cards                                                 */
/* ------------------------------------------------------------------ */

const QUICK_ACTIONS = [
  {
    href: "/dashboard/deliverables",
    icon: Inbox,
    title: "Content Inbox",
    description:
      "Review social posts, listing updates, and review responses your agent prepared.",
    cta: "Open inbox",
    accent: "group-hover:from-rose-500/5 group-hover:to-orange-500/5",
    iconHoverBg: "group-hover:bg-rose-50 group-hover:border-rose-100",
    iconHoverColor: "group-hover:text-rose-500",
  },
  {
    href: "/dashboard/photos",
    icon: Camera,
    title: "Photo Studio",
    description:
      "Generate lifestyle photos of guests enjoying your property with AI casting.",
    cta: "Create photos",
    accent: "group-hover:from-violet-500/5 group-hover:to-blue-500/5",
    iconHoverBg: "group-hover:bg-violet-50 group-hover:border-violet-100",
    iconHoverColor: "group-hover:text-violet-500",
  },
  {
    href: "/dashboard/competitors",
    icon: Shield,
    title: "Competitive Intel",
    description:
      "See how you stack up against nearby listings and get market-change alerts.",
    cta: "View market",
    accent: "group-hover:from-amber-500/5 group-hover:to-yellow-500/5",
    iconHoverBg: "group-hover:bg-amber-50 group-hover:border-amber-100",
    iconHoverColor: "group-hover:text-amber-500",
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
    const t = setTimeout(() => setIsLoading(false), 400);
    return () => clearTimeout(t);
  }, []);

  const topFix = auditData?.audit.top_5_fixes?.[0];

  const agentSummary = useMemo(() => {
    if (!auditData) return null;
    const fixes = auditData.audit.top_5_fixes?.length ?? 0;
    return `Checked ${auditData.audit.categories.length} listing categories, found ${fixes} optimization${fixes !== 1 ? "s" : ""}, and drafted content for this week.`;
  }, [auditData]);

  /* ---- Loading skeleton ---- */
  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-80" />
        <Skeleton className="h-5 w-60" />
        <Skeleton className="h-20 w-full" />
        <div className="grid md:grid-cols-3 gap-5">
          <Skeleton className="h-56" />
          <Skeleton className="h-56 md:col-span-2" />
        </div>
        <div className="grid sm:grid-cols-3 gap-5">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
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
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-heading text-2xl font-bold tracking-tight text-stone-900">
              {auditData ? auditData.audit.property_name : "Welcome back"}
            </h1>
            <p className="text-stone-500 mt-1 text-sm leading-relaxed">
              Here&apos;s what your AI marketing team has been working on.
            </p>
          </div>
          {auditData && (
            <Link
              href="/dashboard/deliverables"
              className="hidden sm:inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700 transition-colors"
            >
              View deliverables
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      </FadeIn>

      {/* ------------------------------------------------------------ */}
      {/*  Agent Status Banner                                          */}
      {/* ------------------------------------------------------------ */}
      <FadeIn delay={60}>
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-stone-900 via-stone-900 to-stone-800 p-6 shadow-lg shadow-stone-900/10">
          {/* Grid pattern */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)",
              backgroundSize: "32px 32px",
            }}
          />
          {/* Brand glow */}
          <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-brand-600/10 blur-[60px]" />

          <div className="relative flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500/20 to-brand-600/20 ring-1 ring-brand-500/20">
              <Activity className="h-5 w-5 text-brand-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2.5 mb-1">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-emerald-400">
                  Agent active
                </span>
              </div>
              <p className="text-sm text-stone-300 leading-relaxed">
                {agentSummary ??
                  "Your agent is ready. Run an audit to start optimizing your listings."}
              </p>
            </div>
            <Link
              href="/dashboard/deliverables"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-lg bg-white/10 hover:bg-white/[0.15] border border-white/[0.08] px-4 py-2.5 text-xs font-medium text-white backdrop-blur-sm transition-all active:scale-[0.98]"
            >
              View deliverables
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {/* Stats row inside banner */}
          {auditData && (
            <div className="relative mt-5 pt-5 border-t border-white/[0.06] grid grid-cols-3 gap-4">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-white/30 mb-1">
                  Score
                </p>
                <p className="text-lg font-bold font-mono text-white">
                  {auditData.audit.overall_score}
                  <span className="text-white/30 text-sm font-normal">
                    /100
                  </span>
                </p>
              </div>
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-white/30 mb-1">
                  Categories
                </p>
                <p className="text-lg font-bold font-mono text-white">
                  {auditData.audit.categories.length}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-white/30 mb-1">
                  Fixes found
                </p>
                <p className="text-lg font-bold font-mono text-white">
                  {auditData.audit.top_5_fixes?.length ?? 0}
                </p>
              </div>
            </div>
          )}
        </div>
      </FadeIn>

      {/* ------------------------------------------------------------ */}
      {/*  This Week's Priority                                         */}
      {/* ------------------------------------------------------------ */}
      {topFix && (
        <FadeIn delay={120}>
          <div className="group relative overflow-hidden rounded-2xl border border-brand-200/80 bg-gradient-to-br from-brand-50/60 via-white to-white p-6 transition-all duration-300 hover:shadow-lg hover:shadow-brand-100/50 hover:border-brand-300">
            {/* Left accent bar */}
            <div className="absolute top-0 left-0 h-full w-1 bg-gradient-to-b from-brand-500 to-brand-400 rounded-l-2xl" />
            <div className="flex items-start gap-4 pl-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-100 border border-brand-200/50">
                <Target className="h-5 w-5 text-brand-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-brand-600 mb-1.5">
                  This week&apos;s priority
                </p>
                <h3 className="font-heading text-base font-semibold tracking-tight text-stone-900 mb-1.5">
                  {topFix.title}
                </h3>
                <p className="text-sm text-stone-500 leading-relaxed mb-3">
                  {topFix.description}
                </p>
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-full">
                  <TrendingUp className="h-3 w-3" />
                  {topFix.impact}
                </span>
              </div>
              <Link
                href="/dashboard/deliverables"
                className="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-brand-700 hover:shadow-md active:scale-[0.98]"
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
        <div className="grid md:grid-cols-3 gap-5">
          {/* Score gauge card */}
          <div className="bg-white rounded-2xl border border-stone-200/80 p-6 flex flex-col items-center justify-center transition-all duration-300 hover:shadow-lg hover:shadow-stone-200/40 hover:border-stone-300 hover:-translate-y-0.5">
            {auditData ? (
              <ScoreGauge score={auditData.audit.overall_score} />
            ) : (
              <div className="flex flex-col items-center justify-center py-6">
                <div className="relative" style={{ width: 140, height: 140 }}>
                  <svg width={140} height={140} className="-rotate-90">
                    <circle
                      cx={70}
                      cy={70}
                      r={64}
                      fill="none"
                      stroke="#F5F5F4"
                      strokeWidth={12}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-4xl font-bold font-mono text-stone-200">
                      &mdash;
                    </span>
                  </div>
                </div>
                <p className="text-xs text-stone-400 mt-4 text-center">
                  Run an audit to get your score
                </p>
              </div>
            )}
          </div>

          {/* Categories breakdown */}
          <div className="bg-white rounded-2xl border border-stone-200/80 p-6 md:col-span-2 transition-all duration-300 hover:shadow-lg hover:shadow-stone-200/40 hover:border-stone-300">
            <div className="flex items-center justify-between mb-5">
              <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-stone-400">
                Category Breakdown
              </p>
              {auditData && (
                <span className="text-xs text-stone-400 font-mono">
                  {auditData.audit.categories.length} categories
                </span>
              )}
            </div>
            {auditData ? (
              <div className="space-y-4">
                {auditData.audit.categories.map((cat) => (
                  <div key={cat.name} className="group/bar">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-stone-700">
                        {cat.name}
                      </span>
                      <div className="flex items-center gap-2.5">
                        <span className="text-xs font-mono font-semibold text-stone-500">
                          {cat.score}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${gradeColorClass(cat.grade)}`}
                        >
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
              <div className="flex flex-col items-center justify-center py-14 text-center">
                <div className="w-14 h-14 rounded-2xl bg-stone-50 border border-stone-100 flex items-center justify-center mb-4">
                  <BarChart3 className="h-6 w-6 text-stone-300" />
                </div>
                <p className="text-sm font-medium text-stone-400 mb-1">
                  No data yet
                </p>
                <p className="text-xs text-stone-400">
                  Category scores appear after your first audit
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
          <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-stone-400 mb-4">
            Quick Actions
          </p>
          <div className="grid sm:grid-cols-3 gap-5">
            {QUICK_ACTIONS.map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.href}
                  href={action.href}
                  className={`group relative bg-white rounded-2xl border border-stone-200/80 p-6 transition-all duration-300 hover:shadow-lg hover:shadow-stone-200/40 hover:border-stone-300 hover:-translate-y-1 overflow-hidden`}
                >
                  {/* Hover gradient fill */}
                  <div
                    className={`absolute inset-0 bg-gradient-to-br from-transparent to-transparent ${action.accent} transition-all duration-300 rounded-2xl`}
                  />
                  <div className="relative">
                    <div
                      className={`flex h-11 w-11 items-center justify-center rounded-xl bg-stone-50 border border-stone-100 mb-5 transition-all duration-300 ${action.iconHoverBg}`}
                    >
                      <Icon
                        className={`h-5 w-5 text-stone-400 transition-colors duration-300 ${action.iconHoverColor}`}
                      />
                    </div>
                    <h3 className="font-heading text-sm font-semibold tracking-tight text-stone-900 mb-1.5">
                      {action.title}
                    </h3>
                    <p className="text-xs text-stone-500 leading-relaxed mb-5">
                      {action.description}
                    </p>
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-600 transition-all group-hover:gap-2.5">
                      {action.cta}
                      <ArrowUpRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    </span>
                  </div>
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
        <div className="bg-white rounded-2xl border border-stone-200/80 p-6 transition-all duration-300 hover:shadow-lg hover:shadow-stone-200/40 hover:border-stone-300">
          <div className="flex items-center justify-between mb-6">
            <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-stone-400">
              Recent Activity
            </p>
            <Link
              href="/dashboard/deliverables"
              className="text-xs font-semibold text-brand-600 hover:text-brand-700 transition inline-flex items-center gap-1.5"
            >
              View all
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="relative">
            {/* Vertical timeline line */}
            <div className="absolute left-[19px] top-3 bottom-3 w-px bg-gradient-to-b from-stone-200 via-stone-100 to-transparent" />

            <div className="space-y-1">
              {MOCK_ACTIVITY.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.id}
                    className="group relative flex items-start gap-4 py-3 px-2 -mx-2 rounded-xl hover:bg-stone-50/70 transition-colors first:pt-1 last:pb-1"
                  >
                    {/* Timeline dot */}
                    <div
                      className={`relative z-10 flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-xl ${item.bg} border border-stone-100 transition-all group-hover:shadow-sm group-hover:scale-105`}
                    >
                      <Icon className={`h-4 w-4 ${item.color}`} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 pt-1">
                      <p className="text-sm font-medium text-stone-800 leading-snug">
                        {item.label}
                      </p>
                      <p className="text-xs text-stone-400 mt-0.5 leading-relaxed">
                        {item.detail}
                      </p>
                    </div>

                    {/* Timestamp */}
                    <div className="flex items-center gap-1.5 pt-1.5 shrink-0">
                      <Clock className="h-3 w-3 text-stone-300" />
                      <span className="text-[11px] font-mono text-stone-400">
                        {item.time}
                      </span>
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
