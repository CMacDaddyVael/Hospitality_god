/**
 * Seasonal Content Generation Prompt
 * Generates refreshed listing copy, social captions, and image briefs
 * for upcoming seasons and holidays.
 */

/**
 * @param {Object} params
 * @param {string} params.propertyTitle - Listing title
 * @param {string} params.propertyDescription - Current listing description
 * @param {string} params.location - Property location (city, state/region)
 * @param {string} params.propertyType - e.g. "cabin", "beach house", "condo"
 * @param {string[]} params.amenities - List of amenities
 * @param {string} params.season - Current/upcoming season name (e.g. "Winter", "Summer")
 * @param {string} params.holiday - Upcoming holiday if applicable (e.g. "Christmas", "Fourth of July")
 * @param {string} params.seasonalTheme - Theme descriptor (e.g. "winter cozy", "summer pool vibes")
 * @param {string} params.targetMonth - The month this content is for (e.g. "December 2025")
 * @param {string} [params.ownerTone] - Owner voice tone preference
 * @returns {string} Prompt string
 */
export function buildSeasonalContentPrompt({
  propertyTitle,
  propertyDescription,
  location,
  propertyType,
  amenities,
  season,
  holiday,
  seasonalTheme,
  targetMonth,
  ownerTone = 'warm and welcoming',
}) {
  const holidayLine = holiday
    ? `The primary upcoming holiday is: **${holiday}**`
    : 'There is no major holiday this period — focus on the seasonal lifestyle.'

  const amenityList = amenities && amenities.length > 0
    ? amenities.slice(0, 15).join(', ')
    : 'standard amenities'

  return `You are an expert short-term rental marketing copywriter specializing in seasonal content. Your job is to create high-converting, seasonally relevant marketing content for an Airbnb/Vrbo property.

## Property Details
- **Property Name:** ${propertyTitle}
- **Location:** ${location}
- **Type:** ${propertyType}
- **Key Amenities:** ${amenityList}
- **Current Description (for reference):** 
${propertyDescription ? propertyDescription.slice(0, 600) : 'No description provided.'}

## Seasonal Context
- **Season:** ${season}
- **Target Month:** ${targetMonth}
- **Seasonal Theme:** ${seasonalTheme}
- ${holidayLine}
- **Owner Voice/Tone:** ${ownerTone}

## Your Task
Generate a complete seasonal content package. Output ONLY valid JSON matching the schema below — no markdown fences, no extra text.

## Output Schema
{
  "listingDescription": {
    "headline": "A compelling seasonal headline (max 10 words) for the listing title update",
    "description": "A full refreshed listing description (250-350 words) with seasonal framing. Keep the property's core selling points but weave in seasonal atmosphere, activities, and emotional appeal. End with a clear call to book."
  },
  "socialCaptions": [
    {
      "platform": "instagram",
      "caption": "Instagram caption (150-200 chars) with seasonal hook, property highlight, and call to action",
      "hashtags": ["array", "of", "8-12", "relevant", "hashtags", "including", "seasonal", "and", "location", "tags"]
    },
    {
      "platform": "instagram_story",
      "caption": "Short punchy story caption (under 80 chars) with seasonal energy",
      "hashtags": ["3-5", "trending", "hashtags"]
    },
    {
      "platform": "facebook",
      "caption": "Facebook post caption (200-250 chars) — slightly more descriptive than Instagram, warm tone, includes seasonal offer angle",
      "hashtags": ["3-5", "hashtags"]
    }
  ],
  "imageGenerationBriefs": [
    {
      "id": "brief_1",
      "title": "Primary seasonal hero image",
      "sceneDescription": "Detailed scene description for AI image generation (50-80 words). Be specific about lighting, time of day, atmosphere, what's visible in the space, and seasonal styling. Should feel aspirational and editorial.",
      "seasonalElements": ["list", "of", "specific", "seasonal", "props", "or", "elements", "to", "include"],
      "mood": "Single word or short phrase describing the emotional mood",
      "suggestedCast": "Brief casting note — e.g. 'couple in their 30s relaxing' or 'family gathered around fireplace'",
      "usageContext": "Where this image should be used — listing hero, Instagram, etc."
    },
    {
      "id": "brief_2",
      "title": "Lifestyle activity image",
      "sceneDescription": "Detailed scene for a lifestyle/activity moment tied to the season",
      "seasonalElements": ["seasonal", "elements"],
      "mood": "mood",
      "suggestedCast": "casting note",
      "usageContext": "usage context"
    },
    {
      "id": "brief_3",
      "title": "Detail/ambiance image",
      "sceneDescription": "Close-up or detail shot that captures seasonal ambiance — could be a styled table, cozy corner, seasonal decor, etc.",
      "seasonalElements": ["seasonal", "elements"],
      "mood": "mood",
      "suggestedCast": "no people needed — focus on space and details",
      "usageContext": "Instagram, listing gallery"
    }
  ],
  "seasonalSummary": {
    "season": "${season}",
    "holiday": "${holiday || 'none'}",
    "theme": "${seasonalTheme}",
    "targetMonth": "${targetMonth}",
    "keySellingAngles": ["2-3 bullet points on the main seasonal selling angles used in this content"]
  }
}

Important guidelines:
- Write in the owner's voice: ${ownerTone}
- Make the content feel authentic, not generic
- Tie seasonal elements naturally to the property's specific amenities and location
- The listing description should rank well on Airbnb by including searchable seasonal terms naturally
- Social captions should feel native to each platform
- Image briefs should be detailed enough for an AI image model to generate exactly the right shot
- Do NOT make up amenities or features not listed above`
}
