/**
 * Review Response Generation Agent
 * Issue #204 — Owner voice matching
 *
 * Ingests guest reviews from an Airbnb listing, extracts the owner's voice
 * from their existing responses, then generates personalized draft responses
 * via Claude. Saves results to Supabase as deliverables.
 */

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

// ─── Constants ───────────────────────────────────────────────────────────────

const MAX_RESPONSE_WORDS = 150;
const MODEL = 'claude-opus-4-5';

// ─── Supabase client (lazy init so the module can be imported safely) ─────────

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      'Missing Supabase credentials. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.'
    );
  }

  return createClient(url, key);
}

// ─── Claude client ────────────────────────────────────────────────────────────

function getClaude() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('Missing ANTHROPIC_API_KEY');
  return new Anthropic({ apiKey });
}

// ─── Review scraping (reuses the scraper from Issue #195) ────────────────────

/**
 * Fetches reviews from an Airbnb listing URL.
 * We reuse the existing scrapeAirbnbListing infrastructure by calling the
 * internal API route, or fall back to a direct HTTP fetch so this script
 * can run outside of Next.js (e.g. GitHub Actions).
 *
 * @param {string} listingUrl  Full Airbnb listing URL
 * @returns {Promise<ScrapedListing>}
 */
async function scrapeListingReviews(listingUrl) {
  // When running in GitHub Actions / CLI we call the Airbnb mobile API
  // directly using the same strategy the existing scraper uses.
  // We keep this additive — existing scraper file is untouched.
  const roomId = extractRoomId(listingUrl);
  if (!roomId) {
    throw new Error(`Could not extract room ID from URL: ${listingUrl}`);
  }

  // Airbnb's public GraphQL / PDP endpoint (no auth required for public data)
  const pdpUrl =
    `https://www.airbnb.com/api/v3/StaysPdpSections` +
    `?operationName=StaysPdpSections` +
    `&locale=en&currency=USD`;

  // Fallback: use Airbnb's review API endpoint directly
  const reviewsUrl =
    `https://www.airbnb.com/api/v2/reviews` +
    `?listing_id=${roomId}` +
    `&_limit=50` +
    `&_offset=0` +
    `&role=guest` +
    `&_format=for_p3`;

  const headers = {
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    Accept: 'application/json',
    'X-Airbnb-API-Key': 'd306zoyjsyarp7ifhu67rjxn52tv0t20', // public read-only key
  };

  let reviews = [];
  let ownerResponses = [];

  try {
    const resp = await fetch(reviewsUrl, { headers });

    if (resp.ok) {
      const json = await resp.json();
      const rawReviews = json?.reviews ?? [];

      for (const r of rawReviews) {
        const guestComment = r?.comments ?? r?.public_review ?? '';
        const ownerComment = r?.response ?? r?.host_response ?? '';
        const rating = r?.rating ?? 5;
        const guestName = r?.reviewer?.first_name ?? 'Guest';
        const reviewDate = r?.created_at ?? r?.localized_date ?? '';
        const reviewId = String(r?.id ?? '');

        if (guestComment) {
          reviews.push({
            id: reviewId,
            guestName,
            comment: guestComment,
            rating,
            date: reviewDate,
            hasOwnerResponse: Boolean(ownerComment),
            ownerResponse: ownerComment || null,
          });

          if (ownerComment) {
            ownerResponses.push(ownerComment);
          }
        }
      }
    }
  } catch (err) {
    console.warn('[review-response-agent] Review API fetch failed:', err.message);
  }

  // If the API returned nothing, return empty so the agent can handle gracefully
  return { roomId, listingUrl, reviews, ownerResponses };
}

/**
 * Extract the numeric room ID from an Airbnb URL.
 * Handles formats like /rooms/12345, /h/slug--12345, and ?id=12345
 */
function extractRoomId(url) {
  // /rooms/12345678  or  /rooms/12345678?
  const roomsMatch = url.match(/\/rooms\/(\d+)/);
  if (roomsMatch) return roomsMatch[1];

  // /h/property-name-12345678
  const hMatch = url.match(/\/h\/[^?]+[^0-9](\d{6,})/);
  if (hMatch) return hMatch[1];

  // Trailing number (e.g. some short URLs)
  const trailingMatch = url.match(/(\d{6,})/);
  if (trailingMatch) return trailingMatch[1];

  return null;
}

// ─── Voice profile extraction ─────────────────────────────────────────────────

/**
 * Builds a voice profile from the owner's existing review responses.
 * Falls back to neutral-professional if no samples exist.
 *
 * @param {string[]} ownerResponses  Array of owner's past response texts
 * @param {Anthropic}  claude
 * @returns {Promise<VoiceProfile>}
 */
