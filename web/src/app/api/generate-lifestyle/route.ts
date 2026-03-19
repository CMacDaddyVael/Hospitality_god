import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export const maxDuration = 60;

const REALISM_PROTOCOL = `PHOTOGRAPHIC REALISM PROTOCOL (CRITICAL — THIS IS THE #1 PRIORITY):

CAMERA & LENS SIMULATION (must be present in the final image):
- Shot on a Canon EOS R5 or Sony A7IV with an 85mm f/1.4 prime lens at f/2.0–f/2.8.
- SHALLOW DEPTH OF FIELD: The subject is tack-sharp. The background falls off into natural bokeh — creamy, circular bokeh highlights from specular sources (sunlight through leaves, distant lights, reflections). The transition from sharp to soft must be gradual and optically correct, not a uniform gaussian blur.
- NATURAL LENS CHARACTERISTICS: Subtle vignetting darkening the corners by 10-15%. Faint chromatic aberration (purple/green fringing) on high-contrast edges in the bokeh zone. Micro lens flare from strong light sources — not dramatic, just a faint warm wash.
- FILM-LIKE TONALITY: Slight lifted blacks (shadows never go pure black — they have a faint warm or cool tone). Highlight rolloff should be smooth, not clipped. Gentle grain structure visible at 100% zoom — organic, not digital noise.

LIGHTING (must feel like real sun/ambient, not studio):
- ONE dominant light source with a clear direction — sun, window, sky. Shadows must be consistent with a single source.
- REALISTIC SHADOW BEHAVIOR: Shadows are softer on overcast days, harder on sunny days. Shadows have color (warm fill from reflected surfaces, cool from open sky).
- GOLDEN HOUR: If the environment suggests late afternoon, the light must be warm (3200-4000K), low-angle, with long shadows and warm rim light on hair/shoulders.
- AMBIENT OCCLUSION: Subtle darkening where people meet furniture/ground, under chin.

PEOPLE REALISM:
- Slight asymmetry in pose, natural movement, one or two flyaway hairs, relaxed not rigid posture.
- Skin must have visible texture: pores, subtle imperfections, natural sheen. NO plastic/waxy/airbrushed skin.
- Hands must have correct anatomy: exactly 5 fingers per hand, natural finger spacing. If hands are difficult, keep them relaxed or partially obscured.
- Eyes must be sharp with natural catchlights that match the environment's light sources.
- Hair should have individual strand detail, natural flyaways, realistic highlights.
- Clothing must show real physics: gravity, tension at seams, natural wrinkles at joints.

ENVIRONMENT REALISM (CRITICAL — this is where AI images fail most):
- The environment MUST match the reference property image exactly — same furniture, architecture, decor, finishes, views.
- The environment must have DEPTH LAYERS: foreground elements (slightly out of focus), midground (people, sharp), background (bokeh, atmospheric perspective).
- ENVIRONMENTAL DETAILS: Real locations have imperfections — scuff marks, slight wear, lived-in details. Include these. Do NOT make the environment too pristine or CGI-perfect.
- LIGHT INTERACTION WITH ENVIRONMENT: Surfaces should reflect and absorb light naturally. Wood is warm, stone is cool, glass has specular highlights, water is reflective.
- NO TELLTALE AI ARTIFACTS: No warped architecture, no impossible geometry, no repeating patterns, no surreal color gradients, no plastic-looking surfaces, no uniformly sharp backgrounds.

The final image must be INDISTINGUISHABLE from a photograph shot by a professional lifestyle photographer on location with a full-frame mirrorless camera.
AVOID: extra limbs, merged fingers, floating objects, warped edges, uncanny symmetry, stiffness, stock-photo feel, HDR-tonemapped look, oversaturation, uniform sharpness across the entire image.`;

const SEASONS: Record<string, string> = {
  spring: "Bright natural light, fresh flowers in vases, windows open with green trees visible outside, light airy fabrics, morning coffee scene",
  summer: "Golden warm light, iced drinks, pool/patio in use, summer fruits, relaxed vacation energy, sunset tones",
  fall: "Warm amber light, cozy blankets, hot drinks, autumn foliage visible through windows, candles lit, harvest decorations",
  winter: "Warm cozy interior lighting, fireplace glow, hot cocoa, blankets, snow visible outside, holiday touches, hygge atmosphere",
};

const SCENE_TYPES = [
  {
    id: "morning-coffee",
    prompt: "A guest enjoying morning coffee on the deck/patio, looking out at the view, golden morning light, relaxed and peaceful, wearing casual loungewear",
  },
  {
    id: "couple-dinner",
    prompt: "A couple preparing dinner together in the kitchen, laughing, wine glasses on the counter, warm evening light, candlelit atmosphere",
  },
  {
    id: "friends-gathering",
    prompt: "A small group of friends (3-4 people) relaxing in the living room, conversation, drinks in hand, natural candid moment, warm ambient lighting",
  },
  {
    id: "solo-reading",
    prompt: "A solo guest reading a book in a cozy corner, wrapped in a blanket, natural window light, peaceful and serene, cup of tea nearby",
  },
  {
    id: "family-fun",
    prompt: "A family with kids enjoying the outdoor space, playing games, BBQ or picnic setup, bright daylight, genuine joy and laughter",
  },
];

export async function POST(req: NextRequest) {
  try {
    const { propertyImageUrl, season, sceneType, propertyDescription } = await req.json();

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

    const selectedSeason = SEASONS[season || "summer"] || SEASONS.summer;
    const selectedScene = SCENE_TYPES.find((s) => s.id === sceneType) || SCENE_TYPES[0];

    const prompt = `TASK: Generate a photorealistic LIFESTYLE photograph showing real people enjoying this SHORT-TERM RENTAL property.

PROPERTY IDENTITY LOCK (HIGHEST PRIORITY): The provided image is the ACTUAL PROPERTY. The generated image MUST use this EXACT space as the environment:
- SAME furniture, countertops, fixtures, and decor
- SAME architectural details (windows, trim, ceiling, walls)
- SAME flooring, lighting fixtures, and finishes
- SAME view through windows if visible
- Do NOT create a generic or different space — recreate THIS SPECIFIC ROOM with people added naturally into it

SCENE: ${selectedScene.prompt}

SEASONAL MOOD: ${selectedSeason}

${propertyDescription ? `PROPERTY CONTEXT: ${propertyDescription}` : ""}

${REALISM_PROTOCOL}

STRICT NO-TEXT POLICY: ZERO text, typography, letters, numbers, watermarks, or logos in the image.

COMPOSITION:
- Aspect ratio: 4:5 (Instagram portrait)
- The people should occupy roughly 40-60% of the frame
- Include enough of the property environment to make it recognizable
- Natural, editorial lifestyle magazine composition
- The scene must feel ASPIRATIONAL — this is marketing content that makes someone want to book this exact property
- People must look natural, diverse, and genuinely happy — caught in a real moment, not posing

OUTPUT: One single photorealistic lifestyle photograph indistinguishable from a professional property photoshoot.`;

    const IMAGE_MODEL = "gemini-3.1-flash-image-preview";

    const result = await ai.models.generateContent({
      model: IMAGE_MODEL,
      contents: {
        parts: [
          { inlineData: { data: imgBase64, mimeType: imgMimeType } },
          { text: prompt },
        ],
      },
      config: {
        responseModalities: ["IMAGE", "TEXT"],
        temperature: 0.4,
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
      scene: selectedScene.id,
      season: season || "summer",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Lifestyle generation error:", message);
    return NextResponse.json({ error: `Generation failed: ${message}` }, { status: 500 });
  }
}
