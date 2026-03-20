"use client";

import { useState, useEffect } from "react";

interface CastMember {
  id: string;
  name: string;
  gender: string;
  ethnicity: string;
  age: string;
  filePath: string;
}

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
  { id: "morning-coffee", label: "Morning Coffee", desc: "Guest enjoying coffee with the view" },
  { id: "couple-dinner", label: "Romantic Dinner", desc: "Couple cooking or dining together" },
  { id: "friends-gathering", label: "Friends Hangout", desc: "Group relaxing, drinks and conversation" },
  { id: "solo-reading", label: "Cozy Retreat", desc: "Solo guest reading or relaxing" },
  { id: "family-fun", label: "Family Time", desc: "Family enjoying the space together" },
  { id: "outdoor-lounge", label: "Outdoor Living", desc: "Guests enjoying the patio or deck" },
];

const SEASONS = [
  { id: "spring", label: "Spring" },
  { id: "summer", label: "Summer" },
  { id: "fall", label: "Fall" },
  { id: "winter", label: "Winter" },
];

const ASPECTS = [
  { id: "4:5", label: "Instagram Post", desc: "4:5 portrait" },
  { id: "1:1", label: "Square", desc: "1:1 universal" },
  { id: "9:16", label: "Story / Reel", desc: "9:16 vertical" },
  { id: "16:9", label: "Listing / Banner", desc: "16:9 landscape" },
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
  const [castMembers, setCastMembers] = useState<CastMember[]>([]);
  const [selectedCast, setSelectedCast] = useState<CastMember[]>([]);

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

  // Load cast manifest
  useEffect(() => {
    fetch("/cast/manifest.json")
      .then((r) => r.json())
      .then((data: CastMember[]) => setCastMembers(data))
      .catch(() => {});
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

      // Build talent image URLs from selected cast members
      const talentImageUrls = selectedCast.map((c) => `${window.location.origin}${c.filePath}`);

      const res = await fetch("/api/generate-lifestyle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyImageUrl,
          season: selectedSeason,
          sceneType: selectedScene,
          propertyDescription: `${propertyDescription}. Show ${peopleMap[selectedPeople] || "a couple"} in the scene. Aspect ratio: ${selectedAspect}.`,
          talentImageUrls: talentImageUrls.length > 0 ? talentImageUrls : undefined,
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
          <h1 className="text-2xl font-bold tracking-tight text-stone-900">Photo Studio</h1>
          <p className="text-stone-500 mt-1">
            AI lifestyle photos of your property — ready for Instagram and your listing
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowGallery(!showGallery)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              showGallery ? "bg-stone-900 text-white" : "bg-white border border-stone-200 text-stone-600 hover:bg-stone-50"
            }`}
          >
            Gallery ({gallery.length})
            {favoriteCount > 0 && (
              <span className="ml-1 text-yellow-500">★{favoriteCount}</span>
            )}
          </button>
          <button
            onClick={() => {
              localStorage.removeItem("hg_listing_photos");
              setListingPhotos([]);
              setSelectedPhotoUrl(null);
              setStep("loading");
              window.location.reload();
            }}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-white border border-stone-200 text-stone-600 hover:bg-stone-50 transition"
          >
            Refresh photos
          </button>
        </div>
      </div>

      {/* Gallery View */}
      {showGallery && gallery.length > 0 && (
        <div className="mb-8">
          <div className="flex gap-2 mb-4">
            <button className="px-3 py-1 rounded-lg text-xs font-medium bg-stone-900 text-white">All</button>
            <button className="px-3 py-1 rounded-lg text-xs font-medium bg-white border border-stone-200 text-stone-600">★ Favorites</button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {gallery.map((photo) => (
              <div key={photo.id} className="relative group rounded-xl overflow-hidden border border-stone-200">
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
        <div className="bg-white rounded-xl border border-stone-200 p-12 text-center">
          <div className="animate-spin h-8 w-8 border-4 border-brand-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-stone-500">Loading your listing photos...</p>
        </div>
      )}

      {/* Step 0: Pick a photo */}
      {step === "pick-photo" && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-stone-200 p-6">
            <h3 className="font-semibold mb-1">Choose a space from your listing</h3>
            <p className="text-sm text-stone-400 mb-4">
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
                        ? "border-brand-500 ring-2 ring-brand-500/30"
                        : "border-stone-200 hover:border-stone-300"
                    }`}
                  >
                    <img
                      src={url}
                      alt={`Listing photo ${i + 1}`}
                      className="w-full h-full object-cover"
                    />
                    {selectedPhotoUrl === url && (
                      <div className="absolute top-2 right-2 w-6 h-6 bg-brand-600 rounded-full flex items-center justify-center">
                        <span className="text-white text-xs">✓</span>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-stone-400 mb-4">No photos found from your listing. Run an audit first or paste a photo URL:</p>
                <input
                  type="url"
                  placeholder="Paste a property photo URL..."
                  className="w-full max-w-md px-4 py-3 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
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
                  className="px-6 py-3 bg-brand-600 hover:bg-brand-500 text-white font-semibold rounded-xl transition"
                >
                  Continue with this photo →
                </button>
              </div>
            )}
          </div>

          {/* Selected photo preview */}
          {selectedPhotoUrl && (
            <div className="bg-white rounded-xl border border-stone-200 p-4">
              <p className="text-xs text-stone-400 mb-2 font-medium uppercase tracking-wide">Selected space</p>
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
            <div className="bg-white rounded-xl border border-stone-200 p-4 flex items-center gap-4">
              <img src={selectedPhotoUrl} alt="" className="w-20 h-20 object-cover rounded-lg" />
              <div className="flex-1">
                <p className="text-sm font-medium">Selected space</p>
                <p className="text-xs text-stone-400">This photo will be used as the base for your lifestyle image</p>
              </div>
              <button
                onClick={() => setStep("pick-photo")}
                className="px-3 py-1.5 text-sm text-stone-500 border border-stone-200 rounded-lg hover:bg-stone-50 transition"
              >
                Change
              </button>
            </div>
          )}

          {/* Scene */}
          <div className="bg-white rounded-xl border border-stone-200 p-6">
            <h3 className="font-semibold mb-1">What&apos;s happening?</h3>
            <p className="text-sm text-stone-400 mb-4">Choose the vibe for your photo</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {SCENES.map((scene) => (
                <button
                  key={scene.id}
                  onClick={() => setSelectedScene(scene.id)}
                  className={`p-4 rounded-xl border-2 text-left transition ${
                    selectedScene === scene.id
                      ? "border-brand-500 bg-brand-50"
                      : "border-stone-200 hover:border-stone-300"
                  }`}
                >
                  
                  <p className="font-medium mt-2 text-sm">{scene.label}</p>
                  <p className="text-xs text-stone-400">{scene.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Season + People (side by side) */}
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-stone-200 p-6">
              <h3 className="font-semibold mb-1">Season</h3>
              <p className="text-sm text-stone-400 mb-4">Match your content to the time of year</p>
              <div className="grid grid-cols-2 gap-2">
                {SEASONS.map((season) => (
                  <button
                    key={season.id}
                    onClick={() => setSelectedSeason(season.id)}
                    className={`p-3 rounded-xl border-2 text-center transition ${
                      selectedSeason === season.id
                        ? "border-brand-500 bg-brand-50"
                        : "border-stone-200 hover:border-stone-300"
                    }`}
                  >
                    
                    <p className="text-sm font-medium mt-1">{season.label}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-stone-200 p-6">
              <h3 className="font-semibold mb-1">Who&apos;s in the photo?</h3>
              <p className="text-sm text-stone-400 mb-4">Target your ideal guest segment</p>
              <div className="grid grid-cols-2 gap-2">
                {PEOPLE.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPeople(p.id)}
                    className={`p-3 rounded-xl border-2 text-center transition ${
                      selectedPeople === p.id
                        ? "border-brand-500 bg-brand-50"
                        : "border-stone-200 hover:border-stone-300"
                    }`}
                  >
                    <p className="text-sm font-medium">{p.label}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Cast Member Picker */}
          {castMembers.length > 0 && (
            <div className="bg-white rounded-xl border border-stone-200 p-6">
              <h3 className="font-semibold mb-1">Choose your guests</h3>
              <p className="text-sm text-stone-400 mb-4">
                Select 1-4 AI models for your photo. Using specific faces produces more realistic results.
                {selectedCast.length > 0 && (
                  <button onClick={() => setSelectedCast([])} className="ml-2 text-brand-600 hover:text-brand-700 font-medium">
                    Clear selection
                  </button>
                )}
              </p>

              {selectedCast.length > 0 && (
                <div className="flex gap-2 mb-4">
                  {selectedCast.map((c) => (
                    <div key={c.id} className="relative">
                      <img
                        src={c.filePath}
                        alt={c.name}
                        className="w-14 h-14 object-cover rounded-full border-2 border-brand-500"
                      />
                      <button
                        onClick={() => setSelectedCast((prev) => prev.filter((p) => p.id !== c.id))}
                        className="absolute -top-1 -right-1 w-5 h-5 bg-stone-800 text-white rounded-full text-xs flex items-center justify-center"
                      >
                        ×
                      </button>
                      <p className="text-xs text-center mt-1 text-stone-500">{c.name}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="max-h-48 overflow-y-auto grid grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2">
                {castMembers
                  .filter((c) => !selectedCast.find((s) => s.id === c.id))
                  .slice(0, 60)
                  .map((c) => (
                    <button
                      key={c.id}
                      onClick={() => {
                        if (selectedCast.length < 4) {
                          setSelectedCast((prev) => [...prev, c]);
                        }
                      }}
                      disabled={selectedCast.length >= 4}
                      className="group relative aspect-square rounded-lg overflow-hidden border border-stone-200 hover:border-brand-400 transition disabled:opacity-30"
                    >
                      <img src={c.filePath} alt={c.name} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition" />
                      <span className="absolute bottom-0.5 left-0.5 right-0.5 text-[9px] text-white bg-black/50 rounded px-0.5 truncate opacity-0 group-hover:opacity-100 transition">
                        {c.name}
                      </span>
                    </button>
                  ))}
              </div>
              <p className="text-xs text-stone-400 mt-2">
                {selectedCast.length}/4 selected · {castMembers.length} models available
              </p>
            </div>
          )}

          {/* Aspect Ratio */}
          <div className="bg-white rounded-xl border border-stone-200 p-6">
            <h3 className="font-semibold mb-1">Where will you use this?</h3>
            <p className="text-sm text-stone-400 mb-4">We&apos;ll size it perfectly for the platform</p>
            <div className="flex gap-3">
              {ASPECTS.map((aspect) => (
                <button
                  key={aspect.id}
                  onClick={() => setSelectedAspect(aspect.id)}
                  className={`flex-1 p-4 rounded-xl border-2 text-center transition ${
                    selectedAspect === aspect.id
                      ? "border-brand-500 bg-brand-50"
                      : "border-stone-200 hover:border-stone-300"
                  }`}
                >
                  
                  <p className="text-sm font-medium mt-1">{aspect.label}</p>
                  <p className="text-xs text-stone-400">{aspect.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            className="w-full py-4 bg-brand-600 hover:bg-brand-500 text-white font-semibold rounded-xl transition text-lg"
          >
            Generate lifestyle photo
          </button>
        </div>
      )}

      {/* Step 2: Generating */}
      {step === "generating" && (
        <div className="bg-white rounded-xl border border-stone-200 p-12 text-center">
          <div className="max-w-md mx-auto">
            <div className="text-4xl mb-4">📸</div>
            <h3 className="text-xl font-semibold mb-2">Creating your lifestyle photo...</h3>
            <p className="text-stone-500 mb-6">
              Our AI is placing {selectedPeople === "solo" ? "a guest" : selectedPeople === "couple" ? "a couple" : selectedPeople === "family" ? "a family" : "friends"} in your property with a {SCENES.find((s) => s.id === selectedScene)?.label.toLowerCase()} vibe
            </p>
            <div className="w-full bg-stone-100 rounded-full h-3 mb-2">
              <div
                className="h-3 bg-brand-600 rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-sm text-stone-400">Usually takes 15-30 seconds</p>
          </div>
        </div>
      )}

      {/* Step 3: Results */}
      {step === "results" && generatedImage && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
            <div className="relative">
              <img
                src={generatedImage.imageUrl}
                alt="AI lifestyle photo"
                className="w-full max-h-[600px] object-contain bg-stone-50"
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
                  className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-500 transition"
                >
                  Download
                </a>
                <button
                  onClick={() => { setStep("configure"); setGeneratedImage(null); }}
                  className="px-4 py-2 bg-stone-900 text-white rounded-lg text-sm font-medium hover:bg-stone-800 transition"
                >
                  Generate another
                </button>
                <button
                  onClick={() => setStep("configure")}
                  className="px-4 py-2 border border-stone-200 rounded-lg text-sm font-medium text-stone-600 hover:bg-stone-50 transition"
                >
                  Adjust settings
                </button>
              </div>

              {/* Auto-generated caption */}
              {generatedImage.caption && (
                <div className="border-t border-stone-100 pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium text-stone-500">Ready-to-post caption</h4>
                    <button
                      onClick={() => handleCopyCaption(generatedImage.caption + "\n\n" + generatedImage.hashtags)}
                      className="text-xs text-brand-600 font-medium hover:text-brand-700"
                    >
                      Copy caption + hashtags
                    </button>
                  </div>
                  <div className="bg-stone-50 rounded-lg p-4">
                    <p className="text-sm text-stone-700 whitespace-pre-wrap">{generatedImage.caption}</p>
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
