"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { UserPreferences } from "@/lib/types";

type Step = "welcome" | "voice" | "done";

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("welcome");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [prefs, setPrefs] = useState({
    tone: "casual" as "formal" | "casual",
    response_length: "balanced" as "brief" | "balanced" | "detailed",
    phrases_to_avoid: "",
    property_name: "",
    owner_name: "",
  });

  const supabase = createClient();

  useEffect(() => {
    // Load existing preferences if present
    async function loadPrefs() {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("user_preferences")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (data) {
        setPrefs({
          tone: data.tone,
          response_length: data.response_length,
          phrases_to_avoid: data.phrases_to_avoid || "",
          property_name: data.property_name || "",
          owner_name: data.owner_name || "",
        });
      }
      setLoading(false);
    }
    loadPrefs();
  }, []);

  async function handleSave() {
    setSaving(true);
    setError(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // For demo: use a mock user_id if not authenticated
      const userId = user?.id ?? "demo-user-00000000-0000-0000-0000-000000000000";

      const payload = {
        user_id: userId,
        ...prefs,
        updated_at: new Date().toISOString(),
      };

      const { error: upsertError } = await supabase
        .from("user_preferences")
        .upsert(payload, { onConflict: "user_id" });

      if (upsertError) throw upsertError;

      setStep("done");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save preferences";
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="max-w-xl w-full">
        {/* Progress */}
        <div className="flex items-center gap-2 mb-8">
          <div className="text-sm text-gray-500">
            {step === "welcome" && "Step 1 of 2"}
            {step === "voice" && "Step 2 of 2"}
            {step === "done" && "Complete ✓"}
          </div>
          <div className="flex-1 h-1 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-purple-600 transition-all duration-500"
              style={{
                width:
                  step === "welcome"
                    ? "25%"
                    : step === "voice"
                    ? "75%"
                    : "100%",
              }}
            />
          </div>
        </div>

        {/* Welcome Step */}
        {step === "welcome" && (
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-white">
                Let's set up your voice 🎙️
              </h1>
              <p className="text-gray-400 mt-2">
                Tell us a bit about your property and communication style. We'll
                use this to write reviews responses that sound exactly like you.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Your name
                </label>
                <input
                  type="text"
                  value={prefs.owner_name}
                  onChange={(e) =>
                    setPrefs((p) => ({ ...p, owner_name: e.target.value }))
                  }
                  placeholder="e.g. Sarah"
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Property name
                </label>
                <input
                  type="text"
                  value={prefs.property_name}
                  onChange={(e) =>
                    setPrefs((p) => ({ ...p, property_name: e.target.value }))
                  }
                  placeholder="e.g. The Blue Door Cottage"
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
                />
              </div>
            </div>

            <button
              onClick={() => setStep("voice")}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 rounded-lg transition-colors"
            >
              Continue →
            </button>
          </div>
        )}

        {/* Voice Calibration Step */}
        {step === "voice" && (
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-white">
                How do you communicate? 💬
              </h1>
              <p className="text-gray-400 mt-2">
                Three quick questions so your AI responses sound like you, not a
                robot.
              </p>
            </div>

            {/* Question 1: Tone */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">
                1. What's your natural tone with guests?
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setPrefs((p) => ({ ...p, tone: "casual" }))}
                  className={`p-4 rounded-lg border-2 text-left transition-all ${
                    prefs.tone === "casual"
                      ? "border-purple-500 bg-purple-500/10 text-white"
                      : "border-gray-700 bg-gray-900 text-gray-400 hover:border-gray-600"
                  }`}
                >
                  <div className="text-lg mb-1">😊</div>
                  <div className="font-medium">Casual & Warm</div>
                  <div className="text-xs mt-1 opacity-70">
                    "Hey! So glad you stayed..."
                  </div>
                </button>
                <button
                  onClick={() => setPrefs((p) => ({ ...p, tone: "formal" }))}
                  className={`p-4 rounded-lg border-2 text-left transition-all ${
                    prefs.tone === "formal"
                      ? "border-purple-500 bg-purple-500/10 text-white"
                      : "border-gray-700 bg-gray-900 text-gray-400 hover:border-gray-600"
                  }`}
                >
                  <div className="text-lg mb-1">🤝</div>
                  <div className="font-medium">Professional</div>
                  <div className="text-xs mt-1 opacity-70">
                    "Thank you for your stay..."
                  </div>
                </button>
              </div>
            </div>

            {/* Question 2: Length */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">
                2. How long should responses be?
              </label>
              <div className="grid grid-cols-3 gap-3">
                {(
                  [
                    {
                      value: "brief",
                      label: "Brief",
                      desc: "2-3 sentences",
                      emoji: "⚡",
                    },
                    {
                      value: "balanced",
                      label: "Balanced",
                      desc: "3-5 sentences",
                      emoji: "✅",
                    },
                    {
                      value: "detailed",
                      label: "Detailed",
                      desc: "5-7 sentences",
                      emoji: "📝",
                    },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() =>
                      setPrefs((p) => ({ ...p, response_length: opt.value }))
                    }
                    className={`p-4 rounded-lg border-2 text-left transition-all ${
                      prefs.response_length === opt.value
                        ? "border-purple-500 bg-purple-500/10 text-white"
                        : "border-gray-700 bg-gray-900 text-gray-400 hover:border-gray-600"
                    }`}
                  >
                    <div className="text-lg mb-1">{opt.emoji}</div>
                    <div className="font-medium text-sm">{opt.label}</div>
                    <div className="text-xs mt-1 opacity-70">{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Question 3: Phrases to avoid */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                3. Any phrases or words to avoid?{" "}
                <span className="text-gray-500">(optional)</span>
              </label>
              <textarea
                value={prefs.phrases_to_avoid}
                onChange={(e) =>
                  setPrefs((p) => ({ ...p, phrases_to_avoid: e.target.value }))
                }
                placeholder='e.g. "I apologize", "utilize", "fantastic", corporate-sounding phrases...'
                rows={3}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors resize-none"
              />
            </div>

            {error && (
              <div className="p-3 bg-red-900/30 border border-red-700 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setStep("welcome")}
                className="px-6 py-3 border border-gray-700 hover:border-gray-600 text-gray-300 rounded-lg transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-colors"
              >
                {saving ? "Saving..." : "Save My Voice →"}
              </button>
            </div>
          </div>
        )}

        {/* Done Step */}
        {step === "done" && (
          <div className="text-center space-y-6">
            <div className="text-6xl">🎉</div>
            <div>
              <h1 className="text-3xl font-bold text-white">
                You're all set, {prefs.owner_name || "there"}!
              </h1>
              <p className="text-gray-400 mt-2">
                Your voice is calibrated. The AI will now write responses that
                sound like you.
              </p>
            </div>

            <div className="p-4 bg-gray-900 border border-gray-800 rounded-xl text-left space-y-2">
              <div className="text-sm font-medium text-gray-400">
                Your settings:
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-500">Tone:</span>
                <span className="text-white capitalize">{prefs.tone}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-500">Length:</span>
                <span className="text-white capitalize">
                  {prefs.response_length}
                </span>
              </div>
              {prefs.phrases_to_avoid && (
                <div className="flex items-start gap-2 text-sm">
                  <span className="text-gray-500">Avoid:</span>
                  <span className="text-white">{prefs.phrases_to_avoid}</span>
                </div>
              )}
            </div>

            <button
              onClick={() => router.push("/app/reviews")}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 rounded-lg transition-colors"
            >
              Go to Review Manager →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
