"use client";

import { useState } from "react";
import type { OptimizationResult } from "@/lib/types";

interface Props {
  onSuccess: (
    result: OptimizationResult,
    original: { title: string; description: string }
  ) => void;
}

const EXAMPLE_LISTING = {
  title: "Cozy 2BR apartment near downtown",
  description: `Welcome to our apartment! This is a nice 2 bedroom place that has everything you need for your stay. We have a full kitchen with appliances, a living room with TV, and two bedrooms with comfortable beds. The bathroom is clean. We are located near downtown so you can walk to restaurants and shops. There is free parking available. WiFi is included. We allow pets. Check in is at 3pm and checkout is at 11am. We hope you enjoy your stay and please leave us a 5 star review if you liked it!`,
};

export default function OptimizationForm({ onSuccess }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function loadExample() {
    setTitle(EXAMPLE_LISTING.title);
    setDescription(EXAMPLE_LISTING.description);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!title.trim() && !description.trim()) {
      setError("Please enter a title and/or description to optimize.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/listings/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Server error: ${response.status}`);
      }

      onSuccess(data, {
        title: title.trim(),
        description: description.trim(),
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  const titleLength = title.length;
  const titleOver = titleLength > 50;

  return (
    <div className="max-w-3xl mx-auto">
      {/* Example Button */}
      <div className="flex justify-end mb-4">
        <button
          type="button"
          onClick={loadExample}
          className="text-sm text-brand-400 hover:text-brand-300 underline underline-offset-2 transition-colors"
        >
          Load example listing →
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Title Field */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-300">
              Current Title
            </label>
            <span
              className={`text-xs font-mono tabular-nums ${
                titleOver ? "text-red-400" : "text-gray-500"
              }`}
            >
              {titleLength}/50{titleOver && " — over limit"}
            </span>
          </div>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Cozy 2BR apartment near downtown"
            className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors"
          />
          <p className="mt-1.5 text-xs text-gray-500">
            Airbnb titles max out at 50 characters. We&apos;ll optimize for that.
          </p>
        </div>

        {/* Description Field */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Current Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Paste your full listing description here..."
            rows={10}
            className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors resize-y font-mono text-sm leading-relaxed"
          />
          <p className="mt-1.5 text-xs text-gray-500">
            The more detail you include, the better the optimization. Include
            amenities, location highlights, and what makes your place special.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-950/50 border border-red-800 rounded-xl p-4 flex items-start gap-3">
            <span className="text-red-400 text-lg flex-shrink-0">⚠</span>
            <div>
              <p className="text-red-300 text-sm font-medium">
                Optimization failed
              </p>
              <p className="text-red-400 text-sm mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-brand-600 hover:bg-brand-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold px-8 py-4 rounded-xl text-lg transition-colors flex items-center justify-center gap-3"
        >
          {loading ? (
            <>
              <SpinnerIcon />
              Optimizing your listing...
            </>
          ) : (
            <>
              <span>✦</span>
              Optimize My Listing
            </>
          )}
        </button>

        {loading && (
          <p className="text-center text-sm text-gray-500 animate-pulse">
            Claude is rewriting your listing for maximum search visibility...
          </p>
        )}
      </form>

      {/* Trust signals */}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-gray-600">
        <span>✓ Free to use</span>
        <span>✓ Results in ~30 seconds</span>
        <span>✓ No account required</span>
        <span>✓ Airbnb & Vrbo optimized</span>
      </div>
    </div>
  );
}

function SpinnerIcon() {
  return (
    <svg
      className="animate-spin h-5 w-5 text-white"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}
