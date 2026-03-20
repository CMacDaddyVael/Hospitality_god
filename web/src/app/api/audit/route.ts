import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import {
  runImageAudit,
  mergePhotoScore,
  buildImageAuditPromptContext,
  type ImageAuditOutput,
} from '@/lib/image-audit-integration'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ListingData {
  title?: string
  description?: string
  photos?: string[]
  amenities?: string[]
  reviews?: { text: string; rating: number; date: string }[]
  rating?: number
  reviewCount?: number
  propertyType?: string
  location?: string
  pricePerNight?: number
  platform?: string
}

interface CategoryScore {
  score: number
  maxScore: number
  weight: number
  notes: string[]
}

interface AuditScore {
  total: number
  maxTotal: number
  grade: string
  categories: {
    Photos: CategoryScore
    Title: CategoryScore
    Description: CategoryScore
    Amenities: CategoryScore
    Reviews: CategoryScore
    Pricing: CategoryScore
  }
}

interface AuditResult {
  score: AuditScore
  summary: string
  priorityFixes: string[]
  strengths: string[]
  imageAudit: {
    photos: Array<{
      url: string
      score: number
      flags: Array<{
        type: string
        severity: string
        message: string
      }>
    }>
  }
}

// ---------------------------------------------------------------------------
// Scoring helpers (count-only baseline — image audit will override Photos)
// ---------------------------------------------------------------------------

function scoreTitle(title: string | undefined): CategoryScore {
  const notes: string[] = []
  let score = 0

  if (!title) {
    return { score: 0, maxScore: 100, weight: 15, notes: ['No title found'] }
  }

  // Length: ideal 50–80 chars
  if (title.length >= 50 && title.length <= 80) {
    score += 40
  } else if (title.length >= 30) {
    score += 20
    notes.push('Title could be longer (aim for 50–80 characters)')
  } else {
    notes.push('Title is too short — expand it to 50–80 characters')
  }

  // Emotional/descriptive words
  const powerWords = [
    'cozy', 'luxury', 'stunning', 'charming', 'spacious', 'private',
    'modern', 'rustic', 'beautiful', 'amazing', 'perfect', 'walkable',
    'panoramic', 'serene', 'retreat', 'escape', 'renovated', 'designer',
  ]
  const titleLower = title.toLowerCase()
  const powerWordCount = powerWords.filter((w) => titleLower.includes(w)).length
  if (powerWordCount >= 2) {
    score += 30
  } else if (powerWordCount === 1) {
    score += 15
    notes.push('Add more descriptive words to your title')
  } else {
    notes.push('Title lacks compelling descriptive words (cozy, stunning, private, etc.)')
  }

  // Location mention
  if (titleLower.includes('downtown') || titleLower.includes('beach') ||
      titleLower.includes('mountain') || titleLower.includes('lake') ||
      titleLower.includes('city') || titleLower.includes('historic') ||
      titleLower.includes('view') || titleLower.includes('waterfront')) {
    score += 30
  } else {
    notes.push('Consider including your location highlight in the title')
  }

  return { score: Math.min(score, 100), maxScore: 100, weight: 15, notes }
}

function scoreDescription(description: string | undefined): CategoryScore {
  const notes: string[] = []
  let score = 0

  if (!description) {
    return { score: 0, maxScore: 100, weight: 20, notes: ['No description found'] }
  }

  const wordCount = description.split(/\s+/).length

  if (wordCount >= 200) {
    score += 40
  } else if (wordCount >= 100) {
    score += 20
    notes.push(`Description is short (${wordCount} words) — aim for 200+ words`)
  } else {
    notes.push(`Description is very short (${wordCount} words) — needs significant expansion`)
  }

  // Paragraph structure
  const paragraphs = description.split(/\n\n+/).filter(Boolean)
  if (paragraphs.length >= 3) {
    score += 20
  } else {
    notes.push('Break your description into clear sections (space, neighborhood, guest experience)')
  }

  // Guest experience language
  const guestWords = ['you\'ll', 'you will', 'guests', 'enjoy', 'experience', 'feel', 'relax']
  const descLower = description.toLowerCase()
  const guestWordCount = guestWords.filter((w) => descLower.includes(w)).length
  if (guestWordCount >= 2) {
    score += 20
  } else {
    notes.push('Write from the guest\'s perspective — use "you\'ll love" language')
  }

  // Amenity callouts in description
  const amenityMentions = ['wifi', 'kitchen', 'parking', 'pool', 'workspace', 'coffee']
  const amenityCount = amenityMentions.filter((a) => descLower.includes(a)).length
  if (amenityCount >= 2) {
    score += 20
  } else {
    notes.push('Mention key amenities in your description, not just the amenities list')
  }

  return { score: Math.min(score, 100), maxScore: 100, weight: 20, notes }
}

