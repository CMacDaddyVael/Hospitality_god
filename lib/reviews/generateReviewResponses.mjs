/**
 * Review Response Generation Pipeline
 * ====================================
 * Reads recent reviews for a property, generates 3 response variants per review
 * using the owner's voice profile, and stores each as a `deliverable` row.
 *
 * This is a standalone function: generateReviewResponses(property_id)
 * It is also called during property onboarding if reviews are found.
 */

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { scrapeAirbnbReviews } from './scraper.mjs';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Word count boundaries enforced by post-generation validation
const MIN_WORDS = 50;
const MAX_WORDS = 120;

const VARIANT_LABELS = ['warm_personal', 'professional_brief', 'detail_specific'];

/**
 * Counts words in a string.
 * @param {string} text
 * @returns {number}
 */
function countWords(text) {
  return text
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0).length;
}

/**
 * Builds the system prompt incorporating the owner's voice profile when available.
 * @param {object|null} voiceProfile
 * @returns {string}
 */
function buildSystemPrompt(voiceProfile) {
  if (!voiceProfile) {
    return `You are a friendly and professional short-term rental host writing responses to guest reviews on Airbnb.

Your responses should:
- Be warm, genuine, and personal
- Thank the guest by their first name
- Be between ${MIN_WORDS} and ${MAX_WORDS} words
- Sound like a real person, not a corporate template
- Invite future visits when appropriate
- Address any concerns mentioned constructively and positively

Never use hollow filler phrases like "We take your feedback very seriously." Write like a real host who genuinely cares about their guests.`;
  }

  const {
    tone,
    sign_off_name,
    always_use,
    never_use,
    personality_notes,
    writing_style,
    sample_phrases,
  } = voiceProfile;

  const toneDescription = {
    casual: 'casual, relaxed, and conversational',
    professional: 'professional and polished',
    warm: 'warm, friendly, and heartfelt',
    luxury: 'refined, elegant, and attentive',
  }[tone] || 'friendly and professional';

  const parts = [
    `You are a short-term rental host writing responses to guest reviews. Your tone is ${toneDescription}.`,
  ];

  if (sign_off_name) {
    parts.push(`Always sign off as: ${sign_off_name}`);
  }
  if (always_use) {
    parts.push(`Phrases and words you should use: ${always_use}`);
  }
  if (never_use) {
    parts.push(`Words and phrases to NEVER use: ${never_use}`);
  }
  if (personality_notes) {
    parts.push(`Personality notes: ${personality_notes}`);
  }
  if (writing_style) {
    parts.push(`Writing style: ${writing_style}`);
  }
  if (sample_phrases && sample_phrases.length > 0) {
    const examples = Array.isArray(sample_phrases)
      ? sample_phrases.join('; ')
      : sample_phrases;
    parts.push(`Example phrases from your voice: ${examples}`);
  }

  parts.push(
    `Each response must be between ${MIN_WORDS} and ${MAX_WORDS} words. Sound like a real person, not a template.`
  );

  return parts.join('\n\n');
}

/**
 * Builds the user prompt for a specific variant.
 * @param {object} review - { reviewer_name, star_rating, review_text, review_date }
 * @param {'warm_personal'|'professional_brief'|'detail_specific'} variantLabel
 * @returns {string}
 */
function buildUserPrompt(review, variantLabel) {
  const firstName = extractFirstName(review.reviewer_name);
  const starLabel = review.star_rating >= 5 ? '5-star' : `${review.star_rating}-star`;

  const variantInstructions = {
    warm_personal: `Write a WARM and PERSONAL response. Use ${firstName}'s first name. Express genuine appreciation. Let your personality shine through. Make ${firstName} feel truly seen and valued as a guest, not just a booking.`,

    professional_brief: `Write a PROFESSIONAL and BRIEF response. Keep it concise and polished. Thank ${firstName} by name, acknowledge the ${starLabel} rating, and invite them back. No fluff — every sentence earns its place.`,

    detail_specific: `Write a response that SPECIFICALLY REFERENCES a real detail from the review text. Pick one concrete thing ${firstName} mentioned and reflect it back. This shows you actually read their review and it wasn't just a template response.`,
  };

  return `Guest review from ${firstName} (${starLabel}):
"${review.review_text}"

${variantInstructions[variantLabel]}

Respond ONLY with the response text itself — no labels, no quotes, no preamble. Just the response the host would post.`;
}

/**
 * Extracts first name from a reviewer name string.
 * @param {string} fullName
 * @returns {string}
 */
function extractFirstName(fullName) {
  if (!fullName || typeof fullName !== 'string') return 'Guest';
  return fullName.trim().split(/\s+/)[0];
}

