/**
 * Social Content Generator
 * Generates Instagram captions and TikTok scripts using Claude,
 * selects best photos using Gemini Vision, schedules via Meta Graph API.
 */
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

// Rotating content themes
const CONTENT_THEMES = [
  "property_feature", // Highlight a specific room/amenity
  "seasonal_hook",    // Tie to season/upcoming holiday
  "local_area",       // Spotlight the neighborhood/destination
];

/**
 * Build a content brief from property details
 */
export function buildContentBrief(property) {
  const {
    name,
    description,
    location,
    amenities = [],
    photos = [],
    propertyType = "vacation rental",
    bedrooms,
    bathrooms,
    maxGuests,
  } = property;

  return {
    propertyName: name,
    propertyType,
    location,
    description,
    amenities,
    photos,
    bedrooms,
    bathrooms,
    maxGuests,
    season: getCurrentSeason(),
    upcomingHolidays: getUpcomingHolidays(),
  };
}

/**
 * Rank photos using Gemini Vision API
 * Returns photos sorted by aesthetic quality score
 */
export async function rankPhotosWithGemini(photos) {
  if (!photos || photos.length === 0) return [];

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("GEMINI_API_KEY not set — skipping photo ranking, using original order");
    return photos.map((p, i) => ({ ...p, score: photos.length - i, rank: i + 1 }));
  }

  const scored = [];

  for (const photo of photos) {
    try {
      const imageData = await fetchImageAsBase64(photo.url);
      if (!imageData) {
        scored.push({ ...photo, score: 0, rank: 999 });
        continue;
      }

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    inlineData: {
                      mimeType: imageData.mimeType,
                      data: imageData.base64,
                    },
                  },
                  {
                    text: `You are an expert hospitality photographer and Instagram content strategist.
                    
Analyze this vacation rental/hotel property photo and rate it on a scale of 1-100 for Instagram suitability.

Score based on:
- Lighting quality (natural light scores higher)
- Composition and framing
- Visual appeal and "wow factor"
- Lifestyle aspiration (does it make someone want to stay there?)
- Subject clarity (what room/feature is shown)
- Instagram engagement potential

Also identify:
- Primary subject (bedroom, kitchen, living room, pool, view, exterior, bathroom, dining, amenity)
- Mood (cozy, luxurious, adventurous, romantic, family-friendly, modern, rustic)

Respond in this exact JSON format:
{
  "score": <number 1-100>,
  "subject": "<primary subject>",
  "mood": "<mood>",
  "reasoning": "<1 sentence why>"
}`,
                  },
                ],
              },
            ],
          }),
        }
      );

      if (!response.ok) {
        console.warn(`Gemini API error for photo ${photo.id}: ${response.status}`);
        scored.push({ ...photo, score: 50, rank: 999 });
        continue;
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

      // Parse JSON from response (handle markdown code blocks)
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

      scored.push({
        ...photo,
        score: parsed.score || 50,
        subject: parsed.subject || "property",
        mood: parsed.mood || "inviting",
        geminiReasoning: parsed.reasoning || "",
        rank: 999,
      });
    } catch (err) {
      console.warn(`Error ranking photo ${photo.id}:`, err.message);
      scored.push({ ...photo, score: 50, rank: 999 });
    }
  }

  // Sort by score descending and assign ranks
  scored.sort((a, b) => b.score - a.score);
  scored.forEach((p, i) => (p.rank = i + 1));

  return scored;
}

/**
 * Generate Instagram caption using Claude
 */
