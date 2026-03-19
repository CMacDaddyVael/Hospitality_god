"use client";

import { useState, useEffect } from "react";

interface Deliverable {
  id: string;
  type: "listing" | "social" | "review" | "seasonal";
  title: string;
  status: "pending" | "approved" | "dismissed";
  content: string;
  preview?: string;
  impact?: string;
  createdAt: string;
}

const MOCK_DELIVERABLES: Deliverable[] = [
  {
    id: "1",
    type: "listing",
    title: "Optimized Listing Title",
    status: "pending",
    content: "Battenkill Riverfront Estate | 500 Ft River Frontage, Mountain Views & 4 Private Acres",
    preview: "Replaces: \"Private Riverfront Getaway with Mountain Views\"",
    impact: "15-25% more search visibility",
    createdAt: "Today",
  },
  {
    id: "2",
    type: "listing",
    title: "Rewritten Description — First Paragraph",
    status: "pending",
    content: "Step onto your private covered deck and watch the sun set behind Mount Equinox while the Battenkill River glides past 500 feet of your exclusive riverfront — this is one of Manchester's most unique properties, sitting on 4 private acres at the end of a quiet road with zero neighbors in sight. Over 2,900 sq ft of thoughtfully designed living space sleeps up to 10 guests across 4 queen bedrooms, a finished basement, and a flexible daybed suite — perfect for multi-family getaways or group retreats.",
    preview: "Replaces generic first paragraph with specific, evocative details",
    impact: "10-20% improvement in inquiry rate",
    createdAt: "Today",
  },
  {
    id: "3",
    type: "social",
    title: "Instagram Post — Spring on the Battenkill",
    status: "pending",
    content: "Morning light hits different when your backyard is the Battenkill River 🎣✨\n\nSpring is officially here in Manchester, Vermont — and the fly fishing season is calling. Our riverfront property sits on 500 ft of private Battenkill frontage with mountain views that never get old.\n\nBook your spring escape → link in bio\n\n#battenkillriver #manchestervermont #vermontairbnb #flyfishing #riverfrontproperty #vermontgetaway #springtravel #airbnbsuperhost",
    preview: "Seasonal spring content targeting fly fishing travelers",
    impact: "Captures shoulder-season bookings",
    createdAt: "Today",
  },
  {
    id: "4",
    type: "social",
    title: "Instagram Post — Group Getaway Angle",
    status: "pending",
    content: "POV: You booked the whole estate for your crew 🏡\n\n4 bedrooms. 4 private acres. 500 ft of river. Zero neighbors. Mountain views from the deck. Ping pong tournaments in the basement. S'mores by the fire pit.\n\nThis is what group trips were made for.\n\n📍 Manchester, Vermont\n🛏 Sleeps 10 | 4 Queens + Daybed Suite\n🎣 Private Battenkill River access\n\n#grouptravel #friendsgetaway #vermontairbnb #airbnbfinds #weekendgetaway #travelvermont",
    preview: "Targeting group/family bookings — highest ADR segment",
    impact: "Group bookings average 2x nightly rate",
    createdAt: "Today",
  },
  {
    id: "5",
    type: "review",
    title: "Response to Sarah's 5-Star Review",
    status: "pending",
    content: "Thank you so much, Sarah! We're thrilled you and your family had such a wonderful time at the property. The Battenkill really is magical in the early morning — glad you got to experience that. The kids' reaction to the ping pong table always makes us smile! We'd love to host you all again, especially during fall when the foliage along the river is absolutely stunning. Safe travels! 🍂",
    preview: "Warm, personal response referencing specific moments from their stay",
    impact: "Builds social proof and signals active host management",
    createdAt: "Today",
  },
];

const typeConfig = {
  listing: { label: "Listing Copy", icon: "✍️", color: "bg-blue-50 text-blue-700" },
  social: { label: "Social Post", icon: "📸", color: "bg-pink-50 text-pink-700" },
  review: { label: "Review Response", icon: "⭐", color: "bg-yellow-50 text-yellow-700" },
  seasonal: { label: "Seasonal Update", icon: "🍂", color: "bg-orange-50 text-orange-700" },
};

