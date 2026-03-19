"use client";

import { useState, useEffect } from "react";

interface GeneratedPhoto {
  id: string;
  imageUrl: string;
  scene: string;
  season: string;
  aspect: string;
  caption: string;
  hashtags: string;
  favorited: boolean;
  createdAt: string;
}

const SCENES = [
  { id: "morning-coffee", label: "Morning Coffee", icon: "☕", desc: "Guest enjoying coffee with the view" },
  { id: "couple-dinner", label: "Romantic Dinner", icon: "🍷", desc: "Couple cooking or dining together" },
  { id: "friends-gathering", label: "Friends Hangout", icon: "🥂", desc: "Group relaxing, drinks and conversation" },
  { id: "solo-reading", label: "Cozy Retreat", icon: "📖", desc: "Solo guest reading or relaxing" },
  { id: "family-fun", label: "Family Time", icon: "👨‍👩‍👧‍👦", desc: "Family enjoying the space together" },
  { id: "outdoor-lounge", label: "Outdoor Living", icon: "🌅", desc: "Guests enjoying the patio or deck" },
];

const SEASONS = [
  { id: "spring", label: "Spring", icon: "🌸" },
  { id: "summer", label: "Summer", icon: "☀️" },
  { id: "fall", label: "Fall", icon: "🍂" },
  { id: "winter", label: "Winter", icon: "❄️" },
];

const ASPECTS = [
  { id: "4:5", label: "Instagram Post", icon: "📱", desc: "4:5 portrait" },
  { id: "1:1", label: "Square", icon: "⬜", desc: "1:1 universal" },
  { id: "9:16", label: "Story / Reel", icon: "📲", desc: "9:16 vertical" },
  { id: "16:9", label: "Listing / Banner", icon: "🖥", desc: "16:9 landscape" },
];

const PEOPLE = [
  { id: "solo", label: "Solo Guest" },
  { id: "couple", label: "Couple" },
  { id: "family", label: "Family" },
  { id: "friends", label: "Friend Group" },
];