export async function generateInstagramCaption(brief, photo, theme, postIndex) {
  const themeInstructions = {
    property_feature: `Focus on a specific feature or amenity of the property. 
      Make it vivid and sensory. What makes this space special?
      The selected photo shows: ${photo.subject || "the property"} with a ${photo.mood || "inviting"} mood.`,

    seasonal_hook: `Connect the property to the current season (${brief.season}) or an upcoming occasion.
      Make guests imagine being here right now, in this season.
      The selected photo shows: ${photo.subject || "the property"}.`,

    local_area: `Highlight the destination/neighborhood around the property.
      What's special about ${brief.location}? What can guests explore nearby?
      The property photo shows: ${photo.subject || "the property"}.`,
  };

  const prompt = `You are an expert hospitality social media copywriter specializing in Instagram content for vacation rentals and boutique hotels.

## Property Details
- Name: ${brief.propertyName}
- Type: ${brief.propertyType}
- Location: ${brief.location}
- Description: ${brief.description}
- Bedrooms: ${brief.bedrooms || "N/A"}, Bathrooms: ${brief.bathrooms || "N/A"}, Sleeps: ${brief.maxGuests || "N/A"}
- Key Amenities: ${brief.amenities.slice(0, 10).join(", ")}
- Current Season: ${brief.season}
- Upcoming Holidays: ${brief.upcomingHolidays.join(", ") || "None imminent"}

## Content Theme for This Post
${themeInstructions[theme]}

## Instructions
Write an Instagram caption that:
1. Starts with a hook line that stops the scroll (no generic openers like "Welcome to...")
2. Tells a story or paints a picture in 2-3 short sentences
3. Ends with a soft call-to-action (link in bio, DM us, tag someone you'd bring here)
4. Includes 5-8 relevant hashtags (mix of broad travel + niche property-specific)
5. Uses line breaks for readability
6. Feels authentic and lifestyle-oriented, NOT like an advertisement
7. Is 150-220 words total (caption + hashtags)

Respond with ONLY the caption text — no preamble, no "Here's your caption:", just the caption itself.`;

  const response = await client.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 600,
    messages: [{ role: "user", content: prompt }],
  });

  return response.content[0].text.trim();
}

/**
 * Generate TikTok script using Claude
 */
export async function generateTikTokScript(brief, photo, theme) {
  const themeInstructions = {
    property_feature: `Showcase a specific wow-worthy feature of the property. Think "POV: you wake up to this view" style.`,
    seasonal_hook: `Tie the property to ${brief.season} vibes or seasonal travel desires.`,
    local_area: `"Best kept secret in ${brief.location}" angle — reveal what makes this destination special.`,
  };

  const prompt = `You are an expert TikTok content strategist for travel and hospitality brands.

## Property Details
- Name: ${brief.propertyName}
- Type: ${brief.propertyType}  
- Location: ${brief.location}
- Description: ${brief.description}
- Key Amenities: ${brief.amenities.slice(0, 8).join(", ")}
- Photo Subject: ${photo.subject || "the property"}, Mood: ${photo.mood || "inviting"}

## Content Angle
${themeInstructions[theme]}

## Instructions
Write a 30-45 second TikTok video script that includes:

1. **Hook (0-3 seconds)**: Text overlay + spoken hook that demands attention
   - Use trending TikTok hooks: "POV:", "Tell me why...", "This is your sign to...", "Nobody talks about..."
   
2. **Build (3-20 seconds)**: 3-4 visual cuts with:
   - What the camera shows (specific shot description)
   - On-screen text overlay
   - Voiceover/narration (conversational, energetic)

3. **Reveal/Payoff (20-35 seconds)**: The money shot
   - Best feature reveal
   - Emotional peak moment

4. **CTA (35-45 seconds)**: 
   - "Save this for your next trip"
   - "Drop a 🏠 if you want to book"
   - Link in bio

5. **Suggested Audio**: Trending audio style (e.g., "upbeat acoustic", "viral trending sound", "lo-fi chill")

6. **Hashtags**: 5 TikTok-specific hashtags

Format as a proper script with clear sections. Keep it punchy and native to TikTok's style.`;

  const response = await client.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 800,
    messages: [{ role: "user", content: prompt }],
  });

  return response.content[0].text.trim();
}

/**
 * Generate a complete set of 3 posts for a property
 * This is the main pipeline function
 */
