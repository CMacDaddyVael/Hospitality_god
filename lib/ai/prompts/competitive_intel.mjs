/**
 * Competitive Intel — Claude Prompt
 *
 * Generates a market positioning snapshot with 3 ranked, data-backed recommendations.
 * All recommendations must cite specific numbers from the competitor dataset.
 */

/**
 * Build the system prompt for the competitive intel analysis.
 */
export function buildCompetitiveIntelSystemPrompt() {
  return `You are a data-driven short-term rental revenue strategist working inside VAEL Host, an AI CMO platform. Your job is to analyze a host's competitive position and produce specific, numbers-backed recommendations they can act on this week.

CRITICAL RULES:
1. Every recommendation MUST cite a specific number from the competitor data (prices, ratings, review counts, percentages). No generic advice.
2. Rank recommendations from highest revenue impact to lowest.
3. Be direct and specific — hosts are busy operators, not marketers.
4. Reference the owner's exact property data (their price, rating) when comparing.
5. Identify patterns across the competitive set — what do top performers share?
6. Never say "consider" without giving a specific target number or action.
7. Output ONLY valid JSON matching the schema below — no markdown, no commentary outside the JSON.

OUTPUT SCHEMA:
{
  "market_summary": {
    "location": "string",
    "competitors_analyzed": number,
    "median_price": number,
    "avg_rating": number,
    "avg_review_count": number,
    "price_range": { "min": number, "max": number },
    "owner_price_vs_median_pct": number,
    "owner_rating_vs_avg": number
  },
  "positioning_tier": "string (e.g. 'Premium-priced, below-average rated' or 'Budget, high volume')",
  "recommendations": [
    {
      "rank": 1,
      "title": "string (short, punchy — max 10 words)",
      "finding": "string (what the data shows — cite specific numbers)",
      "action": "string (specific action the owner should take, with target numbers)",
      "impact": "string (expected outcome, quantified where possible)",
      "data_points_used": ["string"]
    },
    {
      "rank": 2,
      ...same schema...
    },
    {
      "rank": 3,
      ...same schema...
    }
  ],
  "competitive_set_highlights": {
    "top_rated_listing": { "title": "string", "rating": number, "price": number },
    "most_reviewed_listing": { "title": "string", "review_count": number, "rating": number },
    "title_patterns": ["string"],
    "common_amenity_keywords": ["string"]
  },
  "generated_at": "string (ISO timestamp)"
}`;
}

/**
 * Build the user message with all competitive data for Claude to analyze.
 *
 * @param {Object} ownerProperty  — { location, nightlyPrice, rating, reviewCount, title }
 * @param {Array}  competitors    — array of { title, price, rating, reviewCount, amenities, listingUrl }
 * @returns {string}
 */
export function buildCompetitiveIntelUserPrompt(ownerProperty, competitors) {
  const validCompetitors = competitors.filter(
    (c) => c.price || c.rating || c.title
  );

  // Pre-compute summary stats to give Claude clean numbers
  const prices = validCompetitors.filter((c) => c.price).map((c) => c.price);
  const ratings = validCompetitors.filter((c) => c.rating).map((c) => c.rating);
  const reviewCounts = validCompetitors.filter((c) => c.reviewCount).map((c) => c.reviewCount);

  const median = (arr) => {
    if (!arr.length) return null;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0
      ? sorted[mid]
      : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
  };

  const avg = (arr) =>
    arr.length ? Math.round((arr.reduce((s, v) => s + v, 0) / arr.length) * 100) / 100 : null;

  const medianPrice = median(prices);
  const avgRating = avg(ratings);
  const avgReviews = avg(reviewCounts);

  // Title pattern extraction: common words across competitor titles
  const titleWords = validCompetitors
    .filter((c) => c.title)
    .flatMap((c) =>
      c.title
        .toLowerCase()
        .split(/[\s|·\-,!]+/)
        .filter((w) => w.length > 3)
    );

  const wordFreq = {};
  for (const w of titleWords) {
    wordFreq[w] = (wordFreq[w] || 0) + 1;
  }
  const topTitleWords = Object.entries(wordFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word, count]) => `"${word}" (${count}/${validCompetitors.length} listings)`);

  // Amenity frequency
  const amenityWords = validCompetitors.flatMap((c) => c.amenities || []);
  const amenityFreq = {};
  for (const a of amenityWords) {
    const key = a.toLowerCase().trim();
    if (key.length > 2) amenityFreq[key] = (amenityFreq[key] || 0) + 1;
  }
  const topAmenities = Object.entries(amenityFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([amenity, count]) => `"${amenity}" (${count} listings)`);

  const ownerPriceVsMedian =
    medianPrice && ownerProperty.nightlyPrice
      ? Math.round(((ownerProperty.nightlyPrice - medianPrice) / medianPrice) * 100)
      : null;

  const ownerRatingVsAvg =
    avgRating && ownerProperty.rating
      ? Math.round((ownerProperty.rating - avgRating) * 100) / 100
      : null;

  return `Analyze the competitive landscape for this short-term rental property and generate a market positioning snapshot.

## OWNER'S PROPERTY
- Location: ${ownerProperty.location}
- Listing Title: ${ownerProperty.title || 'Not provided'}
- Nightly Price: $${ownerProperty.nightlyPrice}
- Overall Rating: ${ownerProperty.rating || 'Not available'}
- Review Count: ${ownerProperty.reviewCount || 'Not available'}

## PRE-COMPUTED MARKET STATS (from ${validCompetitors.length} competitors)
- Competitor median price: $${medianPrice ?? 'N/A'}/night
- Competitor avg rating: ${avgRating ?? 'N/A'} stars
- Competitor avg review count: ${avgReviews ?? 'N/A'}
- Price range: $${Math.min(...prices) ?? 'N/A'} – $${Math.max(...prices) ?? 'N/A'}/night
- Owner price vs median: ${ownerPriceVsMedian !== null ? `${ownerPriceVsMedian > 0 ? '+' : ''}${ownerPriceVsMedian}%` : 'N/A'}
- Owner rating vs avg: ${ownerRatingVsAvg !== null ? `${ownerRatingVsAvg > 0 ? '+' : ''}${ownerRatingVsAvg}` : 'N/A'}

## TOP TITLE KEYWORDS across competitors
${topTitleWords.length ? topTitleWords.join('\n') : 'No title data available'}

## TOP AMENITY KEYWORDS across competitors
${topAmenities.length ? topAmenities.join('\n') : 'No amenity data available'}

## FULL COMPETITOR DATASET
${validCompetitors
  .map(
    (c, i) => `
Competitor ${i + 1}:
  Title: ${c.title || 'Unknown'}
  Price: ${c.price ? `$${c.price}/night` : 'Unknown'}
  Rating: ${c.rating ? `${c.rating} stars` : 'Unknown'}
  Reviews: ${c.reviewCount ?? 'Unknown'}
  Amenities: ${c.amenities?.length ? c.amenities.join(', ') : 'None extracted'}
  URL: ${c.listingUrl || 'N/A'}`
  )
  .join('\n')}

## YOUR TASK
Generate exactly 3 ranked recommendations. Each must:
1. Reference at least 2 specific numbers from the data above
2. Give a concrete action (with target price, exact word to add, specific amenity, etc.)
3. Estimate impact using available data

Return ONLY the JSON object matching the schema — no other text.`;
}
