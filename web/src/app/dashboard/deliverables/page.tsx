"use client";

import { useState, useEffect } from "react";
import { Users } from "lucide-react";

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

const typeConfig: Record<string, { label: string; icon: string; color: string }> = {
  social: { label: "Social Post", icon: "📸", color: "bg-pink-50 text-pink-700" },
  "listing-update": { label: "Listing Update", icon: "✍️", color: "bg-blue-50 text-blue-700" },
  "review-response": { label: "Review Response", icon: "⭐", color: "bg-yellow-50 text-yellow-700" },
  seasonal: { label: "Seasonal Content", icon: "🍂", color: "bg-orange-50 text-orange-700" },
};

export default function DeliverablesPage() {
  const [plan, setPlan] = useState<ContentPlan | null>(null);
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const [generatingImageId, setGeneratingImageId] = useState<string | null>(null);
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

      if (auditData) {
        const parsed = JSON.parse(auditData);
        propertyName = parsed.audit?.property_name || "";
        propertyDescription = parsed.audit?.summary || "";
        listingUrl = parsed.url || "";
      }

      const res = await fetch("/api/daily-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyName,
          propertyDescription,
          listingUrl,
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
      localStorage.setItem("hg_content_plan", JSON.stringify({ ...data, deliverables: dels }));
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
        alert("No property photos found. Visit Photo Studio first to load your listing photos.");
        return;
      }

      // Use preferred cast for auto-generated images
      const talentImageUrls = preferredCast.length > 0
        ? preferredCast.map((c) => `${window.location.origin}${c.filePath}`)
        : undefined;

      const res = await fetch("/api/generate-lifestyle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyImageUrl,
          season: del.scene?.includes("winter") ? "winter" : del.scene?.includes("fall") ? "fall" : "summer",
          sceneType: del.scene,
          propertyDescription: `${description}. ${del.imagePrompt || ""}`,
          talentImageUrls,
        }),
      });

      if (!res.ok) throw new Error("Image generation failed");

      const data = await res.json();
      setDeliverables((prev) =>
        prev.map((d) => (d.id === del.id ? { ...d, generatedImageUrl: data.imageUrl } : d))
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
      prev.map((d) => (d.id === id ? { ...d, status: "approved" as const } : d))
    );
  }

  function handleDismiss(id: string) {
    setDeliverables((prev) =>
      prev.map((d) => (d.id === id ? { ...d, status: "dismissed" as const } : d))
    );
  }

  const filtered = filter === "all" ? deliverables : deliverables.filter((d) => d.type === filter);
  const pendingCount = deliverables.filter((d) => d.status === "pending").length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900">Deliverables</h1>
          {plan ? (
            <p className="text-stone-500 mt-1">
              Week of {plan.weekOf} — {pendingCount} items pending
            </p>
          ) : (
            <p className="text-stone-500 mt-1">Your AI marketing team&apos;s weekly output</p>
          )}
        </div>
        <button
          onClick={generatePlan}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-500 transition disabled:opacity-50"
        >
          {loading ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Generating...
            </>
          ) : plan ? (
            "Refresh plan"
          ) : (
            "Generate this week's content"
          )}
        </button>
      </div>

      {/* Preferred Cast Bar */}
      <div className="bg-white rounded-xl border border-stone-200 p-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users className="w-4 h-4 text-stone-400" />
            <span className="text-sm font-medium text-stone-700">Your brand faces</span>
            {preferredCast.length > 0 && (
              <div className="flex -space-x-2">
                {preferredCast.map((c) => (
                  <img
                    key={c.id}
                    src={c.filePath}
                    alt={c.name}
                    title={c.name}
                    className="w-8 h-8 rounded-full border-2 border-white object-cover"
                  />
                ))}
              </div>
            )}
            {preferredCast.length === 0 && (
              <span className="text-sm text-stone-400">No cast selected — images will use random models</span>
            )}
          </div>
          <button
            onClick={() => setShowCastPicker(!showCastPicker)}
            className="text-sm text-brand-600 font-medium hover:text-brand-700"
          >
            {showCastPicker ? "Done" : preferredCast.length > 0 ? "Change" : "Choose cast"}
          </button>
        </div>

        {showCastPicker && castMembers.length > 0 && (
          <div className="mt-4 border-t border-stone-100 pt-4">
            <p className="text-xs text-stone-400 mb-3">
              Select 1-4 faces that represent your brand. These will appear in all auto-generated lifestyle content.
            </p>
            <div className="max-h-40 overflow-y-auto grid grid-cols-8 md:grid-cols-12 gap-1.5">
              {castMembers.slice(0, 80).map((c) => {
                const isSelected = preferredCast.some((p) => p.id === c.id);
                return (
                  <button
                    key={c.id}
                    onClick={() => {
                      if (isSelected) {
                        savePreferredCast(preferredCast.filter((p) => p.id !== c.id));
                      } else if (preferredCast.length < 4) {
                        savePreferredCast([...preferredCast, c]);
                      }
                    }}
                    className={`relative aspect-square rounded-lg overflow-hidden border-2 transition ${
                      isSelected ? "border-brand-500 ring-1 ring-brand-500/30" : "border-transparent hover:border-stone-300"
                    }`}
                  >
                    <img src={c.filePath} alt={c.name} className="w-full h-full object-cover" />
                    {isSelected && (
                      <div className="absolute inset-0 bg-brand-500/20 flex items-center justify-center">
                        <span className="text-white text-xs font-bold bg-brand-500 rounded-full w-4 h-4 flex items-center justify-center">✓</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-stone-400 mt-2">{preferredCast.length}/4 selected</p>
          </div>
        )}
      </div>

      {/* Weekly Summary */}
      {plan && (
        <div className="bg-gradient-to-r from-brand-50 to-brand-50 border border-brand-200 rounded-xl p-4 mb-6">
          <p className="text-sm text-brand-800">
            <span className="font-semibold">This week&apos;s strategy:</span> {plan.summary}
          </p>
        </div>
      )}

      {/* Empty State */}
      {!plan && !loading && (
        <div className="bg-white rounded-xl border border-stone-200 p-12 text-center">
          <span className="text-4xl mb-4 block"></span>
          <h3 className="text-lg font-semibold mb-2">No content plan yet</h3>
          <p className="text-stone-500 max-w-md mx-auto mb-6">
            Click &quot;Generate This Week&apos;s Content&quot; and your AI marketing team will create
            social posts, listing updates, review responses, and seasonal content — all ready to copy and paste.
          </p>
          <button
            onClick={generatePlan}
            className="px-6 py-3 bg-brand-600 text-white rounded-xl font-medium hover:bg-brand-500 transition"
          >
            ✨ Generate This Week&apos;s Content
          </button>
        </div>
      )}

      {/* Filters */}
      {deliverables.length > 0 && (
        <div className="flex gap-2 mb-6">
          {[
            { key: "all", label: "All" },
            { key: "social", label: "Social" },
            { key: "listing-update", label: "Listing" },
            { key: "review-response", label: "Reviews" },
            { key: "seasonal", label: "Seasonal" },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                filter === f.key
                  ? "bg-stone-900 text-white"
                  : "bg-white border border-stone-200 text-stone-600 hover:bg-stone-50"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {/* Deliverables */}
      <div className="space-y-4">
        {filtered.map((item) => {
          const config = typeConfig[item.type] || typeConfig.social;
          const isApproved = item.status === "approved";
          const isDismissed = item.status === "dismissed";

          return (
            <div
              key={item.id}
              className={`bg-white rounded-xl border p-6 transition ${
                isApproved
                  ? "border-brand-200 bg-brand-50/30"
                  : isDismissed
                  ? "border-stone-200 opacity-40"
                  : "border-stone-200"
              }`}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${config.color}`}>
                    {config.icon} {config.label}
                  </span>
                  {item.suggestedDay && (
                    <span className="text-xs text-stone-400">{item.suggestedDay}</span>
                  )}
                  {item.priority === "high" && (
                    <span className="text-xs font-medium px-2 py-1 rounded-full bg-red-50 text-red-600">High Priority</span>
                  )}
                  {isApproved && (
                    <span className="text-xs font-medium px-2 py-1 rounded-full bg-brand-100 text-brand-700">Approved</span>
                  )}
                </div>
                {item.platform && (
                  <span className="text-xs text-stone-400">{item.platform}</span>
                )}
              </div>

              <h3 className="font-semibold text-stone-900 mb-2">{item.title}</h3>

              {item.reason && (
                <p className="text-sm text-stone-400 mb-3 italic">{item.reason}</p>
              )}

              {/* Generated Image */}
              {item.generatedImageUrl && (
                <div className="mb-4">
                  <img
                    src={item.generatedImageUrl}
                    alt=""
                    className="w-full max-w-md rounded-lg shadow-sm"
                  />
                </div>
              )}

              {/* Content */}
              <div className="bg-stone-50 rounded-lg p-4 mb-4">
                <p className="text-sm text-stone-700 whitespace-pre-wrap">{item.content}</p>
                {item.hashtags && (
                  <p className="text-sm text-blue-500 mt-2">{item.hashtags}</p>
                )}
              </div>

              {/* Actions */}
              {!isDismissed && (
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => handleCopy(item.id, item.content, item.hashtags)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-stone-900 text-white rounded-lg text-sm font-medium hover:bg-stone-800 transition"
                  >
                    {copiedId === item.id ? "Copied!" : "Copy"}
                  </button>

                  {/* Generate image button for social/seasonal posts */}
                  {(item.type === "social" || item.type === "seasonal") && !item.generatedImageUrl && item.scene && (
                    <button
                      onClick={() => handleGenerateImage(item)}
                      disabled={generatingImageId === item.id}
                      className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-500 transition disabled:opacity-50"
                    >
                      {generatingImageId === item.id ? (
                        <>
                          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          Generating...
                        </>
                      ) : (
                        "Generate image"
                      )}
                    </button>
                  )}

                  {!isApproved && (
                    <>
                      <button
                        onClick={() => handleApprove(item.id)}
                        className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-500 transition"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleDismiss(item.id)}
                        className="px-4 py-2 text-stone-400 text-sm hover:text-stone-600 transition"
                      >
                        Dismiss
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