export default function DeliverablesPage() {
  const [deliverables, setDeliverables] = useState(MOCK_DELIVERABLES);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [generating, setGenerating] = useState(false);
  const [lifestyleImage, setLifestyleImage] = useState<string | null>(null);
  const [imageError, setImageError] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");

  // Try to grab a photo URL from the audit result
  useEffect(() => {
    const stored = sessionStorage.getItem("audit_result");
    if (stored) {
      try {
        const data = JSON.parse(stored);
        // Extract first image from the scraped listing
        const url = data.url || "";
        if (url.includes("airbnb.com")) {
          // Use the listing URL to construct a likely image
          setPhotoUrl(url);
        }
      } catch {}
    }
  }, []);

  async function handleGenerateLifestyle(scene: string, season: string) {
    setGenerating(true);
    setImageError("");
    try {
      // First, scrape the listing to get a photo URL
      const scrapeRes = await fetch("/api/scrape-photos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: photoUrl }),
      });
      const scrapeData = await scrapeRes.json();
      const propertyImageUrl = scrapeData.photos?.[0];

      if (!propertyImageUrl) {
        setImageError("Could not find property photos. Try pasting a photo URL directly.");
        return;
      }

      const res = await fetch("/api/generate-lifestyle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyImageUrl,
          season,
          sceneType: scene,
          propertyDescription: scrapeData.description || "",
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Generation failed");
      }

      const data = await res.json();
      setLifestyleImage(data.imageUrl);
    } catch (err) {
      setImageError(err instanceof Error ? err.message : "Failed to generate image");
    } finally {
      setGenerating(false);
    }
  }

  function handleCopy(id: string, content: string) {
    navigator.clipboard.writeText(content);
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
          <h1 className="text-2xl font-bold">Deliverables</h1>
          <p className="text-gray-500 mt-1">
            {pendingCount} items ready for your review
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6">
        {[
          { key: "all", label: "All" },
          { key: "listing", label: "✍️ Listing" },
          { key: "social", label: "📸 Social" },
          { key: "review", label: "⭐ Reviews" },
          { key: "seasonal", label: "🍂 Seasonal" },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
              filter === f.key
                ? "bg-gray-900 text-white"
                : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Lifestyle Image Generator */}
      <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl border border-purple-200 p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="font-semibold text-lg flex items-center gap-2">
              📸 AI Lifestyle Photos
              <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">Powered by VAEL</span>
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Generate lifestyle images of real people enjoying your property — ready for Instagram and your listing.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          {[
            { scene: "morning-coffee", season: "spring", label: "☕ Morning Coffee" },
            { scene: "couple-dinner", season: "summer", label: "🍷 Couple's Dinner" },
            { scene: "friends-gathering", season: "fall", label: "🍂 Fall Gathering" },
            { scene: "solo-reading", season: "winter", label: "📖 Cozy Reading" },
            { scene: "family-fun", season: "summer", label: "👨‍👩‍👧‍👦 Family Fun" },
          ].map((opt) => (
            <button
              key={opt.scene}
              onClick={() => handleGenerateLifestyle(opt.scene, opt.season)}
              disabled={generating}
              className="px-4 py-2 bg-white border border-purple-200 rounded-lg text-sm font-medium hover:bg-purple-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {opt.label}
            </button>
          ))}
        </div>

        {generating && (
          <div className="flex items-center gap-3 p-4 bg-white rounded-lg">
            <svg className="animate-spin h-5 w-5 text-purple-500" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-sm text-gray-600">Generating lifestyle image... this takes 15-30 seconds</span>
          </div>
        )}

        {imageError && (
          <p className="text-sm text-red-500 mt-2">{imageError}</p>
        )}

        {lifestyleImage && (
          <div className="mt-4">
            <img
              src={lifestyleImage}
              alt="AI-generated lifestyle photo"
              className="w-full max-w-lg rounded-xl shadow-lg"
            />
            <div className="flex gap-2 mt-3">
              <a
                href={lifestyleImage}
                download="lifestyle-photo.png"
                className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-500 transition"
              >
                ⬇ Download
              </a>
              <button
                onClick={() => setLifestyleImage(null)}
                className="px-4 py-2 text-gray-500 text-sm hover:text-gray-700"
              >
                Generate another
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Deliverables List */}
      <div className="space-y-4">
        {filtered.map((item) => {
          const config = typeConfig[item.type];
          const isApproved = item.status === "approved";
          const isDismissed = item.status === "dismissed";

          return (
            <div
              key={item.id}
              className={`bg-white rounded-xl border p-6 transition ${
                isApproved
                  ? "border-green-200 bg-green-50/30"
                  : isDismissed
                  ? "border-gray-200 opacity-50"
                  : "border-gray-200"
              }`}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${config.color}`}>
                    {config.icon} {config.label}
                  </span>
                  <span className="text-xs text-gray-400">{item.createdAt}</span>
                  {isApproved && (
                    <span className="text-xs font-medium px-2 py-1 rounded-full bg-green-100 text-green-700">
                      ✓ Approved
                    </span>
                  )}
                </div>
                {item.impact && (
                  <span className="text-xs text-green-600 font-medium">📈 {item.impact}</span>
                )}
              </div>

              <h3 className="font-semibold text-gray-900 mb-2">{item.title}</h3>

              {item.preview && (
                <p className="text-sm text-gray-400 mb-3 italic">{item.preview}</p>
              )}

              {/* Content Box */}
              <div className="bg-gray-50 rounded-lg p-4 mb-4 relative group">
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{item.content}</p>
              </div>

              {/* Actions */}
              {!isDismissed && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleCopy(item.id, item.content)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition"
                  >
                    {copiedId === item.id ? "✓ Copied!" : "📋 Copy to Clipboard"}
                  </button>
                  {!isApproved && (
                    <>
                      <button
                        onClick={() => handleApprove(item.id)}
                        className="flex items-center gap-1.5 px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-400 transition"
                      >
                        ✓ Approve
                      </button>
                      <button
                        onClick={() => handleDismiss(item.id)}
                        className="px-4 py-2 text-gray-400 text-sm hover:text-gray-600 transition"
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
