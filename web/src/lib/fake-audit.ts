import type { AuditScoreResult } from './audit-types'

/**
 * Returns a seeded fake AuditScoreResult for local dev/QA.
 * Pass a custom id to control the URL slug (e.g. /audit/demo).
 */
export function buildFakeAudit(id = 'demo'): AuditScoreResult {
  return {
    id,
    created_at: new Date().toISOString(),
    listing_url: 'https://airbnb.com/rooms/12345678',
    listing_title: 'Cozy Mountain Retreat with Hot Tub & Forest Views',
    overall_score: 41,
    property_type: 'Cabin',
    location: 'Gatlinburg, TN',
    categories: [
      {
        category: 'photos',
        label: 'Photos',
        score: 28,
        status:
          'Only 9 photos detected — listings with 20+ professional photos get 2× more clicks.',
      },
      {
        category: 'copy',
        label: 'Listing Copy',
        score: 52,
        status:
          'Your title misses high-search keywords. The description buries the hot tub in paragraph 4.',
      },
      {
        category: 'amenities',
        label: 'Amenities',
        score: 61,
        status:
          'Missing fast WiFi speed callout and EV charger — both rank in top 10 guest search filters.',
      },
      {
        category: 'reviews',
        label: 'Reviews',
        score: 44,
        status:
          '23% of reviews went unanswered. Response rate is a ranking signal on Airbnb.',
      },
      {
        category: 'pricing',
        label: 'Pricing',
        score: 38,
        status:
          'Weekend rate is 12% below comparable listings. You\'re leaving ~$340/mo on the table.',
      },
    ],
    recommendations: [
      {
        id: 'rec-1',
        severity: 'critical',
        category: 'photos',
        title: 'Add at least 11 more high-quality photos',
        action:
          'Shoot these angles: hot tub at dusk with string lights, forest view from deck at sunrise, kitchen with coffee setup, master bedroom with mountain-view window, fire pit at night, bathroom vanity with amenities staged, living room wide shot, exterior curb appeal, nearby trail/attraction. Aim for 20–25 total.',
      },
      {
        id: 'rec-2',
        severity: 'critical',
        category: 'pricing',
        title: 'Raise Friday & Saturday rates by 10–15%',
        action:
          'In your Airbnb pricing calendar, increase Fri–Sat nightly rates from your current $189 to $210–$215. Run this for 30 days and monitor your 90-day booking window. Comparable cabins in Gatlinburg with hot tubs are averaging $218/night on weekends.',
      },
      {
        id: 'rec-3',
        severity: 'critical',
        category: 'copy',
        title: 'Rewrite your listing title with high-search keywords',
        action:
          'Replace your current title with: "Mountain Cabin | Private Hot Tub | Fire Pit | Forest Views | 25 Min to Dollywood". This hits the top 5 search terms guests use when booking in Gatlinburg.',
      },
      {
        id: 'rec-4',
        severity: 'important',
        category: 'reviews',
        title: 'Respond to your 7 unanswered reviews',
        action:
          'Go to your Airbnb inbox → Reviews. For each unanswered review, post a response within 24 hours. Even a 2-sentence thank-you counts. Template: "Thank you [Name] — so glad you enjoyed the hot tub and forest views! We\'d love to host you again next season. 🏔️"',
      },
      {
        id: 'rec-5',
        severity: 'important',
        category: 'copy',
        title: 'Move the hot tub mention to the first paragraph',
        action:
          'Edit your listing description so the first 150 characters mention the hot tub. Example opening: "Unwind in your private hot tub surrounded by old-growth forest — this cozy cabin is your mountain escape. Sleeps 4 comfortably with..."',
      },
      {
        id: 'rec-6',
        severity: 'important',
        category: 'amenities',
        title: 'Add your WiFi speed to the listing',
        action:
          'Run a speed test (fast.com) and add the result to your amenities. In Airbnb → Listing → Amenities, select "Fast wifi" and add the Mbps in the description field. Remote workers filter specifically for this.',
      },
      {
        id: 'rec-7',
        severity: 'nice-to-have',
        category: 'photos',
        title: 'Add a cover photo with seasonal staging',
        action:
          'Your current cover photo shows the exterior in flat midday light. Swap it for the hot tub at dusk photo (golden hour + steam visible). This single change can increase click-through rate by up to 40% according to Airbnb\'s own data.',
      },
      {
        id: 'rec-8',
        severity: 'nice-to-have',
        category: 'amenities',
        title: 'List your propane fire pit as a featured amenity',
        action:
          'Add "Outdoor fire pit" to your amenities list in Airbnb. Then mention it in the first 3 sentences of your description. Fire pits are a top-5 filter for mountain cabin guests.',
      },
    ],
  }
}
