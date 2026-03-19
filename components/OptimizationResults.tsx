"use client";

import { useState } from "react";
import type { OptimizationResult, ChangeExplanation } from "@/lib/types";

interface Props {
  result: OptimizationResult;
  original: { title: string; description: string };
  onReset: () => void;
}

export default function OptimizationResults({ result, original, onReset }: Props) {
  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Score Banner */}
      <div className="bg-gradient-to-r from-brand-900/40 to-purple-900/40 border border-brand-700/50 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">
            Your listing has been optimized ✦
          </h2>
          <p className="text-gray-400 mt-1">
            {result.changes.length} improvements made. Here&apos;s exactly what changed and why.
          </p>
        </div>
        <button
          onClick={onReset}
          className="flex-shrink-0 border border-gray-600 hover:border-gray-400 text-gray-300 hover:text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors"
        >
          ← Optimize another
        </button>
      </div>

      {/* Title Comparison */}
      <ComparisonCard
        label="Title"
        icon="🔍"
        original={original.title}
        optimized={result.optimized.title}
        hint={`${result.optimized.title.length}/50 characters`}
        hintColor={result.optimized.title.length <= 50 ? "text-green-400" : "text-red-400"}
      />

      {/* Description Comparison */}
      <ComparisonCard
        label="Description"
        icon="✍️"
        original={original.description}
        optimized={result.optimized.description}
        multiline
      />

      {/* Tags */}
      <TagsCard tags={result.optimized.tags} />

      {/* Change Explanations */}
      <ChangesCard changes={result.changes} />

      {/* CTA */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center">
        <div className="text-3xl mb-3">🚀</div>
        <h3 className="text-xl font-bold text-white mb-2">
          Want this done automatically — every month?
        </h3>
        <p className="text-gray-400 mb-6 max-w-lg mx-auto">
          Hospitality God monitors your listing performance and continuously
          re-optimizes your title, description, tags, and photos as Airbnb&apos;s
          algorithm evolves.
        </p>
        <a
          href="/"
          className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white font-semibold px-8 py-3 rounded-xl transition-colors"
        >
          Get started — $149/mo
          <span>→</span>
        </a>
      </div>
    </div>
  );
}

// ─── Comparison Card ───────────────────────────────────────────────────────────

function ComparisonCard({
  label,
  icon,
  original,
  optimized,
  hint,
  hintColor,
  multiline = false,
}: {
  label: string;
  icon: string;
  original: string;
  optimized: string;
  hint?: string;
  hintColor?: string;
  multiline?: boolean;
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-800 flex items-center gap-2">
        <span>{icon}</span>
        <h3 className="font-semibold text-white">{label}</h3>
        {hint && (
          <span className={`ml-auto text-xs font-mono ${hintColor || "text-gray-500"}`}>
            {hint}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-gray-800">
        {/* Original */}
        <div className="p-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Original
            </span>
          </div>
          {multiline ? (
            <p className="text-gray-400 text-sm leading-relaxed whitespace-pre-wrap font-mono">
              {original || <span className="italic text-gray-600">No content provided</span>}
            </p>
          ) : (
            <p className="text-gray-400 font-mono">
              {original || <span className="italic text-gray-600">No title provided</span>}
            </p>
          )}
        </div>

        {/* Optimized */}
        <div className="p-6 relative">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-brand-400">
              ✦ Optimized
            </span>
            <CopyButton text={optimized} label={label} />
          </div>
          {multiline ? (
            <p className="text-white text-sm leading-relaxed whitespace-pre-wrap font-mono">
              {optimized}
            </p>
          ) : (
            <p className="text-white font-mono font-medium">{optimized}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Tags Card ────────────────────────────────────────────────────────────────

function TagsCard({ tags }: { tags: string[] }) {
  const tagsText = tags.join(", ");

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span>🏷️</span>
          <h3 className="font-semibold text-white">Optimized Tags</h3>
        </div>
        <CopyButton text={tagsText} label="Tags" />
      </div>
      <div className="p-6">
        <div className="flex flex-wrap gap-2 mb-3">
          {tags.map((tag) => (
            <span
              key={tag}
              className="bg-brand-900/50 border border-brand-700/50 text-brand-300 px-3 py-1.5 rounded-full text-sm font-medium"
            >
              {tag}
            </span>
          ))}
        </div>
        <p className="text-xs text-gray-600">
          These tags surface your listing in relevant Airbnb and Vrbo searches.
        </p>
      </div>
    </div>
  );
}

// ─── Changes Card ─────────────────────────────────────────────────────────────

function ChangesCard({ changes }: { changes: ChangeExplanation[] }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-800 flex items-center gap-2">
        <span>💡</span>
        <h3 className="font-semibold text-white">What Changed & Why</h3>
        <span className="ml-auto text-xs bg-brand-900/50 border border-brand-700/50 text-brand-400 px-2.5 py-0.5 rounded-full">
          {changes.length} changes
        </span>
      </div>
      <div className="divide-y divide-gray-800/50">
        {changes.map((change, i) => (
          <ChangeItem key={i} change={change} index={i} />
        ))}
      </div>
    </div>
  );
}

function ChangeItem({
  change,
  index,
}: {
  change: ChangeExplanation;
  index: number;
}) {
  const [open, setOpen] = useState(true);

  const categoryColors: Record<string, string> = {
    title: "text-blue-400 bg-blue-950/40 border-blue-800/50",
    description: "text-purple-400 bg-purple-950/40 border-purple-800/50",
    tags: "text-green-400 bg-green-950/40 border-green-800/50",
    seo: "text-yellow-400 bg-yellow-950/40 border-yellow-800/50",
    conversion: "text-orange-400 bg-orange-950/40 border-orange-800/50",
    voice: "text-pink-400 bg-pink-950/40 border-pink-800/50",
  };

  const catStyle =
    categoryColors[change.category?.toLowerCase() ?? ""] ||
    "text-gray-400 bg-gray-800/40 border-gray-700/50";

  return (
    <div className="px-6 py-4">
      <button
        className="w-full text-left flex items-start gap-4"
        onClick={() => setOpen(!open)}
      >
        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-brand-900/50 border border-brand-700/50 text-brand-400 text-xs flex items-center justify-center font-bold mt-0.5">
          {index + 1}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${catStyle}`}
            >
              {change.category}
            </span>
            <span className="font-medium text-white text-sm">{change.what}</span>
          </div>
        </div>
        <span className="text-gray-600 flex-shrink-0 text-sm mt-0.5">
          {open ? "▲" : "▼"}
        </span>
      </button>

      {open && (
        <div className="mt-3 ml-10">
          <p className="text-gray-400 text-sm leading-relaxed">{change.why}</p>
          {change.impact && (
            <p className="mt-2 text-xs text-gray-500 flex items-center gap-1.5">
              <span className="text-green-500">↑</span>
              <span>{change.impact}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Copy Button ──────────────────────────────────────────────────────────────

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const el = document.createElement("textarea");
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <button
      onClick={handleCopy}
      className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all ${
        copied
          ? "border-green-700 bg-green-950/40 text-green-400"
          : "border-gray-700 hover:border-gray-500 text-gray-400 hover:text-white"
      }`}
      title={`Copy ${label}`}
    >
      {copied ? (
        <>
          <span>✓</span>
          Copied!
        </>
      ) : (
        <>
          <span>⎘</span>
          Copy {label}
        </>
      )}
    </button>
  );
}
