"use client";

import { useState } from "react";
import OptimizationForm from "@/components/OptimizationForm";
import OptimizationResults from "@/components/OptimizationResults";
import type { OptimizationResult } from "@/lib/types";

export default function OptimizePage() {
  const [result, setResult] = useState<OptimizationResult | null>(null);
  const [originalInput, setOriginalInput] = useState<{
    title: string;
    description: string;
  } | null>(null);

  function handleSuccess(
    data: OptimizationResult,
    original: { title: string; description: string }
  ) {
    setResult(data);
    setOriginalInput(original);
    // Scroll to results
    setTimeout(() => {
      document.getElementById("results")?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  }

  function handleReset() {
    setResult(null);
    setOriginalInput(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="min-h-screen">
      {/* Nav */}
      <nav className="border-b border-gray-800 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <a href="/" className="flex items-center gap-2">
            <span className="text-brand-500 font-bold text-lg">✦ Hospitality God</span>
          </a>
          <span className="text-sm text-gray-500 bg-gray-900 border border-gray-700 px-3 py-1 rounded-full">
            Listing Optimizer
          </span>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4 bg-gradient-to-br from-white to-gray-400 bg-clip-text text-transparent">
            Optimize Your Listing
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Paste your current title and description. Our AI rewrites them for
            maximum search visibility and booking conversion — and explains every
            change.
          </p>
        </div>

        {/* Form */}
        {!result && (
          <OptimizationForm onSuccess={handleSuccess} />
        )}

        {/* Results */}
        {result && originalInput && (
          <div id="results">
            <OptimizationResults
              result={result}
              original={originalInput}
              onReset={handleReset}
            />
          </div>
        )}
      </main>
    </div>
  );
}
