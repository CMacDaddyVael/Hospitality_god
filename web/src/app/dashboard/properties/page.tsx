"use client";

import { useState, useEffect } from "react";
import { Plus, ExternalLink, BarChart3, Trash2, Home, RefreshCw } from "lucide-react";

interface Property {
  id: string;
  name: string;
  platform: "airbnb" | "vrbo" | "direct" | "other";
  url: string;
  score: number | null;
  lastAudited: string | null;
  photoUrl: string | null;
  location: string | null;
  status: "active" | "auditing" | "pending";
}

const PLATFORM_META: Record<string, { label: string; color: string; bg: string }> = {
  airbnb: { label: "Airbnb", color: "text-rose-700", bg: "bg-rose-50" },
  vrbo: { label: "Vrbo", color: "text-blue-700", bg: "bg-blue-50" },
  direct: { label: "Direct Site", color: "text-emerald-700", bg: "bg-emerald-50" },
  other: { label: "Other", color: "text-stone-600", bg: "bg-stone-100" },
};

function detectPlatform(url: string): "airbnb" | "vrbo" | "direct" | "other" {
  if (url.includes("airbnb.com")) return "airbnb";
  if (url.includes("vrbo.com") || url.includes("homeaway.com")) return "vrbo";
  return "other";
}

function scoreColor(score: number | null) {
  if (score === null) return "text-stone-300";
  if (score >= 80) return "text-emerald-600";
  if (score >= 60) return "text-amber-600";
  if (score >= 40) return "text-orange-600";
  return "text-red-600";
}

