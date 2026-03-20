"use client";

import { useEffect, useState } from "react";
import {
  ScanEye,
  Camera,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Image,
  ArrowRight,
  RefreshCw,
  Star,
  TrendingUp,
  Eye,
} from "lucide-react";
import Link from "next/link";

interface MissingShot {
  type: string;
  title: string;
  why: string;
  priority: "high" | "medium" | "low";
}

interface LifestyleOpportunity {
  scene: string;
  title: string;
  description: string;
  impact: string;
  priority: "high" | "medium" | "low";
}

interface Improvement {
  category: string;
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
}

interface ImageAuditResult {
  overallPhotoScore: number;
  overallAssessment: string;
  photoCount: {
    current: number;
    recommended: number;
    verdict: string;
  };
  missingShots: MissingShot[];
  lifestyleOpportunities: LifestyleOpportunity[];
  improvements: Improvement[];
  strengths: string[];
}

function priorityBadge(priority: string) {
  const styles: Record<string, string> = {
    high: "bg-red-50 text-red-700 border-red-200",
    medium: "bg-amber-50 text-amber-700 border-amber-200",
    low: "bg-stone-50 text-stone-600 border-stone-200",
  };
  return (
    <span
      className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
        styles[priority] || styles.medium
      }`}
    >
      {priority}
    </span>
  );
}

function scoreColor(score: number) {
  if (score >= 80) return "text-emerald-600";
  if (score >= 60) return "text-amber-500";
  if (score >= 40) return "text-orange-500";
  return "text-red-500";
}

function scoreBarColor(score: number) {
  if (score >= 80) return "bg-emerald-500";
  if (score >= 60) return "bg-amber-400";
  if (score >= 40) return "bg-orange-400";
  return "bg-red-400";
}

export default function ImageAuditPage() {
  const [loading, setLoading] = useState(false);
  const [audit, setAudit] = useState<ImageAuditResult | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [propertyName, setPropertyName] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    // Load cached photos and audit data
    const cachedPhotos = localStorage.getItem("hg_listing_photos");
    if (cachedPhotos) {
      const parsed = JSON.parse(cachedPhotos);
      setPhotos(parsed.photos || []);
    }

    const auditData = sessionStorage.getItem("audit_result");
    if (auditData) {
      const parsed = JSON.parse(auditData);
      setPropertyName(parsed.audit?.property_name || "");
    }

    // Load cached image audit
    const cachedAudit = localStorage.getItem("hg_image_audit");
    if (cachedAudit) {
      setAudit(JSON.parse(cachedAudit));
    }
  }, []);

  async function runAudit() {
    setLoading(true);
    setError("");

    try {
      const auditData = sessionStorage.getItem("audit_result");
      let propertyDescription = "";
      let auditSummary = "";
      let name = propertyName;

      if (auditData) {
        const parsed = JSON.parse(auditData);
        name = parsed.audit?.property_name || "";
        propertyDescription =
          parsed.propertyDescription || parsed.audit?.summary || "";
        auditSummary = parsed.audit?.summary || "";

        // Include category details
        const categories = parsed.audit?.categories || [];
        const photoCategory = categories.find(
          (c: { name: string }) =>
            c.name.toLowerCase().includes("photo") ||
            c.name.toLowerCase().includes("image")
        );
        if (photoCategory) {
          auditSummary += ` Photography score: ${photoCategory.score}/100 (${photoCategory.grade}). Findings: ${(photoCategory.findings || []).join("; ")}`;
        }
      }

      const res = await fetch("/api/image-audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          photos,
          propertyName: name,
          propertyDescription,
          auditSummary,
        }),
      });

      if (!res.ok) throw new Error("Image audit failed");

      const result = await res.json();
      setAudit(result);
      localStorage.setItem("hg_image_audit", JSON.stringify(result));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  // No photos yet
  if (photos.length === 0 && !audit) {
    return (
      <div className="max-w-2xl mx-auto py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-stone-100 flex items-center justify-center mx-auto mb-6">
          <ScanEye className="w-8 h-8 text-stone-400" />
        </div>
        <h1 className="text-2xl font-semibold text-stone-900 mb-3">
          Image Audit
        </h1>
        <p className="text-stone-500 mb-8 max-w-md mx-auto">
          Run a listing audit first so we can analyze your property photos and
          suggest improvements.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-6 py-3 bg-stone-900 text-white rounded-xl font-medium hover:bg-stone-800 transition"
        >
          Audit a listing
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Image Audit</h1>
          <p className="text-stone-500 text-sm mt-1">
            {propertyName
              ? `Photo analysis for ${propertyName}`
              : "Analyze your listing photos for conversion optimization"}
          </p>
        </div>
        <button
          onClick={runAudit}
          disabled={loading}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-stone-900 text-white rounded-xl text-sm font-medium hover:bg-stone-800 disabled:bg-stone-300 transition"
        >
          {loading ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <ScanEye className="w-4 h-4" />
              {audit ? "Re-analyze" : "Run Image Audit"}
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Photo grid preview */}
      {photos.length > 0 && !audit && (
        <div className="bg-white rounded-2xl border border-stone-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Camera className="w-4 h-4 text-stone-400" />
            <span className="text-sm font-medium text-stone-700">
              {photos.length} listing photos found
            </span>
          </div>
          <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
            {photos.slice(0, 12).map((url, i) => (
              <div
                key={i}
                className="aspect-square rounded-lg overflow-hidden bg-stone-100"
              >
                <img
                  src={url}
                  alt={`Listing photo ${i + 1}`}
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
            {photos.length > 12 && (
              <div className="aspect-square rounded-lg bg-stone-100 flex items-center justify-center">
                <span className="text-sm text-stone-500 font-medium">
                  +{photos.length - 12}
                </span>
              </div>
            )}
          </div>
          <p className="text-stone-400 text-xs mt-4">
            Click &quot;Run Image Audit&quot; to get AI recommendations for your photo set.
          </p>
        </div>
      )}

      {/* Audit results */}
      {audit && (
        <>
          {/* Score + summary */}
          <div className="bg-white rounded-2xl border border-stone-200 p-8">
            <div className="flex items-start gap-8">
              <div className="text-center">
                <div
                  className={`text-5xl font-bold font-mono ${scoreColor(
                    audit.overallPhotoScore
                  )}`}
                >
                  {audit.overallPhotoScore}
                </div>
                <div className="text-xs text-stone-400 mt-1">/ 100</div>
                <div className="w-24 h-1.5 bg-stone-100 rounded-full mt-3 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${scoreBarColor(
                      audit.overallPhotoScore
                    )} transition-all duration-700`}
                    style={{ width: `${audit.overallPhotoScore}%` }}
                  />
                </div>
              </div>
              <div className="flex-1">
                <h2 className="font-semibold text-stone-900 mb-2">
                  Photo Assessment
                </h2>
                <p className="text-stone-600 text-sm leading-relaxed">
                  {audit.overallAssessment}
                </p>
                <div className="flex items-center gap-4 mt-4 text-sm">
                  <div className="flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5 text-stone-400" />
                    <span className="text-stone-600">
                      {audit.photoCount.current} photos
                    </span>
                  </div>
                  <span className="text-stone-300">|</span>
                  <span className="text-stone-500">
                    Recommended: {audit.photoCount.recommended}
                  </span>
                  {audit.photoCount.verdict === "too few" && (
                    <span className="text-orange-600 text-xs font-medium">
                      Needs more photos
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Strengths */}
          {audit.strengths.length > 0 && (
            <div className="bg-white rounded-2xl border border-stone-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <h3 className="font-semibold text-stone-900 text-sm">
                  What&apos;s Working
                </h3>
              </div>
              <ul className="space-y-2">
                {audit.strengths.map((s, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2.5 text-sm text-stone-600"
                  >
                    <Star className="w-3.5 h-3.5 text-amber-400 mt-0.5 flex-shrink-0" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Missing shots */}
          {audit.missingShots.length > 0 && (
            <div className="bg-white rounded-2xl border border-stone-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <h3 className="font-semibold text-stone-900 text-sm">
                  Missing Shots
                </h3>
              </div>
              <div className="space-y-4">
                {audit.missingShots.map((shot, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-4 p-4 rounded-xl bg-stone-50 border border-stone-100"
                  >
                    <div className="w-9 h-9 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center flex-shrink-0">
                      <Camera className="w-4 h-4 text-amber-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-stone-900 text-sm">
                          {shot.title}
                        </span>
                        {priorityBadge(shot.priority)}
                      </div>
                      <p className="text-xs text-stone-500">{shot.why}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Lifestyle opportunities */}
          {audit.lifestyleOpportunities.length > 0 && (
            <div className="bg-white rounded-2xl border border-stone-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-brand-500" />
                  <h3 className="font-semibold text-stone-900 text-sm">
                    Lifestyle Image Opportunities
                  </h3>
                </div>
                <Link
                  href="/dashboard/photos"
                  className="text-xs text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1"
                >
                  Open Photo Studio
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                {audit.lifestyleOpportunities.map((opp, i) => (
                  <div
                    key={i}
                    className="p-4 rounded-xl border border-stone-100 bg-gradient-to-br from-brand-50/30 to-transparent hover:border-brand-200 transition"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Image className="w-3.5 h-3.5 text-brand-500" />
                      <span className="font-medium text-stone-900 text-sm">
                        {opp.title}
                      </span>
                      {priorityBadge(opp.priority)}
                    </div>
                    <p className="text-xs text-stone-600 mb-2">
                      {opp.description}
                    </p>
                    <p className="text-xs text-stone-400 flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" />
                      {opp.impact}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Improvements */}
          {audit.improvements.length > 0 && (
            <div className="bg-white rounded-2xl border border-stone-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <Eye className="w-4 h-4 text-blue-500" />
                <h3 className="font-semibold text-stone-900 text-sm">
                  Photo Improvements
                </h3>
              </div>
              <div className="space-y-3">
                {audit.improvements.map((imp, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-4 p-4 rounded-xl bg-stone-50 border border-stone-100"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-stone-900 text-sm">
                          {imp.title}
                        </span>
                        {priorityBadge(imp.priority)}
                        <span className="text-[10px] text-stone-400 uppercase tracking-wider">
                          {imp.category}
                        </span>
                      </div>
                      <p className="text-xs text-stone-500">
                        {imp.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Photo grid */}
          {photos.length > 0 && (
            <div className="bg-white rounded-2xl border border-stone-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <Camera className="w-4 h-4 text-stone-400" />
                <h3 className="font-semibold text-stone-900 text-sm">
                  Current Listing Photos ({photos.length})
                </h3>
              </div>
              <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
                {photos.map((url, i) => (
                  <div
                    key={i}
                    className="aspect-square rounded-lg overflow-hidden bg-stone-100"
                  >
                    <img
                      src={url}
                      alt={`Listing photo ${i + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