/**
 * Calls Claude to generate a single response variant.
 * Validates word count and regenerates once if out of range.
 *
 * @param {string} systemPrompt
 * @param {string} userPrompt
 * @param {object} review
 * @param {string} variantLabel
 * @returns {Promise<{text: string, word_count: number}>}
 */
async function generateSingleVariant(systemPrompt, userPrompt, review, variantLabel) {
  const generate = async (extraInstruction = '') => {
    const messages = [
      {
        role: 'user',
        content: extraInstruction ? `${userPrompt}\n\n${extraInstruction}` : userPrompt,
      },
    ];

    const response = await anthropic.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 400,
      system: systemPrompt,
      messages,
    });

    const text =
      response.content
        .filter((block) => block.type === 'text')
        .map((block) => block.text)
        .join('')
        .trim();

    return text;
  };

  let text = await generate();
  let wordCount = countWords(text);

  // Validate word count — regenerate once if out of range
  if (wordCount < MIN_WORDS || wordCount > MAX_WORDS) {
    const direction = wordCount < MIN_WORDS ? 'longer' : 'shorter';
    const currentCount = wordCount;
    const target = wordCount < MIN_WORDS ? `at least ${MIN_WORDS}` : `no more than ${MAX_WORDS}`;

    console.info(
      `[generateReviewResponses] ${variantLabel} word count ${currentCount} out of range — regenerating (${direction}, target ${target} words)`
    );

    const correction = `IMPORTANT: Your previous response was ${currentCount} words. It must be ${target} words (between ${MIN_WORDS} and ${MAX_WORDS} words total). Write it ${direction}.`;
    text = await generate(correction);
    wordCount = countWords(text);

    // Log if still out of range after retry (don't fail — accept it)
    if (wordCount < MIN_WORDS || wordCount > MAX_WORDS) {
      console.warn(
        `[generateReviewResponses] ${variantLabel} still ${wordCount} words after retry — accepting as-is`
      );
    }
  }

  return { text, word_count: wordCount };
}

/**
 * Generates all 3 variants for a single review.
 * @param {object} review
 * @param {string} systemPrompt
 * @param {string} reviewId - Identifier for the review (index-based or UUID)
 * @returns {Promise<Array<{variant_label, response_text, word_count, reviewer_first_name}>>}
 */
async function generateVariantsForReview(review, systemPrompt, reviewId) {
  const firstName = extractFirstName(review.reviewer_name);
  const variants = [];

  for (const variantLabel of VARIANT_LABELS) {
    const userPrompt = buildUserPrompt(review, variantLabel);

    try {
      const { text, word_count } = await generateSingleVariant(
        systemPrompt,
        userPrompt,
        review,
        variantLabel
      );

      variants.push({
        review_id: reviewId,
        variant_label: variantLabel,
        response_text: text,
        word_count,
        reviewer_first_name: firstName,
      });
    } catch (err) {
      console.error(
        `[generateReviewResponses] Failed to generate ${variantLabel} for review ${reviewId}:`,
        err.message
      );
      // Don't throw — skip this variant and continue
    }
  }

  return variants;
}

/**
 * Stores a single review response variant as a deliverable row in Supabase.
 *
 * @param {string} propertyId
 * @param {string} ownerId
 * @param {object} payload - { review_id, variant_label, response_text, word_count, reviewer_first_name }
 * @returns {Promise<object>} - The inserted deliverable row
 */