export default function PropertiesPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);

  // Load properties from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("hg_properties");
    if (saved) {
      setProperties(JSON.parse(saved));
    } else {
      // Seed from audit if available
      const auditData = sessionStorage.getItem("audit_result");
      if (auditData) {
        const parsed = JSON.parse(auditData);
        const initial: Property = {
          id: "prop-1",
          name: parsed.audit?.property_name || "My Property",
          platform: detectPlatform(parsed.url || ""),
          url: parsed.url || "",
          score: parsed.audit?.overall_score || null,
          lastAudited: new Date().toISOString(),
          photoUrl: parsed.listingPhotos?.[0] || null,
          location: null,
          status: "active",
        };
        setProperties([initial]);
        localStorage.setItem("hg_properties", JSON.stringify([initial]));
      }
    }
  }, []);

  function saveProperties(updated: Property[]) {
    setProperties(updated);
    localStorage.setItem("hg_properties", JSON.stringify(updated));
  }

  async function handleAddProperty() {
    if (!newUrl.trim()) return;
    setAdding(true);

    const newProp: Property = {
      id: `prop-${Date.now()}`,
      name: newName.trim() || "New Property",
      platform: detectPlatform(newUrl.trim()),
      url: newUrl.trim(),
      score: null,
      lastAudited: null,
      photoUrl: null,
      location: null,
      status: "pending",
    };

    const updated = [...properties, newProp];
    saveProperties(updated);
    setNewUrl("");
    setNewName("");
    setShowAddForm(false);
    setAdding(false);
  }

  function handleRemove(id: string) {
    saveProperties(properties.filter((p) => p.id !== id));
  }

  async function handleAudit(prop: Property) {
    saveProperties(
      properties.map((p) => (p.id === prop.id ? { ...p, status: "auditing" as const } : p))
    );

    try {
      const res = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: prop.url }),
      });

      if (!res.ok) throw new Error("Audit failed");
      const data = await res.json();

      saveProperties(
        properties.map((p) =>
          p.id === prop.id
            ? {
                ...p,
                score: data.audit?.overall_score || null,
                name: data.audit?.property_name || p.name,
                lastAudited: new Date().toISOString(),
                photoUrl: data.listingPhotos?.[0] || p.photoUrl,
                status: "active" as const,
              }
            : p
        )
      );

      // Store audit result for dashboard
      sessionStorage.setItem("audit_result", JSON.stringify(data));
    } catch {
      saveProperties(
        properties.map((p) => (p.id === prop.id ? { ...p, status: "active" as const } : p))
      );
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900">Properties</h1>
          <p className="text-stone-500 mt-1 text-sm">
            Manage all your listings across platforms
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-700 transition"
        >
          <Plus className="w-4 h-4" />
          Add Property
        </button>
      </div>

      {/* Add Property Form */}
      {showAddForm && (
        <div className="bg-white rounded-xl border border-stone-200 p-6 mb-6">
          <h3 className="font-semibold text-stone-900 mb-4">Add a new listing</h3>
          <div className="space-y-3">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Property name (optional)"
              className="w-full px-4 py-3 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <input
              type="url"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              placeholder="Paste Airbnb, Vrbo, or website URL..."
              className="w-full px-4 py-3 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              required
            />
            <div className="flex gap-2">
              <button
                onClick={handleAddProperty}
                disabled={adding || !newUrl.trim()}
                className="px-5 py-2.5 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-700 transition disabled:opacity-50"
              >
                {adding ? "Adding..." : "Add listing"}
              </button>
              <button
                onClick={() => setShowAddForm(false)}
                className="px-5 py-2.5 text-stone-500 text-sm hover:text-stone-700"
              >
                Cancel
              </button>
            </div>
          </div>
          <p className="text-xs text-stone-400 mt-3">
            Add the same property on different platforms (Airbnb + Vrbo) or add multiple properties.
          </p>
        </div>
      )}

      {/* Empty State */}
      {properties.length === 0 && !showAddForm && (
        <div className="bg-white rounded-xl border border-stone-200 p-12 text-center">
          <Home className="w-12 h-12 text-stone-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-stone-900 mb-2">No properties yet</h3>
          <p className="text-stone-500 max-w-md mx-auto mb-6">
            Add your Airbnb and Vrbo listings. We&apos;ll audit each one and start optimizing.
          </p>
          <button
            onClick={() => setShowAddForm(true)}
            className="px-6 py-3 bg-brand-600 text-white rounded-xl font-medium hover:bg-brand-700 transition"
          >
            Add your first property
          </button>
        </div>
      )}

      {/* Property Cards */}
      <div className="space-y-4">
        {properties.map((prop) => {
          const platformMeta = PLATFORM_META[prop.platform];
          return (
            <div key={prop.id} className="bg-white rounded-xl border border-stone-200 p-5 hover:border-stone-300 transition">
              <div className="flex items-start gap-4">
                {/* Photo */}
                <div className="w-20 h-20 rounded-lg bg-stone-100 overflow-hidden flex-shrink-0">
                  {prop.photoUrl ? (
                    <img src={prop.photoUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Home className="w-8 h-8 text-stone-300" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-stone-900 truncate">{prop.name}</h3>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${platformMeta.bg} ${platformMeta.color}`}>
                      {platformMeta.label}
                    </span>
                  </div>
                  <a
                    href={prop.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-stone-400 hover:text-brand-600 transition flex items-center gap-1 truncate"
                  >
                    {prop.url.slice(0, 60)}...
                    <ExternalLink className="w-3 h-3 flex-shrink-0" />
                  </a>
                  {prop.lastAudited && (
                    <p className="text-xs text-stone-400 mt-1">
                      Last audited: {new Date(prop.lastAudited).toLocaleDateString()}
                    </p>
                  )}
                </div>

                {/* Score */}
                <div className="text-right flex-shrink-0">
                  <p className={`text-2xl font-bold font-mono ${scoreColor(prop.score)}`}>
                    {prop.score !== null ? prop.score : "—"}
                  </p>
                  <p className="text-xs text-stone-400">score</p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => handleAudit(prop)}
                    disabled={prop.status === "auditing"}
                    className="p-2 text-stone-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition disabled:opacity-50"
                    title="Run audit"
                  >
                    {prop.status === "auditing" ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <BarChart3 className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    onClick={() => handleRemove(prop.id)}
                    className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                    title="Remove"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
