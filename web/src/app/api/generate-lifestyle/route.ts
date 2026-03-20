import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export const maxDuration = 60;

// ── Protocols — ported exactly from VAEL Spaces geminiService.ts ──

const REALISM_DNA = `
  PHOTOGRAPHIC REALISM PROTOCOL:
  Add subtle photographic realism: slight asymmetry in pose,
  natural fabric movement, one or two flyaway hairs,
  relaxed rather than tensed posture. The subject should
  look like a beautiful real person photographed candidly,
  not a retouched advertisement. Avoid plastic skin,
  symmetrical perfection, or mannequin stillness.
`;

const TALENT_PROTOCOL = `
  STRICT TALENT & OUTFIT PROTOCOL:
  1. MODEL ISOLATION: Extract ONLY the human subject from the talent references. Ignore and discard all backgrounds, text, and logos present in the reference images.
  2. NO TEXT INJECTION: Do not render any text, typography, or watermarks from the source images into the final generation.
  3. OUTFIT INTEGRITY: Dress the talent in natural, casual clothing appropriate to the scene and season. The reference images are headshots — generate full body and outfit.
  4. NATURAL STYLING: Clothing should look lived-in and real, not catalog-perfect.
`;

const SPATIAL_ANCHOR_PROTOCOL = `
  STRICT SPATIAL ANCHOR PROTOCOL (THE HOLY GRAIL):
  The provided anchor image is the ABSOLUTE SOURCE OF TRUTH for the environment.
  NEVER generate images outside of the scope of the original reference SPACE ANCHOR.
  1. NO ARCHITECTURAL DRIFT: Do not add new windows, doors, walls, or structural beams.
  2. FURNITURE LOCK: Maintain the exact furniture models, positions, and finishes shown. Do NOT move, add, duplicate, or remove any furniture or objects.
  3. MATERIAL FIDELITY: Textures (marble, wood, linen) must match the anchor photo exactly.
  4. SPATIAL BOUNDS: Stay strictly within the visible scene of the anchor. DO NOT hallucinate or image parts of the room that aren't there.
  5. ONLY ADD PEOPLE: You may add people and small handheld items (cup, book, glass). You may NOT add furniture, rugs, plants, fire pits, or any objects not in the reference.
  Consistency with the original photo is the highest priority.
`;

const FIDELITY_HIERARCHY = `
  STRICT ARCHITECTURAL PRESERVATION HIERARCHY (VAEL SPACES PROTOCOL):
  1. ROOM FIDELITY: Maintain the EXACT architecture, layout, windows, and flooring of the source property photo. NO DRIFT. NEVER hallucinate outside the original SPACE ANCHOR.
  2. MODEL ACCURACY: High-fidelity rendering of the talent's face, skin texture, and features.
  3. EDITORIAL AESTHETIC: It should NEVER look like a stock image. Maintain a high-end editorial/lifestyle element. Use sophisticated lighting and deliberate composition.
  4. NO COLLAGES: Output exactly ONE (1) single, coherent, full-frame photograph.
`;

const STYLE_MAPPINGS: Record<string, string> = {
  spring: "Minimalist morning daylight, cool muted tones, serene property atmosphere, architectural clarity.",
  summer: "Warm, sunset lighting. Cinematic shadows, sun-drenched architectural lines, inspired by high-end hospitality photography.",
  fall: "Intimate, candlelit or soft interior lighting. Moody hospitality shadows, nostalgic luxury textures.",
  winter: "Intimate, candlelit or soft interior lighting. Moody hospitality shadows, nostalgic luxury textures. Warm cozy atmosphere.",
};

const SCENE_TYPES: Record<string, string> = {
  "morning-coffee": "enjoying morning coffee, candid and relaxed",
  "couple-dinner": "cooking or sharing a meal together, laughing naturally",
  "friends-gathering": "relaxing together, drinks in hand, caught mid-conversation",
  "solo-reading": "reading a book, completely absorbed, peaceful",
  "family-fun": "enjoying quality time together, genuine joy",
  "outdoor-lounge": "enjoying the outdoor space, relaxed conversation",
};

