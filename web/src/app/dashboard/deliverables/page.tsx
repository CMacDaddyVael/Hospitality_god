"use client";

import { useState, useEffect } from "react";
import {
  Users,
  Instagram,
  FileText,
  Star,
  Leaf,
  Copy,
  Check,
  CheckCircle2,
  X,
  Image,
  Sparkles,
  Calendar,
  ArrowRight,
  TrendingUp,
  Clock,
  AlertCircle,
  ChevronDown,
  Inbox,
  RefreshCw,
  Zap,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface CastMember {
  id: string;
  name: string;
  gender: string;
  ethnicity: string;
  age: string;
  filePath: string;
}

interface Deliverable {
  id: string;
  type: "social" | "listing-update" | "review-response" | "seasonal";
  title: string;
  content: string;
  hashtags?: string;
  platform?: string;
  imagePrompt?: string;
  scene?: string;
  priority: string;
  suggestedDay?: string;
  reason?: string;
  status: "pending" | "approved" | "dismissed";
  generatedImageUrl?: string;
}

interface ContentPlan {
  weekOf: string;
  summary: string;
  deliverables: Deliverable[];
}

/* ------------------------------------------------------------------ */
/*  Config                                                             */
/* ------------------------------------------------------------------ */

const typeConfig: Record<
  string,
  { label: string; icon: typeof Instagram; color: string; borderColor: string; bgColor: string }
> = {
  social: {
    label: "Social Post",
    icon: Instagram,
    color: "text-rose-600",
    borderColor: "border-rose-200",
    bgColor: "bg-rose-50",
  },
  "listing-update": {
    label: "Listing Update",
    icon: FileText,
    color: "text-blue-600",
    borderColor: "border-blue-200",
    bgColor: "bg-blue-50",
  },
  "review-response": {
    label: "Review Response",
    icon: Star,
    color: "text-amber-600",
    borderColor: "border-amber-200",
    bgColor: "bg-amber-50",
  },
  seasonal: {
    label: "Seasonal Content",
    icon: Leaf,
    color: "text-emerald-600",
    borderColor: "border-emerald-200",
    bgColor: "bg-emerald-50",
  },
};

const filterTabs = [
  { key: "all", label: "All", icon: Inbox },
  { key: "social", label: "Social", icon: Instagram },
  { key: "listing-update", label: "Listing", icon: FileText },
  { key: "review-response", label: "Reviews", icon: Star },
  { key: "seasonal", label: "Seasonal", icon: Leaf },
];

/* ------------------------------------------------------------------ */
/*  Spinner                                                            */
/* ------------------------------------------------------------------ */
function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24">
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
/*  Star Rating                                                        */
/* ------------------------------------------------------------------ */
function StarRating({ count = 5 }: { count?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: count }).map((_, i) => (
        <Star
          key={i}
          className="w-3.5 h-3.5 text-amber-400 fill-amber-400"
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Platform Icon                                                      */
/* ------------------------------------------------------------------ */
function PlatformBadge({ platform }: { platform: string }) {
  const p = platform.toLowerCase();
  let label = platform;
  let color = "bg-stone-100 text-stone-600";

  if (p.includes("instagram")) {
    color = "bg-gradient-to-br from-purple-50 to-pink-50 text-pink-700 border-pink-200";
    label = "Instagram";
  } else if (p.includes("tiktok")) {
    color = "bg-stone-900 text-white border-stone-800";
    label = "TikTok";
  } else if (p.includes("facebook")) {
    color = "bg-blue-50 text-blue-700 border-blue-200";
    label = "Facebook";
  }

  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${color}`}
    >
      {label}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function DeliverablesPage() {
  const [plan, setPlan] = useState<ContentPlan | null>(null);
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const [generatingImageId, setGeneratingImageId] = useState<string | null>(
    null
  );
  const [castMembers, setCastMembers] = useState<CastMember[]>([]);
  const [preferredCast, setPreferredCast] = useState<CastMember[]>([]);
  const [showCastPicker, setShowCastPicker] = useState(false);

  // Load cast manifest + preferred cast
  useEffect(() => {
    fetch("/cast/manifest.json")
      .then((r) => r.json())
      .then((data: CastMember[]) => setCastMembers(data))
      .catch(() => {});

    const savedCast = localStorage.getItem("hg_preferred_cast");
    if (savedCast) setPreferredCast(JSON.parse(savedCast));
  }, []);

  function savePreferredCast(cast: CastMember[]) {
    setPreferredCast(cast);
    localStorage.setItem("hg_preferred_cast", JSON.stringify(cast));
  }

  // Load cached plan or generate new one
  useEffect(() => {
    const cached = localStorage.getItem("hg_content_plan");
    if (cached) {
      const data = JSON.parse(cached);
      setPlan(data);
      setDeliverables(
        data.deliverables.map((d: Deliverable, i: number) => ({
          ...d,
          id: d.id || `del-${i}`,
          status: d.status || "pending",
        }))
      );
    }
  }, []);

  async function generatePlan() {
    setLoading(true);
    try {
      const auditData = sessionStorage.getItem("audit_result");
      let propertyName = "";
      let propertyDescription = "";
      let listingUrl = "";

      let auditFindings = "";

      if (auditData) {
        const parsed = JSON.parse(auditData);
        propertyName = parsed.audit?.property_name || "";
        propertyDescription = parsed.propertyDescription || parsed.audit?.summary || "";
        listingUrl = parsed.url || "";

        // Build rich property context from the full audit
        const audit = parsed.audit;
        if (audit) {
          const categoryDetails = (audit.categories || [])
            .map((c: { name: string; findings: string[]; recommendations: string[] }) =>
              `${c.name}: ${(c.findings || []).join("; ")}`
            )
            .join("\n");

          const topFixes = (audit.top_5_fixes || [])
            .map((f: { priority: number; title: string; description: string }) =>
              `${f.priority}. ${f.title}: ${f.description}`
            )
            .join("\n");

          auditFindings = `\nAUDIT FINDINGS:\n${categoryDetails}\n\nTOP FIXES:\n${topFixes}`;

          if (audit.optimized_title) {
            auditFindings += `\nOPTIMIZED TITLE: ${audit.optimized_title}`;
          }
          if (audit.optimized_description_preview) {
            auditFindings += `\nOPTIMIZED DESCRIPTION: ${audit.optimized_description_preview}`;
          }
        }
      }

      const res = await fetch("/api/daily-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyName,
          propertyDescription,
          listingUrl,
          auditFindings,
        }),
      });

      if (!res.ok) throw new Error("Failed to generate content plan");

      const data = await res.json();
      const dels = data.deliverables.map((d: Deliverable, i: number) => ({
        ...d,
        id: `del-${Date.now()}-${i}`,
        status: "pending" as const,
      }));

      setPlan(data);
      setDeliverables(dels);
      localStorage.setItem(
        "hg_content_plan",
        JSON.stringify({ ...data, deliverables: dels })
      );
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateImage(del: Deliverable) {
    if (!del.scene) return;
    setGeneratingImageId(del.id);

    try {
      const cachedPhotos = localStorage.getItem("hg_listing_photos");
      let propertyImageUrl = "";
      let description = "";

      if (cachedPhotos) {
        const data = JSON.parse(cachedPhotos);
        propertyImageUrl = data.photos?.[0] || "";
        description = data.description || "";
      }

      if (!propertyImageUrl) {
        alert(
          "No property photos found. Visit Photo Studio first to load your listing photos."
        );
        return;
      }

      const talentImageUrls =
        preferredCast.length > 0
          ? preferredCast.map(
              (c) => `${window.location.origin}${c.filePath}`
            )
          : undefined;

      const res = await fetch("/api/generate-lifestyle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyImageUrl,
          season: del.scene?.includes("winter")
            ? "winter"
            : del.scene?.includes("fall")
              ? "fall"
              : "summer",
          sceneType: del.scene,
          propertyDescription: `${description}. ${del.imagePrompt || ""}`,
          talentImageUrls,
        }),
      });

      if (!res.ok) throw new Error("Image generation failed");

      const data = await res.json();
      setDeliverables((prev) =>
        prev.map((d) =>
          d.id === del.id ? { ...d, generatedImageUrl: data.imageUrl } : d
        )
      );
    } catch (err) {
      console.error(err);
    } finally {
      setGeneratingImageId(null);
    }
  }

  function handleCopy(id: string, content: string, hashtags?: string) {
    const full = hashtags ? `${content}\n\n${hashtags}` : content;
    navigator.clipboard.writeText(full);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  function handleApprove(id: string) {
    setDeliverables((prev) =>
      prev.map((d) =>
        d.id === id ? { ...d, status: "approved" as const } : d
      )
    );
  }

  function handleDismiss(id: string) {
    setDeliverables((prev) =>
      prev.map((d) =>
        d.id === id ? { ...d, status: "dismissed" as const } : d
      )
    );
  }

  const filtered =
    filter === "all"
      ? deliverables
      : deliverables.filter((d) => d.type === filter);
  const pendingCount = deliverables.filter(
    (d) => d.status === "pending"
  ).length;
  const approvedCount = deliverables.filter(
    (d) => d.status === "approved"
  ).length;

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------------ */}
      {/*  Header                                                       */}
      {/* ------------------------------------------------------------ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-stone-900">
            Deliverables
          </h1>
          {plan ? (
            <div className="flex items-center gap-3 mt-1.5">
              <span className="text-sm text-stone-500">
                Week of{" "}
                <span className="font-mono font-medium text-stone-600">
                  {plan.weekOf}
                </span>
              </span>
              <span className="w-px h-3.5 bg-stone-200" />
              <span className="text-sm text-stone-500">
                <span className="font-mono font-semibold text-stone-700">
                  {pendingCount}
                </span>{" "}
                pending
              </span>
              {approvedCount > 0 && (
                <>
                  <span className="w-px h-3.5 bg-stone-200" />
                  <span className="text-sm text-stone-500">
                    <span className="font-mono font-semibold text-emerald-600">
                      {approvedCount}
                    </span>{" "}
                    approved
                  </span>
                </>
              )}
            </div>
          ) : (
            <p className="text-stone-500 mt-1 text-sm">
              Your AI marketing team&apos;s weekly output
            </p>
          )}
        </div>
        <button
          onClick={generatePlan}
          disabled={loading}
          className="group inline-flex items-center gap-2.5 px-5 py-3 bg-gradient-to-b from-brand-500 to-brand-600 hover:from-brand-600 hover:to-brand-700 text-white rounded-xl text-sm font-semibold transition-all shadow-md shadow-brand-500/20 hover:shadow-lg hover:shadow-brand-500/30 disabled:opacity-50 active:scale-[0.98]"
        >
          {loading ? (
            <>
              <Spinner />
              Generating...
            </>
          ) : plan ? (
            <>
              <RefreshCw className="h-4 w-4" />
              Refresh plan
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Generate this week&apos;s content
            </>
          )}
        </button>
      </div>

      {/* ------------------------------------------------------------ */}
      {/*  Brand Faces Bar                                               */}
      {/* ------------------------------------------------------------ */}
      <div className="bg-white rounded-2xl border border-stone-200/80 p-5 transition-all duration-300 hover:shadow-lg hover:shadow-stone-200/40 hover:border-stone-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-stone-50 border border-stone-100">
              <Users className="w-4.5 h-4.5 text-stone-400" />
            </div>
            <div>
              <span className="text-sm font-semibold text-stone-800">
                Brand faces
              </span>
              {preferredCast.length === 0 && (
                <p className="text-xs text-stone-400 mt-0.5">
                  No cast selected -- images will use random models
                </p>
              )}
            </div>
            {preferredCast.length > 0 && (
              <div className="flex -space-x-2 ml-2">
                {preferredCast.map((c) => (
                  <div
                    key={c.id}
                    className="relative group/avatar"
                  >
                    <img
                      src={c.filePath}
                      alt={c.name}
                      className="w-9 h-9 rounded-xl border-2 border-white object-cover shadow-sm transition-transform group-hover/avatar:scale-110 group-hover/avatar:z-10"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={() => setShowCastPicker(!showCastPicker)}
            className="inline-flex items-center gap-1.5 text-sm text-brand-600 font-semibold hover:text-brand-700 transition-colors active:scale-[0.98]"
          >
            {showCastPicker
              ? "Done"
              : preferredCast.length > 0
                ? "Change"
                : "Choose cast"}
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform ${showCastPicker ? "rotate-180" : ""}`}
            />
          </button>
        </div>

        {showCastPicker && castMembers.length > 0 && (
          <div className="mt-5 border-t border-stone-100 pt-5">
            <p className="text-xs text-stone-500 mb-3 font-medium">
              Select 1-4 faces that represent your brand. These will appear in
              all auto-generated lifestyle content.
            </p>
            <div className="max-h-44 overflow-y-auto grid grid-cols-8 md:grid-cols-12 gap-2 pr-1">
              {castMembers.slice(0, 80).map((c) => {
                const isSelected = preferredCast.some((p) => p.id === c.id);
                return (
                  <button
                    key={c.id}
                    onClick={() => {
                      if (isSelected) {
                        savePreferredCast(
                          preferredCast.filter((p) => p.id !== c.id)
                        );
                      } else if (preferredCast.length < 4) {
                        savePreferredCast([...preferredCast, c]);
                      }
                    }}
                    className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all duration-200 active:scale-[0.95] ${
                      isSelected
                        ? "border-brand-500 ring-2 ring-brand-500/20 shadow-sm"
                        : "border-transparent hover:border-stone-300 hover:shadow-sm"
                    }`}
                  >
                    <img
                      src={c.filePath}
                      alt={c.name}
                      className="w-full h-full object-cover"
                    />
                    {isSelected && (
                      <div className="absolute inset-0 bg-brand-500/20 flex items-center justify-center">
                        <div className="bg-brand-500 rounded-full p-0.5">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-2 mt-3">
              <div className="flex gap-1">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      i <= preferredCast.length
                        ? "bg-brand-500"
                        : "bg-stone-200"
                    }`}
                  />
                ))}
              </div>
              <span className="text-xs text-stone-400 font-mono">
                {preferredCast.length}/4 selected
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------ */}
      {/*  Weekly Strategy Summary                                       */}
      {/* ------------------------------------------------------------ */}
      {plan && (
        <div className="relative overflow-hidden rounded-2xl border border-brand-200/60 bg-gradient-to-r from-brand-50/50 via-white to-brand-50/30 p-5">
          <div className="absolute top-0 left-0 h-full w-1 bg-gradient-to-b from-brand-500 to-brand-300 rounded-l-2xl" />
          <div className="pl-4 flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-100/80 border border-brand-200/50">
              <TrendingUp className="h-4 w-4 text-brand-600" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-brand-600 mb-1">
                This week&apos;s strategy
              </p>
              <p className="text-sm text-stone-700 leading-relaxed">
                {plan.summary}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------ */}
      {/*  Empty State                                                   */}
      {/* ------------------------------------------------------------ */}
      {!plan && !loading && (
        <div className="bg-white rounded-2xl border border-stone-200/80 p-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-stone-50 border border-stone-100 flex items-center justify-center mx-auto mb-6">
            <Inbox className="h-7 w-7 text-stone-300" />
          </div>
          <h3 className="font-heading text-xl font-semibold text-stone-900 mb-2 tracking-tight">
            No content plan yet
          </h3>
          <p className="text-stone-500 max-w-md mx-auto mb-8 text-sm leading-relaxed">
            Click the button below and your AI marketing team will create social
            posts, listing updates, review responses, and seasonal content --
            all ready to copy and paste.
          </p>
          <button
            onClick={generatePlan}
            className="group inline-flex items-center gap-2.5 px-7 py-3.5 bg-gradient-to-b from-brand-500 to-brand-600 hover:from-brand-600 hover:to-brand-700 text-white rounded-xl font-semibold transition-all shadow-lg shadow-brand-500/20 hover:shadow-xl hover:shadow-brand-500/30 active:scale-[0.98]"
          >
            <Sparkles className="h-4 w-4" />
            Generate This Week&apos;s Content
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>
      )}

      {/* ------------------------------------------------------------ */}
      {/*  Filters                                                       */}
      {/* ------------------------------------------------------------ */}
      {deliverables.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {filterTabs.map((f) => {
            const Icon = f.icon;
            const isActive = filter === f.key;
            const count =
              f.key === "all"
                ? deliverables.length
                : deliverables.filter((d) => d.type === f.key).length;
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium transition-all duration-200 whitespace-nowrap active:scale-[0.98] ${
                  isActive
                    ? "bg-stone-900 text-white shadow-sm"
                    : "bg-white border border-stone-200/80 text-stone-500 hover:bg-stone-50 hover:border-stone-300 hover:text-stone-700"
                }`}
              >
                <Icon
                  className={`h-3.5 w-3.5 ${isActive ? "text-white/70" : "text-stone-400"}`}
                />
                {f.label}
                <span
                  className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md ${
                    isActive
                      ? "bg-white/15 text-white/80"
                      : "bg-stone-100 text-stone-400"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* ------------------------------------------------------------ */}
      {/*  Deliverable Cards                                             */}
      {/* ------------------------------------------------------------ */}
      <div className="space-y-4">
        {filtered.map((item) => {
          const config = typeConfig[item.type] || typeConfig.social;
          const TypeIcon = config.icon;
          const isApproved = item.status === "approved";
          const isDismissed = item.status === "dismissed";
          const isReview = item.type === "review-response";

          return (
            <div
              key={item.id}
              className={`relative bg-white rounded-2xl border overflow-hidden transition-all duration-300 ${
                isApproved
                  ? "border-emerald-200 shadow-sm shadow-emerald-100/50"
                  : isDismissed
                    ? "border-stone-200/60 opacity-40"
                    : "border-stone-200/80 hover:shadow-lg hover:shadow-stone-200/40 hover:border-stone-300 hover:-translate-y-0.5"
              }`}
            >
              {/* Top color accent */}
              {!isDismissed && (
                <div
                  className={`h-0.5 ${
                    isApproved
                      ? "bg-gradient-to-r from-emerald-400 to-emerald-300"
                      : item.type === "social"
                        ? "bg-gradient-to-r from-rose-400 to-pink-300"
                        : item.type === "listing-update"
                          ? "bg-gradient-to-r from-blue-400 to-cyan-300"
                          : item.type === "review-response"
                            ? "bg-gradient-to-r from-amber-400 to-yellow-300"
                            : "bg-gradient-to-r from-emerald-400 to-teal-300"
                  }`}
                />
              )}

              <div className="p-6">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <div
                      className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg border ${config.bgColor} ${config.color} ${config.borderColor}`}
                    >
                      <TypeIcon className="h-3 w-3" />
                      {config.label}
                    </div>
                    {item.platform && <PlatformBadge platform={item.platform} />}
                    {item.suggestedDay && (
                      <span className="inline-flex items-center gap-1 text-xs text-stone-400 font-mono">
                        <Calendar className="h-3 w-3" />
                        {item.suggestedDay}
                      </span>
                    )}
                    {item.priority === "high" && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-red-50 text-red-600 border border-red-200">
                        <AlertCircle className="h-3 w-3" />
                        High
                      </span>
                    )}
                  </div>
                  {isApproved && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Approved
                    </span>
                  )}
                </div>

                {/* Title */}
                <h3 className="font-heading font-semibold text-stone-900 mb-2 tracking-tight text-[15px]">
                  {item.title}
                </h3>

                {/* Star rating for review responses */}
                {isReview && (
                  <div className="mb-3">
                    <StarRating />
                  </div>
                )}

                {/* Reason/context */}
                {item.reason && (
                  <p className="text-sm text-stone-400 mb-3 leading-relaxed italic border-l-2 border-stone-200 pl-3">
                    {item.reason}
                  </p>
                )}

                {/* Generated Image */}
                {item.generatedImageUrl && (
                  <div className="mb-4 rounded-xl overflow-hidden border border-stone-100 shadow-sm">
                    <img
                      src={item.generatedImageUrl}
                      alt=""
                      className="w-full max-w-md"
                    />
                  </div>
                )}

                {/* Content */}
                <div className="relative rounded-xl border border-stone-100 bg-stone-50/60 p-5 mb-5">
                  <p className="text-sm text-stone-700 whitespace-pre-wrap leading-relaxed">
                    {item.content}
                  </p>
                  {item.hashtags && (
                    <p className="text-sm text-brand-500 mt-3 font-medium">
                      {item.hashtags}
                    </p>
                  )}
                </div>

                {/* Actions */}
                {!isDismissed && (
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <button
                      onClick={() =>
                        handleCopy(item.id, item.content, item.hashtags)
                      }
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-sm font-medium transition-all active:scale-[0.98] shadow-sm"
                    >
                      {copiedId === item.id ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          Copy
                        </>
                      )}
                    </button>

                    {/* Generate image button */}
                    {(item.type === "social" || item.type === "seasonal") &&
                      !item.generatedImageUrl &&
                      item.scene && (
                        <button
                          onClick={() => handleGenerateImage(item)}
                          disabled={generatingImageId === item.id}
                          className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-gradient-to-b from-brand-500 to-brand-600 hover:from-brand-600 hover:to-brand-700 text-white rounded-xl text-sm font-medium transition-all disabled:opacity-50 active:scale-[0.98] shadow-sm shadow-brand-500/20"
                        >
                          {generatingImageId === item.id ? (
                            <>
                              <Spinner />
                              Generating...
                            </>
                          ) : (
                            <>
                              <Image className="h-3.5 w-3.5" />
                              Generate image
                            </>
                          )}
                        </button>
                      )}

                    {!isApproved && (
                      <>
                        <button
                          onClick={() => handleApprove(item.id)}
                          className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium transition-all active:scale-[0.98] shadow-sm"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Approve
                        </button>
                        <button
                          onClick={() => handleDismiss(item.id)}
                          className="inline-flex items-center gap-1.5 px-4 py-2.5 text-stone-400 hover:text-stone-600 hover:bg-stone-50 rounded-xl text-sm font-medium transition-all active:scale-[0.98]"
                        >
                          <X className="h-3.5 w-3.5" />
                          Dismiss
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