export async function generatePostSet(property, startingThemeIndex = 0) {
  console.log(`Generating post set for: ${property.name}`);

  const brief = buildContentBrief(property);
  const rankedPhotos = await rankPhotosWithGemini(brief.photos);

  const posts = [];

  for (let i = 0; i < 3; i++) {
    const themeIndex = (startingThemeIndex + i) % CONTENT_THEMES.length;
    const theme = CONTENT_THEMES[themeIndex];

    // Pick best available photo (avoid reusing if possible)
    const usedPhotoIds = posts.map((p) => p.photoId);
    const photo =
      rankedPhotos.find((p) => !usedPhotoIds.includes(p.id)) ||
      rankedPhotos[0] ||
      { id: null, url: null, subject: "the property", mood: "inviting" };

    console.log(`  Post ${i + 1}: theme=${theme}, photo rank=${photo.rank || 1}`);

    const [instagramCaption, tiktokScript] = await Promise.all([
      generateInstagramCaption(brief, photo, theme, i),
      generateTikTokScript(brief, photo, theme),
    ]);

    const scheduledAt = getNextPostTime(i);

    posts.push({
      propertyId: property.id,
      theme,
      photoId: photo.id,
      photoUrl: photo.url,
      photoScore: photo.score,
      photoSubject: photo.subject,
      instagramCaption,
      tiktokScript,
      scheduledAt,
      status: "pending_approval",
      createdAt: new Date().toISOString(),
    });
  }

  return posts;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getCurrentSeason() {
  const month = new Date().getMonth() + 1;
  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  if (month >= 9 && month <= 11) return "fall";
  return "winter";
}

function getUpcomingHolidays() {
  const now = new Date();
  const month = now.getMonth() + 1;
  const day = now.getDate();

  const holidays = [];

  // Check next 30 days for major holidays
  const upcoming = [
    { month: 2, day: 14, name: "Valentine's Day" },
    { month: 3, day: 17, name: "St. Patrick's Day" },
    { month: 5, day: 26, name: "Memorial Day Weekend" },
    { month: 7, day: 4, name: "Fourth of July" },
    { month: 9, day: 1, name: "Labor Day Weekend" },
    { month: 10, day: 31, name: "Halloween" },
    { month: 11, day: 27, name: "Thanksgiving" },
    { month: 12, day: 25, name: "Christmas" },
    { month: 12, day: 31, name: "New Year's Eve" },
  ];

  for (const h of upcoming) {
    const holidayDate = new Date(now.getFullYear(), h.month - 1, h.day);
    const daysUntil = Math.ceil((holidayDate - now) / (1000 * 60 * 60 * 24));
    if (daysUntil >= 0 && daysUntil <= 30) {
      holidays.push(h.name);
    }
  }

  return holidays;
}

/**
 * Calculate next post time: Tue/Thu/Sat at 10am local
 * For now uses UTC — production should use property timezone
 */
export function getNextPostTime(offsetPosts = 0) {
  const targetDays = [2, 4, 6]; // Tue=2, Thu=4, Sat=6
  const now = new Date();
  const results = [];

  // Find the next 3 post slots from now
  for (let daysAhead = 0; daysAhead <= 21; daysAhead++) {
    const candidate = new Date(now);
    candidate.setDate(now.getDate() + daysAhead);
    candidate.setHours(10, 0, 0, 0);

    if (
      targetDays.includes(candidate.getDay()) &&
      candidate > now
    ) {
      results.push(candidate.toISOString());
      if (results.length >= 3) break;
    }
  }

  return results[offsetPosts] || results[results.length - 1] || new Date(Date.now() + 86400000).toISOString();
}

async function fetchImageAsBase64(url) {
  if (!url) return null;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;

    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    const contentType = response.headers.get("content-type") || "image/jpeg";

    return { base64, mimeType: contentType };
  } catch (err) {
    console.warn(`Failed to fetch image: ${url}`, err.message);
    return null;
  }
}