function scorePhotosCountOnly(photos: string[] | undefined): CategoryScore {
  const notes: string[] = []
  const count = photos?.length ?? 0

  let score = 0
  if (count >= 20) {
    score = 100
  } else if (count >= 15) {
    score = 75
    notes.push(`You have ${count} photos — adding a few more (aim for 20+) will boost your ranking`)
  } else if (count >= 10) {
    score = 50
    notes.push(`You have ${count} photos — Airbnb rewards listings with 20+ photos`)
  } else if (count >= 5) {
    score = 25
    notes.push(`Only ${count} photos — you need at least 20 high-quality photos`)
  } else {
    score = 0
    notes.push(`Critical: Only ${count} photos. This is severely hurting your ranking.`)
  }

  return { score, maxScore: 100, weight: 20, notes }
}

function scoreAmenities(amenities: string[] | undefined): CategoryScore {
  const notes: string[] = []
  const count = amenities?.length ?? 0

  let score = 0
  if (count >= 25) {
    score = 100
  } else if (count >= 15) {
    score = 75
    notes.push('Good amenity list — make sure all amenities are properly tagged in Airbnb')
  } else if (count >= 10) {
    score = 50
    notes.push(`${count} amenities listed — aim for 25+ to maximize search visibility`)
  } else {
    score = 25
    notes.push(`Only ${count} amenities — you're likely missing items that would improve search ranking`)
  }

  // Check for high-value amenities
  const highValue = ['wifi', 'kitchen', 'washer', 'dryer', 'air conditioning', 'heating',
    'parking', 'pool', 'hot tub', 'gym', 'workspace', 'ev charger']
  const amenitiesLower = (amenities || []).map((a) => a.toLowerCase())
  const hasHighValue = highValue.filter((hv) =>
    amenitiesLower.some((a) => a.includes(hv))
  )

  if (hasHighValue.length < 3) {
    notes.push('Missing high-value amenities: ensure WiFi, kitchen, and parking are listed')
  }

  return { score: Math.min(score, 100), maxScore: 100, weight: 20, notes }
}

function scoreReviews(
  reviews: ListingData['reviews'],
  rating: number | undefined,
  reviewCount: number | undefined
): CategoryScore {
  const notes: string[] = []
  let score = 0

  const count = reviewCount ?? reviews?.length ?? 0
  const avgRating = rating ?? 0

  // Rating score
  if (avgRating >= 4.9) {
    score += 40
  } else if (avgRating >= 4.7) {
    score += 30
    notes.push('Strong rating — a few more 5-star reviews will push you to Superhost territory')
  } else if (avgRating >= 4.5) {
    score += 20
    notes.push('Good rating but there\'s room to improve — focus on the 5-star experience')
  } else if (avgRating > 0) {
    score += 10
    notes.push('Rating needs improvement — review your recent feedback for patterns')
  } else {
    notes.push('No rating data found')
  }

  // Review count score
  if (count >= 50) {
    score += 40
  } else if (count >= 20) {
    score += 30
  } else if (count >= 10) {
    score += 20
    notes.push('Building reviews — consider using automated review request messages')
  } else if (count >= 1) {
    score += 10
    notes.push('Few reviews — each 5-star review significantly improves your ranking')
  } else {
    notes.push('No reviews yet — prioritize getting your first 5-star reviews')
  }

  // Recency
  if (reviews && reviews.length > 0) {
    const recentReviews = reviews.filter((r) => {
      const reviewDate = new Date(r.date)
      const threeMonthsAgo = new Date()
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)
      return reviewDate > threeMonthsAgo
    })
    if (recentReviews.length >= 3) {
      score += 20
    } else if (recentReviews.length >= 1) {
      score += 10
      notes.push('Keep up the recent review momentum')
    } else {
      notes.push('No recent reviews — Airbnb\'s algorithm favors listings with recent activity')
    }
  }

  return { score: Math.min(score, 100), maxScore: 100, weight: 15, notes }
}