async function storeDeliverable(propertyId, ownerId, payload) {
  const { data, error } = await supabase
    .from('deliverables')
    .insert({
      property_id: propertyId,
      owner_id: ownerId,
      type: 'review_response',
      status: 'ready',
      payload,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to store deliverable: ${error.message}`);
  }

  return data;
}

/**
 * Fetches the property record from Supabase.
 * @param {string} propertyId
 * @returns {Promise<object>}
 */
async function fetchProperty(propertyId) {
  const { data, error } = await supabase
    .from('properties')
    .select('id, owner_id, listing_url, scraped_data, recent_reviews')
    .eq('id', propertyId)
    .single();

  if (error) {
    throw new Error(`Property not found: ${error.message}`);
  }

  return data;
}

/**
 * Fetches the voice profile for an owner, if one exists.
 * Returns null if not found (triggers friendly/professional fallback).
 * @param {string} ownerId
 * @returns {Promise<object|null>}
 */
async function fetchVoiceProfile(ownerId) {
  const { data, error } = await supabase
    .from('voice_profiles')
    .select('*')
    .eq('owner_id', ownerId)
    .maybeSingle();

  if (error) {
    console.warn(`[generateReviewResponses] Could not fetch voice profile: ${error.message}`);
    return null;
  }

  return data || null;
}

/**
 * Stores scraped reviews back to the property record as JSONB.
 * @param {string} propertyId
 * @param {Array} reviews
 */
async function persistReviewsToProperty(propertyId, reviews) {
  const { error } = await supabase
    .from('properties')
    .update({ recent_reviews: reviews, reviews_scraped_at: new Date().toISOString() })
    .eq('id', propertyId);

  if (error) {
    console.warn(`[generateReviewResponses] Could not persist reviews to property: ${error.message}`);
  }
}

/**
 * Main pipeline entry point.
 *
 * Reads an owner's recent Airbnb reviews (scraping the public listing page),
 * generates 3 response drafts per review using the owner's voice profile,
 * and writes each draft as a `deliverable` record of type `review_response`
 * with status `ready`.
 *
 * @param {string} propertyId - UUID of the property in the `properties` table
 * @param {object} [options]
 * @param {boolean} [options.forceRescrape=false] - Re-scrape even if reviews exist on property
 * @param {Array} [options.reviewsFixture] - Override scraped reviews (for testing)
 * @returns {Promise<{
 *   property_id: string,
 *   reviews_processed: number,
 *   deliverables_created: number,
 *   deliverables: Array,
 *   used_voice_profile: boolean,
 *   skipped: boolean,
 *   skip_reason?: string
 * }>}
 */
export async function generateReviewResponses(propertyId, options = {}) {
  const { forceRescrape = false, reviewsFixture = null } = options;

  console.info(`[generateReviewResponses] Starting pipeline for property ${propertyId}`);

  // 1. Fetch property record
  const property = await fetchProperty(propertyId);
  const ownerId = property.owner_id;

  // 2. Get reviews — use fixture, existing scraped data, or scrape fresh
  let reviews;

  if (reviewsFixture) {
    console.info(`[generateReviewResponses] Using reviews fixture (${reviewsFixture.length} reviews)`);
    reviews = reviewsFixture;
  } else if (!forceRescrape && property.recent_reviews && property.recent_reviews.length > 0) {
    console.info(
      `[generateReviewResponses] Using ${property.recent_reviews.length} cached reviews from property record`
    );
    reviews = property.recent_reviews;
  } else {
    const listingUrl =
      property.listing_url ||
      property.scraped_data?.url ||
      property.scraped_data?.listing_url;

    if (!listingUrl) {
      return {
        property_id: propertyId,
        reviews_processed: 0,
        deliverables_created: 0,
        deliverables: [],
        used_voice_profile: false,
        skipped: true,
        skip_reason: 'No listing URL available for scraping',
      };
    }

    console.info(`[generateReviewResponses] Scraping reviews from ${listingUrl}`);
    reviews = await scrapeAirbnbReviews(listingUrl, {
      propertyId,
      useFallback: true,
    });

    // Persist scraped reviews to the property record
    if (reviews.length > 0) {
      await persistReviewsToProperty(propertyId, reviews);
    }
  }

  if (!reviews || reviews.length === 0) {
    return {
      property_id: propertyId,
      reviews_processed: 0,
      deliverables_created: 0,
      deliverables: [],
      used_voice_profile: false,
      skipped: true,
      skip_reason: 'No reviews found',
    };
  }

  // 3. Fetch owner voice profile
  const voiceProfile = await fetchVoiceProfile(ownerId);
  const usedVoiceProfile = voiceProfile !== null;
  console.info(
    `[generateReviewResponses] Voice profile: ${usedVoiceProfile ? 'found' : 'not found — using default'}`
  );

  // 4. Build system prompt
  const systemPrompt = buildSystemPrompt(voiceProfile);

  // 5. Process each review
  const allDeliverables = [];
  const reviewsToProcess = reviews.slice(0, 10); // Safety cap at 10

  for (let i = 0; i < reviewsToProcess.length; i++) {
    const review = reviewsToProcess[i];
    const reviewId = `review_${i + 1}`;

    console.info(
      `[generateReviewResponses] Processing review ${i + 1}/${reviewsToProcess.length} from ${review.reviewer_name}`
    );

    // Generate 3 variants
    const variants = await generateVariantsForReview(review, systemPrompt, reviewId);

    // Store each variant as a deliverable
    for (const payload of variants) {
      try {
        const deliverable = await storeDeliverable(propertyId, ownerId, payload);
        allDeliverables.push(deliverable);
      } catch (err) {
        console.error(
          `[generateReviewResponses] Failed to store deliverable for ${payload.variant_label}:`,
          err.message
        );
      }
    }
  }

  console.info(
    `[generateReviewResponses] Pipeline complete. Created ${allDeliverables.length} deliverables for ${reviewsToProcess.length} reviews.`
  );

  return {
    property_id: propertyId,
    reviews_processed: reviewsToProcess.length,
    deliverables_created: allDeliverables.length,
    deliverables: allDeliverables,
    used_voice_profile: usedVoiceProfile,
    skipped: false,
  };
}