async function extractVoiceProfile(ownerResponses, claude) {
  // No samples → return neutral-professional fallback
  if (!ownerResponses || ownerResponses.length === 0) {
    return {
      formality: 'professional',
      warmth: 'warm',
      sentenceLength: 'medium',
      usesEmoji: false,
      signOffStyle: 'Thank you for staying with us!',
      vocabularyNotes:
        'Use clear, friendly, professional language. Avoid jargon. ' +
        'Be genuine and specific.',
      examplePhrases: [],
      fallback: true,
    };
  }

  const sampleText = ownerResponses.slice(0, 5).join('\n\n---\n\n');

  const message = await claude.messages.create({
    model: MODEL,
    max_tokens: 600,
    messages: [
      {
        role: 'user',
        content: `You are a voice analysis expert. Analyze these host review responses and extract a concise voice profile.

EXISTING HOST RESPONSES:
${sampleText}

Return a JSON object (no markdown, no explanation) with these exact keys:
{
  "formality": "casual" | "professional" | "semi-formal",
  "warmth": "warm" | "neutral" | "formal",
  "sentenceLength": "short" | "medium" | "long",
  "usesEmoji": boolean,
  "signOffStyle": "the typical closing line the host uses",
  "vocabularyNotes": "brief description of word choices, phrases, patterns (2-3 sentences)",
  "examplePhrases": ["phrase 1", "phrase 2", "phrase 3"]
}`,
      },
    ],
  });

  const raw = message.content[0]?.text ?? '{}';

  try {
    const parsed = JSON.parse(raw.trim());
    return { ...parsed, fallback: false };
  } catch {
    // If Claude returns malformed JSON, use fallback
    console.warn('[review-response-agent] Could not parse voice profile JSON, using fallback');
    return {
      formality: 'professional',
      warmth: 'warm',
      sentenceLength: 'medium',
      usesEmoji: false,
      signOffStyle: 'Thank you for staying with us!',
      vocabularyNotes: raw.slice(0, 300),
      examplePhrases: [],
      fallback: true,
    };
  }
}

// ─── Response generation ──────────────────────────────────────────────────────

/**
 * Generates a single review response draft for one guest review.
 *
 * @param {Review} review
 * @param {VoiceProfile} voiceProfile
 * @param {Anthropic} claude
 * @returns {Promise<{draft: string, specificDetail: string, passed: boolean}>}
 */
async function generateResponseDraft(review, voiceProfile, claude) {
  const voiceInstructions = buildVoiceInstructions(voiceProfile);

  const prompt = `You are writing a public review response on behalf of an Airbnb host.

GUEST REVIEW (${review.rating}/5 stars, from ${review.guestName}):
"${review.comment}"

HOST VOICE PROFILE:
${voiceInstructions}

REQUIREMENTS:
1. Maximum ${MAX_RESPONSE_WORDS} words — be concise
2. You MUST reference at least one SPECIFIC detail from the guest's review (a place they mentioned, an experience they described, something specific they praised or critiqued) — NOT generic boilerplate
3. Match the host's voice profile precisely
4. If the review mentions any issue or criticism, acknowledge it graciously and briefly
5. End with the host's typical sign-off style
6. Do NOT use placeholder text like [Host Name] — write the response as-is
7. Do NOT start with "Dear [Guest]" — start directly with the response content or a greeting using the guest's first name

First, on a line by itself, write: SPECIFIC_DETAIL: [the exact detail from the review you are referencing]
Then write the response draft.`;

  const message = await claude.messages.create({
    model: MODEL,
    max_tokens: 400,
    messages: [{ role: 'user', content: prompt }],
  });

  const fullText = message.content[0]?.text ?? '';

  // Parse out the specific detail and the draft
  const detailMatch = fullText.match(/^SPECIFIC_DETAIL:\s*(.+)/m);
  const specificDetail = detailMatch ? detailMatch[1].trim() : '';

  // The draft is everything after the SPECIFIC_DETAIL line
  const draftRaw = fullText.replace(/^SPECIFIC_DETAIL:.+\n?/m, '').trim();

  // Quality gate: validate the response references the specific detail
  const passed = validateQualityGate(review.comment, draftRaw, specificDetail);

  // Word count guard
  const words = draftRaw.split(/\s+/).filter(Boolean);
  let draft = draftRaw;
  if (words.length > MAX_RESPONSE_WORDS) {
    // Trim to max words and add ellipsis (shouldn't happen often with prompt constraints)
    draft = words.slice(0, MAX_RESPONSE_WORDS).join(' ') + '…';
  }

  return { draft, specificDetail, passed };
}

/**
 * Builds a human-readable voice instruction block from the voice profile.
 */
