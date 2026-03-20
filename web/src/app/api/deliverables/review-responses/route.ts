/**
 * POST /api/deliverables/review-responses
 *
 * Accepts a property_id and either:
 *   a) Pulls reviews from stored audit data
 *   b) Accepts manually pasted review texts (up to 5)
 *
 * Generates AI-drafted responses in the owner's voice and writes them
 * to the deliverables table as pending_approval items.
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateReviewResponses, type ReviewInput, type ResponseVariant } from '@/lib/ai/review-response-generator';
import { createDeliverables } from '@/lib/db/deliverables';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function getSupabase() {
  return createClient(supabaseUrl, supabaseKey);
}

/**
 * Attempt to fetch voice profile from the properties/onboarding data
 */
async function fetchVoiceProfile(propertyId: string) {
  const supabase = getSupabase();

  // Try to get voice data from properties table (stored during onboarding)
  const { data: property, error } = await supabase
    .from('properties')
    .select('voice_profile, onboarding_data')
    .eq('id', propertyId)
    .single();

  if (error || !property) {
    return null;
  }

  // Check dedicated voice_profile column first
  if (property.voice_profile && typeof property.voice_profile === 'object') {
    return property.voice_profile;
  }

  // Fall back to onboarding_data.voice
  if (property.onboarding_data?.voice) {
    return property.onboarding_data.voice;
  }

  return null;
}

/**
 * Attempt to fetch recent reviews from stored audit data
 */
async function fetchReviewsFromAudit(propertyId: string): Promise<ReviewInput[]> {
  const supabase = getSupabase();

  const { data: property, error } = await supabase
    .from('properties')
    .select('audit_data, onboarding_data')
    .eq('id', propertyId)
    .single();

  if (error || !property) {
    return [];
  }

  // Check audit_data for reviews
  const auditReviews = property.audit_data?.reviews || property.onboarding_data?.listing?.reviews || [];

  if (!Array.isArray(auditReviews) || auditReviews.length === 0) {
    return [];
  }

  // Normalize to ReviewInput format, take the 5 most recent
  return auditReviews
    .slice(0, 5)
    .map((r: { text?: string; comment?: string; rating?: number; stars?: number; date?: string; reviewer_name?: string; guestName?: string }) => ({
      text: r.text || r.comment || '',
      rating: r.rating || r.stars || 5,
      date: r.date,
      guestName: r.reviewer_name || r.guestName,
    }))
    .filter((r: ReviewInput) => r.text.trim().length > 0);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      property_id,
      reviews: manualReviews,
      variant = 'warm',
    } = body as {
      property_id: string;
      reviews?: Array<{ text: string; rating: number; guestName?: string; date?: string }>;
      variant?: ResponseVariant;
    };

    // --- Validate inputs ---
    if (!property_id) {
      return NextResponse.json({ error: 'property_id is required' }, { status: 400 });
    }

    if (!['warm', 'professional'].includes(variant)) {
      return NextResponse.json(
        { error: 'variant must be "warm" or "professional"' },
        { status: 400 }
      );
    }

    // --- Determine which reviews to process ---
    let reviewsToProcess: ReviewInput[] = [];

    if (manualReviews && Array.isArray(manualReviews) && manualReviews.length > 0) {
      // Manual reviews provided — validate and cap at 5
      if (manualReviews.length > 5) {
        return NextResponse.json(
          { error: 'Maximum of 5 reviews can be submitted at once' },
          { status: 400 }
        );
      }

      for (const r of manualReviews) {
        if (!r.text || typeof r.text !== 'string' || r.text.trim().length === 0) {
          return NextResponse.json(
            { error: 'Each review must have a non-empty "text" field' },
            { status: 400 }
          );
        }
        if (typeof r.rating !== 'number' || r.rating < 1 || r.rating > 5) {
          return NextResponse.json(
            { error: 'Each review must have a "rating" between 1 and 5' },
            { status: 400 }
          );
        }
      }

      reviewsToProcess = manualReviews.slice(0, 5);
    } else {
      // Try to pull reviews from stored audit data
      reviewsToProcess = await fetchReviewsFromAudit(property_id);

      if (reviewsToProcess.length === 0) {
        return NextResponse.json(
          {
            error:
              'No reviews found for this property. Please paste review texts manually using the "reviews" field.',
          },
          { status: 422 }
        );
      }
    }

    // --- Fetch voice profile ---
    const voiceProfile = await fetchVoiceProfile(property_id);

    // --- Generate responses via Claude ---
    let generatedResponses;
    try {
      generatedResponses = await generateReviewResponses(reviewsToProcess, voiceProfile, variant);
    } catch (genError: unknown) {
      console.error('Review response generation failed:', genError);
      return NextResponse.json(
        {
          error: 'Failed to generate review responses. Please try again.',
          detail: genError instanceof Error ? genError.message : String(genError),
        },
        { status: 500 }
      );
    }

    // --- Write deliverables to DB ---
    const deliverableInputs = generatedResponses.map((resp, i) => {
      const ratingLabel =
        resp.reviewRating === 5
          ? '⭐⭐⭐⭐⭐'
          : resp.reviewRating === 4
          ? '⭐⭐⭐⭐'
          : resp.reviewRating === 3
          ? '⭐⭐⭐'
          : resp.reviewRating === 2
          ? '⭐⭐'
          : '⭐';

      const classificationLabel =
        resp.reviewClassification === 'positive'
          ? 'Positive'
          : resp.reviewClassification === 'neutral'
          ? 'Neutral'
          : 'Needs Attention';

      return {
        property_id,
        type: 'review_response' as const,
        status: 'pending_approval' as const,
        title: `Review Response ${i + 1} — ${ratingLabel} ${classificationLabel}`,
        content: resp.responseText,
        metadata: {
          sourceReview: resp.sourceReview,
          reviewRating: resp.reviewRating,
          reviewClassification: resp.reviewClassification,
          variant: resp.variant,
          voiceProfileApplied: resp.voiceProfileApplied,
          voiceProfileMissing: resp.voiceProfileMissing,
          wordCount: resp.wordCount,
          generatedAt: resp.generatedAt,
        },
      };
    });

    let createdDeliverables;
    try {
      createdDeliverables = await createDeliverables(deliverableInputs);
    } catch (dbError: unknown) {
      console.error('Failed to save deliverables:', dbError);
      return NextResponse.json(
        {
          error: 'Generated responses but failed to save them. Please try again.',
          detail: dbError instanceof Error ? dbError.message : String(dbError),
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      count: createdDeliverables.length,
      deliverables: createdDeliverables,
      voiceProfileApplied: !!(voiceProfile),
      voiceProfileMissing: !voiceProfile,
    });
  } catch (error: unknown) {
    console.error('Review response pipeline error:', error);
    return NextResponse.json(
      { error: 'Internal server error', detail: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