export async function POST(req: NextRequest) {
  try {
    const { propertyImageUrl, season, sceneType, propertyDescription, talentImageUrls } = await req.json();

    if (!propertyImageUrl) {
      return NextResponse.json({ error: "propertyImageUrl is required" }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "GEMINI_API_KEY not configured" }, { status: 500 });
    }

    const ai = new GoogleGenAI({ apiKey });

    // Fetch the property image
    const imgRes = await fetch(propertyImageUrl);
    if (!imgRes.ok) throw new Error("Failed to fetch property image");
    const imgBuffer = await imgRes.arrayBuffer();
    const imgBase64 = Buffer.from(imgBuffer).toString("base64");
    const imgMimeType = imgRes.headers.get("content-type") || "image/jpeg";

    // Fetch talent/cast reference images if provided
    const talentParts: { inlineData: { data: string; mimeType: string } }[] = [];
    if (talentImageUrls && Array.isArray(talentImageUrls)) {
      for (const talentUrl of talentImageUrls.slice(0, 4)) {
        try {
          const tRes = await fetch(talentUrl);
          if (tRes.ok) {
            const tBuffer = await tRes.arrayBuffer();
            talentParts.push({
              inlineData: {
                data: Buffer.from(tBuffer).toString("base64"),
                mimeType: tRes.headers.get("content-type") || "image/png",
              },
            });
          }
        } catch {
          console.warn("Failed to fetch talent image:", talentUrl);
        }
      }
    }

    const selectedSeason = season || "summer";
    const moodStyle = STYLE_MAPPINGS[selectedSeason] || STYLE_MAPPINGS.summer;
    const sceneAction = SCENE_TYPES[sceneType || "morning-coffee"] || SCENE_TYPES["morning-coffee"];

    // Build master brief — matching VAEL Spaces structure exactly
    const masterBrief = `
      ${FIDELITY_HIERARCHY}
      ${SPATIAL_ANCHOR_PROTOCOL}
      TECHNICAL CAMERA DNA: f/1.4, wide-angle clarity, hospitality grain. Natural available light only.
      TASK: High-end hospitality lifestyle photograph for ${propertyDescription || "a vacation rental property"}.
      PRESERVE ARCHITECTURE: Every pixel of structural detail must align with the provided space anchor. DO NOT EXPAND THE ROOM. DO NOT MOVE OR ADD FURNITURE.
      CASTING: Vacation rental guests ${sceneAction}. People interact ONLY with objects already visible in the space anchor.
      ${talentParts.length > 0 ? TALENT_PROTOCOL : ""}
      ${REALISM_DNA}
      ATMOSPHERE: ${moodStyle}
      CONTENT SAFETY: Family-friendly only. No intimate, romantic, or suggestive content. Fully clothed casual attire.
      ONE PHOTO ONLY. NO COLLAGES.
    `;

    // Build content parts: space anchor + talent references + prompt
    const contentParts: ({ inlineData: { data: string; mimeType: string } } | { text: string })[] = [
      { inlineData: { data: imgBase64, mimeType: imgMimeType } },
      ...talentParts,
      { text: masterBrief },
    ];

    const result = await ai.models.generateContent({
      model: "gemini-3-pro-image-preview",
      contents: { parts: contentParts },
      config: {
        imageConfig: {
          aspectRatio: "3:4" as "1:1",
          imageSize: "2K" as "1024x1024",
        },
      },
    });

    const imagePart = result.candidates?.[0]?.content?.parts?.find(
      (p: { inlineData?: { data: string; mimeType: string } }) => p.inlineData
    );

    if (!imagePart?.inlineData) {
      return NextResponse.json({ error: "No image generated — try again" }, { status: 500 });
    }

    const imageUrl = `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;

    return NextResponse.json({
      imageUrl,
      scene: sceneType || "morning-coffee",
      season: selectedSeason,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Lifestyle generation error:", message);
    return NextResponse.json({ error: `Generation failed: ${message}` }, { status: 500 });
  }
}