function buildVoiceInstructions(profile) {
  const lines = [
    `- Formality level: ${profile.formality}`,
    `- Warmth: ${profile.warmth}`,
    `- Sentence length preference: ${profile.sentenceLength}`,
    `- Emoji usage: ${profile.usesEmoji ? 'Use sparingly (1-2 max)' : 'Do NOT use emoji'}`,
    `- Typical sign-off: "${profile.signOffStyle}"`,
    `- Vocabulary notes: ${profile.vocabularyNotes}`,
  ];

  if (profile.examplePhrases && profile.examplePhrases.length > 0) {
    lines.push(`- Example phrases to echo: ${profile.examplePhrases.join(', ')}`);
  }

  if (profile.fallback) {
    lines.push('- FALLBACK VOICE: Use neutral, warm, professional tone.');
  }

  return lines.join('\n');
}

/**
 * Quality gate: ensures the response references a real detail from the review.
 * Returns true if the gate passes.
 */
function validateQualityGate(guestReview, draft, specificDetail) {
  // Gate 1: specific detail must be non-empty
  if (!specificDetail || specificDetail.length < 5) return false;

  // Gate 2: a meaningful portion of the specific detail appears in the draft
  // Extract key words from the specific detail (>4 chars) and check at least one is in draft
  const detailWords = specificDetail
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 4);

  if (detailWords.length === 0) return false;

  const draftLower = draft.toLowerCase();
  const matchCount = detailWords.filter((w) => draftLower.includes(w)).length;

  // At least half the detail words (or at least 1) must appear in the draft
  return matchCount >= Math.max(1, Math.floor(detailWords.length / 2));
}

// ─── Supabase persistence ─────────────────────────────────────────────────────

/**
 * Saves a review response draft to the deliverables table.
 *
 * @param {object} params
 * @param {string} params.propertyId  UUID of the property record
 * @param {Review} params.review
 * @param {string} params.draft
 * @param {string} params.specificDetail
 * @param {boolean} params.passed  Quality gate result
 * @param {VoiceProfile} params.voiceProfile
 * @param {object} supabase
 * @returns {Promise<string>}  ID of the inserted row
 */
