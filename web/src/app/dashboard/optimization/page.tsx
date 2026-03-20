"use client";

import { useState, useEffect } from "react";
import { TrendingUp, CheckCircle, AlertTriangle, Clock, RefreshCw, ArrowRight } from "lucide-react";

interface OptimizationItem {
  id: string;
  category: string;
  title: string;
  currentState: string;
  recommendation: string;
  impact: string;
  status: "todo" | "in-progress" | "done";
  priority: "high" | "medium" | "low";
  lastChecked: string;
}

interface ScoreHistory {
  date: string;
  score: number;
}

export default function OptimizationPage() {
  const [items, setItems] = useState<OptimizationItem[]>([]);
  const [scoreHistory, setScoreHistory] = useState<ScoreHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentScore, setCurrentScore] = useState<number | null>(null);

  useEffect(() => {
    // Load from audit data
    const auditData = sessionStorage.getItem("audit_result");
    if (auditData) {
      const parsed = JSON.parse(auditData);
      const score = parsed.audit?.overall_score;
      if (score) {
        setCurrentScore(score);
        setScoreHistory([
          { date: new Date().toLocaleDateString(), score },
        ]);
      }

      // Convert audit recommendations into optimization items
      const categories = parsed.audit?.categories || [];
      const optimizationItems: OptimizationItem[] = [];

      categories.forEach((cat: { name: string; findings: string[]; recommendations: string[]; score: number }) => {
        cat.recommendations?.forEach((rec: string, i: number) => {
          optimizationItems.push({
            id: `opt-${cat.name}-${i}`,
            category: cat.name,
            title: rec.split(".")[0] || rec,
            currentState: cat.findings?.[i] || "Needs improvement",
            recommendation: rec,
            impact: cat.score < 60 ? "High impact" : cat.score < 80 ? "Medium impact" : "Polish",
            status: "todo",
            priority: cat.score < 60 ? "high" : cat.score < 80 ? "medium" : "low",
            lastChecked: new Date().toLocaleDateString(),
          });
        });
      });

      // Load saved status
      const savedItems = localStorage.getItem("hg_optimization_items");
      if (savedItems) {
        const saved = JSON.parse(savedItems) as OptimizationItem[];
        // Merge saved statuses with current items
        const merged = optimizationItems.map((item) => {
          const savedItem = saved.find((s) => s.id === item.id);
          return savedItem ? { ...item, status: savedItem.status } : item;
        });
        setItems(merged);
      } else {
        setItems(optimizationItems);
      }
    }
  }, []);

  function updateStatus(id: string, status: "todo" | "in-progress" | "done") {
    const updated = items.map((item) => (item.id === id ? { ...item, status } : item));
    setItems(updated);
    localStorage.setItem("hg_optimization_items", JSON.stringify(updated));
  }

  async function handleReaudit() {
    setLoading(true);
    try {
      const auditData = sessionStorage.getItem("audit_result");
      if (!auditData) return;
      const parsed = JSON.parse(auditData);

      const res = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: parsed.url }),
      });

      if (!res.ok) throw new Error("Re-audit failed");
      const data = await res.json();
      sessionStorage.setItem("audit_result", JSON.stringify(data));

      const newScore = data.audit?.overall_score;
      if (newScore) {
        setCurrentScore(newScore);
        setScoreHistory((prev) => [
          ...prev,
          { date: new Date().toLocaleDateString(), score: newScore },
        ]);
      }

      // Reload page to refresh items
      window.location.reload();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const todoCount = items.filter((i) => i.status === "todo").length;
  const doneCount = items.filter((i) => i.status === "done").length;
  const highPriority = items.filter((i) => i.priority === "high" && i.status !== "done");

  const statusConfig = {
    todo: { label: "To do", color: "text-stone-500", bg: "bg-stone-100" },
    "in-progress": { label: "In progress", color: "text-amber-700", bg: "bg-amber-50" },
    done: { label: "Done", color: "text-emerald-700", bg: "bg-emerald-50" },
  };

  const priorityConfig = {
    high: { color: "text-red-600", bg: "bg-red-50" },
    medium: { color: "text-amber-600", bg: "bg-amber-50" },
    low: { color: "text-stone-500", bg: "bg-stone-100" },
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900">Optimization</h1>
          <p className="text-stone-500 mt-1 text-sm">
            Your agent continuously monitors and improves your listing
          </p>
        </div>
        <button
          onClick={handleReaudit}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-700 transition disabled:opacity-50"
        >
          {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Re-audit now
        </button>
      </div>

      {/* Score + Progress Stats */}
      <div className="grid md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-stone-200 p-5">
          <p className="text-xs font-medium text-stone-400 uppercase tracking-wide mb-2">Current Score</p>
          <p className={`text-3xl font-bold font-mono ${currentScore && currentScore >= 70 ? "text-emerald-600" : currentScore && currentScore >= 50 ? "text-amber-600" : "text-red-600"}`}>
            {currentScore || "—"}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-stone-200 p-5">
          <p className="text-xs font-medium text-stone-400 uppercase tracking-wide mb-2">Tasks Remaining</p>
          <p className="text-3xl font-bold font-mono text-stone-900">{todoCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-stone-200 p-5">
          <p className="text-xs font-medium text-stone-400 uppercase tracking-wide mb-2">Completed</p>
          <p className="text-3xl font-bold font-mono text-emerald-600">{doneCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-stone-200 p-5">
          <p className="text-xs font-medium text-stone-400 uppercase tracking-wide mb-2">High Priority</p>
          <p className="text-3xl font-bold font-mono text-red-600">{highPriority.length}</p>
        </div>
      </div>

      {/* Score History */}
      {scoreHistory.length > 0 && (
        <div className="bg-white rounded-xl border border-stone-200 p-6 mb-6">
          <h2 className="text-sm font-semibold text-stone-900 mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-stone-400" />
            Score History
          </h2>
          <div className="flex items-end gap-3 h-24">
            {scoreHistory.map((entry, i) => (
              <div key={i} className="flex flex-col items-center gap-1">
                <span className="text-xs font-mono font-semibold text-stone-700">{entry.score}</span>
                <div
                  className="w-10 rounded-t-md bg-brand-200"
                  style={{ height: `${(entry.score / 100) * 80}px` }}
                />
                <span className="text-[10px] text-stone-400">{entry.date}</span>
              </div>
            ))}
          </div>
          {scoreHistory.length === 1 && (
            <p className="text-xs text-stone-400 mt-3">Re-audit weekly to track your progress over time.</p>
          )}
        </div>
      )}

      {/* Agent Activity */}
      <div className="bg-gradient-to-r from-brand-50 to-rose-50 border border-brand-200 rounded-xl p-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center">
            <Clock className="w-4 h-4 text-brand-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-brand-800">Your agent last checked this listing today</p>
            <p className="text-xs text-brand-600">Next automatic check: tomorrow at 8:00 AM</p>
          </div>
        </div>
      </div>

      {/* Optimization Items */}
      <div className="space-y-3">
        {items
          .sort((a, b) => {
            const priorityOrder = { high: 0, medium: 1, low: 2 };
            const statusOrder = { todo: 0, "in-progress": 1, done: 2 };
            return statusOrder[a.status] - statusOrder[b.status] || priorityOrder[a.priority] - priorityOrder[b.priority];
          })
          .map((item) => {
            const sCfg = statusConfig[item.status];
            const pCfg = priorityConfig[item.priority];

            return (
              <div
                key={item.id}
                className={`bg-white rounded-xl border border-stone-200 p-5 transition ${
                  item.status === "done" ? "opacity-60" : ""
                }`}
              >
                <div className="flex items-start gap-4">
                  {/* Status toggle */}
                  <button
                    onClick={() =>
                      updateStatus(
                        item.id,
                        item.status === "todo" ? "in-progress" : item.status === "in-progress" ? "done" : "todo"
                      )
                    }
                    className="mt-0.5 flex-shrink-0"
                  >
                    {item.status === "done" ? (
                      <CheckCircle className="w-5 h-5 text-emerald-500" />
                    ) : item.status === "in-progress" ? (
                      <Clock className="w-5 h-5 text-amber-500" />
                    ) : (
                      <div className="w-5 h-5 rounded-full border-2 border-stone-300 hover:border-brand-500 transition" />
                    )}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className={`font-medium text-sm ${item.status === "done" ? "line-through text-stone-400" : "text-stone-900"}`}>
                        {item.title}
                      </h3>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${pCfg.bg} ${pCfg.color}`}>
                        {item.priority}
                      </span>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${sCfg.bg} ${sCfg.color}`}>
                        {sCfg.label}
                      </span>
                      <span className="text-[10px] text-stone-400">{item.category}</span>
                    </div>
                    <p className="text-xs text-stone-500 mb-2">{item.recommendation}</p>
                    <div className="flex items-center gap-1">
                      <ArrowRight className="w-3 h-3 text-emerald-500" />
                      <span className="text-xs text-emerald-600 font-medium">{item.impact}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
      </div>

      {items.length === 0 && (
        <div className="bg-white rounded-xl border border-stone-200 p-12 text-center">
          <AlertTriangle className="w-12 h-12 text-stone-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-stone-900 mb-2">No optimization data yet</h3>
          <p className="text-stone-500 mb-6">Run an audit first to generate your optimization checklist.</p>
        </div>
      )}
    </div>
  );
}