export default function PhotoStudioPage() {
  const [step, setStep] = useState<"loading" | "pick-photo" | "configure" | "generating" | "results">("loading");
  const [selectedScene, setSelectedScene] = useState("morning-coffee");
  const [selectedSeason, setSelectedSeason] = useState("summer");
  const [selectedAspect, setSelectedAspect] = useState("4:5");
  const [selectedPeople, setSelectedPeople] = useState("couple");
  const [generating, setGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<GeneratedPhoto | null>(null);
  const [gallery, setGallery] = useState<GeneratedPhoto[]>([]);
  const [error, setError] = useState("");
  const [showGallery, setShowGallery] = useState(false);
  const [progress, setProgress] = useState(0);
  const [listingPhotos, setListingPhotos] = useState<string[]>([]);
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState<string | null>(null);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [propertyDescription, setPropertyDescription] = useState("");

  // Load listing photos on mount
  useEffect(() => {
    const auditData = sessionStorage.getItem("audit_result");
    if (!auditData) {
      setStep("pick-photo");
      return;
    }

    const parsed = JSON.parse(auditData);
    const listingUrl = parsed.url || "";
    if (!listingUrl) {
      setStep("pick-photo");
      return;
    }

    // Check if we already scraped photos
    const cachedPhotos = localStorage.getItem("hg_listing_photos");
    if (cachedPhotos) {
      const cached = JSON.parse(cachedPhotos);
      setListingPhotos(cached.photos || []);
      setPropertyDescription(cached.description || "");
      setSelectedPhotoUrl(cached.photos?.[0] || null);
      setStep("pick-photo");
      return;
    }

    // Scrape photos from listing
    setLoadingPhotos(true);
    fetch("/api/scrape-photos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: listingUrl }),
    })
      .then((r) => r.json())
      .then((data) => {
        const photos = data.photos || [];
        setListingPhotos(photos);
        setPropertyDescription(data.description || "");
        if (photos.length > 0) setSelectedPhotoUrl(photos[0]);
        localStorage.setItem("hg_listing_photos", JSON.stringify(data));
        setStep("pick-photo");
      })
      .catch(() => setStep("pick-photo"))
      .finally(() => setLoadingPhotos(false));
  }, []);

  // Load gallery from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("hg_photo_gallery");
    if (saved) setGallery(JSON.parse(saved));
  }, []);

  // Save gallery to localStorage
  useEffect(() => {
    if (gallery.length > 0) {
      localStorage.setItem("hg_photo_gallery", JSON.stringify(gallery));
    }
  }, [gallery]);

  async function handleGenerate() {
    setStep("generating");
    setGenerating(true);
    setError("");
    setProgress(0);

    // Fake progress bar
    const progressInterval = setInterval(() => {
      setProgress((p) => Math.min(p + Math.random() * 15, 90));
    }, 2000);

    try {
      if (!selectedPhotoUrl) {
        throw new Error("Please select a property photo first.");
      }

      const propertyImageUrl = selectedPhotoUrl;

      const peopleMap: Record<string, string> = {
        solo: "A single guest",
        couple: "A couple (two people)",
        family: "A family with two parents and two children",
        friends: "A group of 3-4 friends",
      };

      const res = await fetch("/api/generate-lifestyle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyImageUrl,
          season: selectedSeason,
          sceneType: selectedScene,
          propertyDescription: `${propertyDescription}. Show ${peopleMap[selectedPeople] || "a couple"} in the scene. Aspect ratio: ${selectedAspect}.`,
        }),
      });

      clearInterval(progressInterval);
      setProgress(100);

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Generation failed");
      }

      const data = await res.json();

      // Generate a caption
      const captionRes = await fetch("/api/generate-caption", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scene: selectedScene,
          season: selectedSeason,
          propertyDescription: propertyDescription,
        }),
      });

      let caption = "";
      let hashtags = "";
      if (captionRes.ok) {
        const captionData = await captionRes.json();
        caption = captionData.caption || "";
        hashtags = captionData.hashtags || "";
      }

      const photo: GeneratedPhoto = {
        id: Date.now().toString(),
        imageUrl: data.imageUrl,
        scene: selectedScene,
        season: selectedSeason,
        aspect: selectedAspect,
        caption,
        hashtags,
        favorited: false,
        createdAt: new Date().toISOString(),
      };

      setGeneratedImage(photo);
      setGallery((prev) => [photo, ...prev]);
      setStep("results");
    } catch (err) {
      clearInterval(progressInterval);
      setError(err instanceof Error ? err.message : "Failed to generate");
      setStep("configure");
    } finally {
      setGenerating(false);
    }
  }

  function handleFavorite(id: string) {
    setGallery((prev) =>
      prev.map((p) => (p.id === id ? { ...p, favorited: !p.favorited } : p))
    );
    if (generatedImage?.id === id) {
      setGeneratedImage({ ...generatedImage, favorited: !generatedImage.favorited });
    }
  }

  function handleCopyCaption(text: string) {
    navigator.clipboard.writeText(text);
  }

  const favoriteCount = gallery.filter((p) => p.favorited).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Photo Studio</h1>
          <p className="text-gray-500 mt-1">
            AI lifestyle photos of your property — ready for Instagram and your listing
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowGallery(!showGallery)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              showGallery ? "bg-gray-900 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            🖼 Gallery ({gallery.length})
            {favoriteCount > 0 && (
              <span className="ml-1 text-yellow-500">★{favoriteCount}</span>
            )}
          </button>
        </div>
      </div>

      {/* Gallery View */}
      {showGallery && gallery.length > 0 && (
        <div className="mb-8">
          <div className="flex gap-2 mb-4">
            <button className="px-3 py-1 rounded-lg text-xs font-medium bg-gray-900 text-white">All</button>
            <button className="px-3 py-1 rounded-lg text-xs font-medium bg-white border border-gray-200 text-gray-600">★ Favorites</button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {gallery.map((photo) => (
              <div key={photo.id} className="relative group rounded-xl overflow-hidden border border-gray-200">
                <img src={photo.imageUrl} alt="" className="w-full aspect-square object-cover" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition flex items-end">
                  <div className="w-full p-2 opacity-0 group-hover:opacity-100 transition flex justify-between items-center">
                    <button
                      onClick={() => handleFavorite(photo.id)}
                      className="text-xl"
                    >
                      {photo.favorited ? "★" : "☆"}
                    </button>
                    <a
                      href={photo.imageUrl}
                      download={`lifestyle-${photo.scene}-${photo.season}.png`}
                      className="px-2 py-1 bg-white rounded text-xs font-medium"
                    >
                      ⬇
                    </a>
                  </div>
                </div>
                <div className="absolute top-2 left-2">
                  <span className="text-xs bg-black/50 text-white px-2 py-0.5 rounded-full">
                    {SCENES.find((s) => s.id === photo.scene)?.icon} {SEASONS.find((s) => s.id === photo.season)?.icon}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Loading photos */}
      {step === "loading" && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="animate-spin h-8 w-8 border-4 border-green-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-500">Loading your listing photos...</p>
        </div>
      )}

      {/* Step 0: Pick a photo */}
      {step === "pick-photo" && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold mb-1">Choose a space from your listing</h3>
            <p className="text-sm text-gray-400 mb-4">
              Pick the room or area you want to create lifestyle content for
            </p>

            {listingPhotos.length > 0 ? (
              <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {listingPhotos.map((url, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedPhotoUrl(url)}
                    className={`relative aspect-square rounded-xl overflow-hidden border-3 transition ${
                      selectedPhotoUrl === url
                        ? "border-green-500 ring-2 ring-green-500/30"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <img
                      src={url}
                      alt={`Listing photo ${i + 1}`}
                      className="w-full h-full object-cover"
                    />
                    {selectedPhotoUrl === url && (
                      <div className="absolute top-2 right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-xs">✓</span>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-400 mb-4">No photos found from your listing. Run an audit first or paste a photo URL:</p>
                <input
                  type="url"
                  placeholder="Paste a property photo URL..."
                  className="w-full max-w-md px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  onChange={(e) => {
                    if (e.target.value) {
                      setSelectedPhotoUrl(e.target.value);
                      setListingPhotos([e.target.value]);
                    }
                  }}
                />
              </div>
            )}

            {selectedPhotoUrl && (
              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setStep("configure")}
                  className="px-6 py-3 bg-green-500 hover:bg-green-400 text-white font-semibold rounded-xl transition"
                >
                  Continue with this photo →
                </button>
              </div>
            )}
          </div>

          {/* Selected photo preview */}
          {selectedPhotoUrl && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wide">Selected space</p>
              <img
                src={selectedPhotoUrl}
                alt="Selected property photo"
                className="w-full max-h-64 object-cover rounded-lg"
              />
            </div>
          )}
        </div>
      )}

      {/* Step 1: Configure */}
      {step === "configure" && (
        <div className="space-y-6">
          {/* Selected photo thumbnail + change */}
          {selectedPhotoUrl && (
            <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
              <img src={selectedPhotoUrl} alt="" className="w-20 h-20 object-cover rounded-lg" />
              <div className="flex-1">
                <p className="text-sm font-medium">Selected space</p>
                <p className="text-xs text-gray-400">This photo will be used as the base for your lifestyle image</p>
              </div>
              <button
                onClick={() => setStep("pick-photo")}
                className="px-3 py-1.5 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
              >
                Change
              </button>
            </div>
          )}

          {/* Scene */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold mb-1">What&apos;s happening?</h3>
            <p className="text-sm text-gray-400 mb-4">Choose the vibe for your photo</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {SCENES.map((scene) => (
                <button
                  key={scene.id}
                  onClick={() => setSelectedScene(scene.id)}
                  className={`p-4 rounded-xl border-2 text-left transition ${
                    selectedScene === scene.id
                      ? "border-green-500 bg-green-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <span className="text-2xl">{scene.icon}</span>
                  <p className="font-medium mt-2 text-sm">{scene.label}</p>
                  <p className="text-xs text-gray-400">{scene.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Season + People (side by side) */}
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="font-semibold mb-1">Season</h3>
              <p className="text-sm text-gray-400 mb-4">Match your content to the time of year</p>
              <div className="grid grid-cols-2 gap-2">
                {SEASONS.map((season) => (
                  <button
                    key={season.id}
                    onClick={() => setSelectedSeason(season.id)}
                    className={`p-3 rounded-xl border-2 text-center transition ${
                      selectedSeason === season.id
                        ? "border-green-500 bg-green-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <span className="text-xl">{season.icon}</span>
                    <p className="text-sm font-medium mt-1">{season.label}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="font-semibold mb-1">Who&apos;s in the photo?</h3>
              <p className="text-sm text-gray-400 mb-4">Target your ideal guest segment</p>
              <div className="grid grid-cols-2 gap-2">
                {PEOPLE.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPeople(p.id)}
                    className={`p-3 rounded-xl border-2 text-center transition ${
                      selectedPeople === p.id
                        ? "border-green-500 bg-green-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <p className="text-sm font-medium">{p.label}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Aspect Ratio */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold mb-1">Where will you use this?</h3>
            <p className="text-sm text-gray-400 mb-4">We&apos;ll size it perfectly for the platform</p>
            <div className="flex gap-3">
              {ASPECTS.map((aspect) => (
                <button
                  key={aspect.id}
                  onClick={() => setSelectedAspect(aspect.id)}
                  className={`flex-1 p-4 rounded-xl border-2 text-center transition ${
                    selectedAspect === aspect.id
                      ? "border-green-500 bg-green-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <span className="text-xl">{aspect.icon}</span>
                  <p className="text-sm font-medium mt-1">{aspect.label}</p>
                  <p className="text-xs text-gray-400">{aspect.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            className="w-full py-4 bg-green-500 hover:bg-green-400 text-white font-semibold rounded-xl transition text-lg"
          >
            ✨ Generate Lifestyle Photo
          </button>
        </div>
      )}

      {/* Step 2: Generating */}
      {step === "generating" && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="max-w-md mx-auto">
            <div className="text-4xl mb-4">📸</div>
            <h3 className="text-xl font-semibold mb-2">Creating your lifestyle photo...</h3>
            <p className="text-gray-500 mb-6">
              Our AI is placing {selectedPeople === "solo" ? "a guest" : selectedPeople === "couple" ? "a couple" : selectedPeople === "family" ? "a family" : "friends"} in your property with a {SCENES.find((s) => s.id === selectedScene)?.label.toLowerCase()} vibe
            </p>
            <div className="w-full bg-gray-100 rounded-full h-3 mb-2">
              <div
                className="h-3 bg-green-500 rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-sm text-gray-400">Usually takes 15-30 seconds</p>
          </div>
        </div>
      )}

      {/* Step 3: Results */}
      {step === "results" && generatedImage && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="relative">
              <img
                src={generatedImage.imageUrl}
                alt="AI lifestyle photo"
                className="w-full max-h-[600px] object-contain bg-gray-50"
              />
              <button
                onClick={() => handleFavorite(generatedImage.id)}
                className="absolute top-4 right-4 w-10 h-10 bg-white/80 backdrop-blur rounded-full flex items-center justify-center text-xl hover:bg-white transition"
              >
                {generatedImage.favorited ? "★" : "☆"}
              </button>
            </div>

            <div className="p-6">
              <div className="flex gap-2 mb-4">
                <a
                  href={generatedImage.imageUrl}
                  download={`lifestyle-${generatedImage.scene}-${generatedImage.season}.png`}
                  className="px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-400 transition"
                >
                  ⬇ Download
                </a>
                <button
                  onClick={() => { setStep("configure"); setGeneratedImage(null); }}
                  className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition"
                >
                  🔄 Generate Another
                </button>
                <button
                  onClick={() => setStep("configure")}
                  className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition"
                >
                  ✏️ Adjust Settings
                </button>
              </div>

              {/* Auto-generated caption */}
              {generatedImage.caption && (
                <div className="border-t border-gray-100 pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium text-gray-500">📝 Ready-to-post caption</h4>
                    <button
                      onClick={() => handleCopyCaption(generatedImage.caption + "\n\n" + generatedImage.hashtags)}
                      className="text-xs text-green-600 font-medium hover:text-green-700"
                    >
                      📋 Copy caption + hashtags
                    </button>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{generatedImage.caption}</p>
                    {generatedImage.hashtags && (
                      <p className="text-sm text-blue-500 mt-2">{generatedImage.hashtags}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