function scorePricing(pricePerNight: number | undefined): CategoryScore {
  const notes: string[] = []

  if (!pricePerNight) {
    return {
      score: 50,
      maxScore: 100,
      weight: 10,
      notes: ['Could not analyze pricing — consider using dynamic pricing tools'],
    }
  }

  // Basic pricing health check — without market data we can only check general patterns
  const notes2: string[] = []
  let score = 60 // Default reasonable score when we can't do full market comparison

  if (pricePerNight < 50) {
    notes2.push('Price may be too low — underpricing can signal low quality to guests')
    score = 40
  } else if (pricePerNight > 500) {
    notes2.push('High price point — ensure your listing quality and photos match premium expectations')
    score = 70
  } else {
    notes2.push('Consider using a dynamic pricing tool (PriceLabs, Wheelhouse) to maximize revenue')
  }

  return { score, maxScore: 100, weight: 10, notes: notes2 }
}

// ---------------------------------------------------------------------------
// Grade calculator
// ---------------------------------------------------------------------------

function calculateGrade(score: number): string {
  if (score >= 90) return 'A'
  if (score >= 80) return 'B'
  if (score >= 70) return 'C'
  if (score >= 60) return 'D'
  return 'F'
}

// ---------------------------------------------------------------------------
// Claude summary
// ---------------------------------------------------------------------------

async function generateClaudeSummary(
  listing: ListingData,
  auditScore: AuditScore,
  imageAuditContext: string
): Promise<{ summary: string; priorityFixes: string[]; strengths: string[] }> {
  const categoryBreakdown = Object.entries(auditScore.categories)
    .map(([name, cat]) => `  ${name}: ${cat.score}/100 (weight: ${cat.weight}%)`)
    .join('\n')

  const allNotes = Object.entries(auditScore.categories)
    .flatMap(([name, cat]) => cat.notes.map((n) => `[${name}] ${n}`))
    .join('\n')

  const imageContext = imageAuditContext
    ? `\n\nPhoto Quality Analysis:\n${imageAuditContext}`
    : ''

  const prompt = `You are an expert Airbnb listing consultant. Analyze this listing audit and provide actionable feedback.

Listing: "${listing.title || 'Untitled'}"
Location: ${listing.location || 'Unknown'}
Platform: ${listing.platform || 'Airbnb'}
Overall Score: ${auditScore.total}/100 (Grade: ${auditScore.grade})

Category Scores:
${categoryBreakdown}

Specific Issues Found:
${allNotes}${imageContext}

Provide a response in this exact JSON format:
{
  "summary": "2-3 sentence overall assessment of the listing's current performance and biggest opportunity",
  "priorityFixes": [
    "Most impactful fix — specific and actionable",
    "Second most impactful fix — specific and actionable", 
    "Third most impactful fix — specific and actionable"
  ],
  "strengths": [
    "What they're doing well #1",
    "What they're doing well #2"
  ]
}

Be specific and reference actual details from the listing. If photo issues were identified (lighting, composition, etc.), reference them specifically in the priority fixes. Keep the tone direct and encouraging.`

  const message = await anthropic.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  })

  const content = message.content[0]
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude')
  }

  // Extract JSON from response (Claude sometimes wraps it in markdown code blocks)
  const jsonMatch = content.text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('Could not parse JSON from Claude response')
  }

  return JSON.parse(jsonMatch[0])
}