async function saveDeliverable(
  { propertyId, review, draft, specificDetail, passed, voiceProfile },
  supabase
) {
  const payload = {
    property_id: propertyId,
    type: 'review_response',
    status: 'pending_approval',
    content: draft,
    metadata: {
      review_id: review.id,
      guest_name: review.guestName,
      guest_rating: review.rating,
      guest_comment: review.comment,
      review_date: review.date,
      specific_detail_referenced: specificDetail,
      quality_gate_passed: passed,
      voice_profile_used: voiceProfile.fallback ? 'fallback' : 'extracted',
      word_count: draft.split(/\s+/).filter(Boolean).length,
      generated_at: new Date().toISOString(),
    },
    created_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('deliverables')
    .insert(payload)
    .select('id')
    .single();

  if (error) {
    throw new Error(`Supabase insert failed: ${error.message}`);
  }

  return data.id;
}

// ─── Property lookup ──────────────────────────────────────────────────────────

/**
 * Looks up the property record in Supabase by Airbnb listing URL.
 * Returns the property row or null.
 */
async function lookupProperty(listingUrl, supabase) {
  // Try exact URL match first
  const { data: exact } = await supabase
    .from('properties')
    .select('id, owner_id, airbnb_url, title')
    .eq('airbnb_url', listingUrl)
    .maybeSingle();

  if (exact) return exact;

  // Try matching by room ID (URL formats vary)
  const roomId = extractRoomId(listingUrl);
  if (!roomId) return null;

  const { data: byRoomId } = await supabase
    .from('properties')
    .select('id, owner_id, airbnb_url, title')
    .ilike('airbnb_url', `%${roomId}%`)
    .maybeSingle();

  return byRoomId ?? null;
}

// ─── Main agent function ──────────────────────────────────────────────────────

/**
 * Run the review response agent for a single property.
 *
 * @param {object} options
 * @param {string} options.listingUrl         Airbnb listing URL
 * @param {string} [options.propertyId]       Override property UUID (skips lookup)
 * @param {boolean} [options.dryRun]          If true, skip Supabase writes
 * @param {boolean} [options.includeResponded] Also generate for reviews that already have owner responses
 * @returns {Promise<AgentResult>}
 */
export async function runReviewResponseAgent({
  listingUrl,
  propertyId: overridePropertyId = null,
  dryRun = false,
  includeResponded = false,
}) {
  console.log(`\n[review-response-agent] Starting for: ${listingUrl}`);
  console.log(`[review-response-agent] Dry run: ${dryRun}`);

  const supabase = dryRun ? null : getSupabase();
  const claude = getClaude();

  // ── 1. Resolve property ───────────────────────────────────────────────────
  let propertyId = overridePropertyId;

  if (!propertyId && !dryRun) {
    const property = await lookupProperty(listingUrl, supabase);
    if (property) {
      propertyId = property.id;
      console.log(`[review-response-agent] Found property: ${property.title} (${propertyId})`);
    } else {
      console.warn(
        '[review-response-agent] No property record found in Supabase for this URL. ' +
          'Deliverables will be saved without a property_id link.'
      );
    }
  }

  // ── 2. Scrape reviews ─────────────────────────────────────────────────────
  console.log('[review-response-agent] Scraping reviews…');
  const { reviews, ownerResponses } = await scrapeListingReviews(listingUrl);
  console.log(
    `[review-response-agent] Found ${reviews.length} reviews, ` +
      `${ownerResponses.length} existing owner responses`
  );

  if (reviews.length === 0) {
    console.log('[review-response-agent] No reviews found. Nothing to do.');
    return {
      processed: 0,
      saved: 0,
      skipped: 0,
      failed: 0,
      drafts: [],
    };
  }

  // ── 3. Extract voice profile ──────────────────────────────────────────────
  console.log('[review-response-agent] Extracting voice profile…');
  const voiceProfile = await extractVoiceProfile(ownerResponses, claude);
  console.log(
    `[review-response-agent] Voice profile: ${voiceProfile.formality} / ` +
      `${voiceProfile.warmth} (fallback: ${voiceProfile.fallback})`
  );

  // ── 4. Filter to unresponded reviews (unless includeResponded) ────────────
  const targetReviews = includeResponded
    ? reviews
    : reviews.filter((r) => !r.hasOwnerResponse);

  console.log(
    `[review-response-agent] Generating responses for ${targetReviews.length} reviews ` +
      `(${reviews.length - targetReviews.length} already have responses)`
  );

  // ── 5. Generate + save drafts ─────────────────────────────────────────────
  const results = {
    processed: 0,
    saved: 0,
    skipped: 0,
    failed: 0,
    drafts: [],
  };

  for (const review of targetReviews) {
    console.log(
      `\n[review-response-agent] Processing review ${review.id} ` +
        `from ${review.guestName} (${review.rating}★)…`
    );

    try {
      const { draft, specificDetail, passed } = await generateResponseDraft(
        review,
        voiceProfile,
        claude
      );

      results.processed++;

      if (!passed) {
        console.warn(
          `[review-response-agent] ⚠ Quality gate FAILED for review ${review.id}. ` +
            `Specific detail: "${specificDetail}". Saving with quality_gate_passed=false.`
        );
        results.skipped++;
        // We still save it so the owner can see it, but flag it
      } else {
        console.log(
          `[review-response-agent] ✓ Quality gate passed. Detail: "${specificDetail}"`
        );
      }

      const draftEntry = {
        reviewId: review.id,
        guestName: review.guestName,
        rating: review.rating,
        draft,
        specificDetail,
        qualityGatePassed: passed,
        wordCount: draft.split(/\s+/).filter(Boolean).length,
      };

      if (!dryRun && supabase) {
        try {
          const deliverableId = await saveDeliverable(
            { propertyId, review, draft, specificDetail, passed, voiceProfile },
            supabase
          );
          draftEntry.deliverableId = deliverableId;
          results.saved++;
          console.log(`[review-response-agent] Saved deliverable: ${deliverableId}`);
        } catch (saveErr) {
          console.error(
            `[review-response-agent] Failed to save deliverable for review ${review.id}:`,
            saveErr.message
          );
          results.failed++;
        }
      } else {
        results.saved++; // In dry run, count as "would have been saved"
      }

      results.drafts.push(draftEntry);
    } catch (err) {
      console.error(
        `[review-response-agent] Error processing review ${review.id}:`,
        err.message
      );
      results.failed++;
    }

    // Polite delay between Claude calls to avoid rate limits
    await sleep(800);
  }

  // ── 6. Summary ────────────────────────────────────────────────────────────
  console.log('\n[review-response-agent] ─────────────────────────────────');
  console.log(`[review-response-agent] Done.`);
  console.log(`  Reviews found:    ${reviews.length}`);
  console.log(`  Targeted:         ${targetReviews.length}`);
  console.log(`  Processed:        ${results.processed}`);
  console.log(`  Saved:            ${results.saved}`);
  console.log(`  Quality failures: ${results.skipped}`);
  console.log(`  Errors:           ${results.failed}`);
  console.log('[review-response-agent] ─────────────────────────────────\n');

  return results;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