// ---------------------------------------------------------------------------
// Main route handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { listing }: { listing: ListingData } = body

    if (!listing) {
      return NextResponse.json({ error: 'Listing data is required' }, { status: 400 })
    }

    // Determine base URL for internal API calls
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

    // -----------------------------------------------------------------------
    // Run scoring engine AND image audit in parallel
    // -----------------------------------------------------------------------
    const photoUrls = listing.photos || []

    const [
      titleScore,
      descriptionScore,
      amenitiesScore,
      reviewsScore,
      pricingScore,
      imageAuditResult,
    ] = await Promise.all([
      Promise.resolve(scoreTitle(listing.title)),
      Promise.resolve(scoreDescription(listing.description)),
      Promise.resolve(scoreAmenities(listing.amenities)),
      Promise.resolve(
        scoreReviews(listing.reviews, listing.rating, listing.reviewCount)
      ),
      Promise.resolve(scorePricing(listing.pricePerNight)),
      runImageAudit(photoUrls, baseUrl),
    ])

    // -----------------------------------------------------------------------
    // Build Photos category score — merge image audit results
    // -----------------------------------------------------------------------
    const basePhotoCategory = scorePhotosCountOnly(listing.photos)
    const mergedPhotoScore = mergePhotoScore(photoUrls.length, imageAuditResult)

    // Build photo notes: combine count notes + image audit flags
    const photoNotes = [...basePhotoCategory.notes]

    if (!imageAuditResult.timedOut && imageAuditResult.photos.length > 0) {
      if (imageAuditResult.averageScore < 60) {
        photoNotes.push(
          `Photo quality score: ${imageAuditResult.averageScore}/100 — significant quality improvements needed`
        )
      } else if (imageAuditResult.averageScore < 80) {
        photoNotes.push(
          `Photo quality score: ${imageAuditResult.averageScore}/100 — some quality improvements possible`
        )
      }

      // Surface specific high-severity flags as notes
      const highSeverityFlags = imageAuditResult.photos
        .flatMap((p) => p.flags.filter((f) => f.severity === 'high').map((f) => f.message))
        .slice(0, 2)

      highSeverityFlags.forEach((msg) => photoNotes.push(msg))
    } else if (imageAuditResult.timedOut) {
      photoNotes.push('Photo quality analysis unavailable — scored on count only')
    }

    const photosCategory: CategoryScore = {
      score: mergedPhotoScore,
      maxScore: 100,
      weight: basePhotoCategory.weight,
      notes: photoNotes,
    }

    // -----------------------------------------------------------------------
    // Assemble final AuditScore
    // -----------------------------------------------------------------------
    const categories = {
      Photos: photosCategory,
      Title: titleScore,
      Description: descriptionScore,
      Amenities: amenitiesScore,
      Reviews: reviewsScore,
      Pricing: pricingScore,
    }

    const totalWeightedScore = Object.values(categories).reduce(
      (sum, cat) => sum + (cat.score * cat.weight) / 100,
      0
    )

    const auditScore: AuditScore = {
      total: Math.round(totalWeightedScore),
      maxTotal: 100,
      grade: calculateGrade(Math.round(totalWeightedScore)),
      categories,
    }

    // -----------------------------------------------------------------------
    // Build image context for Claude and generate summary
    // -----------------------------------------------------------------------
    const imageAuditContext = buildImageAuditPromptContext(imageAuditResult)

    const claudeResult = await generateClaudeSummary(listing, auditScore, imageAuditContext)

    // -----------------------------------------------------------------------
    // Assemble final AuditResult response
    // -----------------------------------------------------------------------
    const auditResult: AuditResult = {
      score: auditScore,
      summary: claudeResult.summary,
      priorityFixes: claudeResult.priorityFixes,
      strengths: claudeResult.strengths,
      imageAudit: {
        photos: imageAuditResult.photos.map((p) => ({
          url: p.url,
          score: p.score,
          flags: p.flags.map((f) => ({
            type: f.type,
            severity: f.severity,
            message: f.message,
          })),
        })),
      },
    }

    return NextResponse.json({ success: true, audit: auditResult })
  } catch (error) {
    console.error('[Audit] Pipeline error:', error)
    return NextResponse.json(
      { error: 'Audit failed. Please try again.' },
      { status: 500 }
    )
  }
}
