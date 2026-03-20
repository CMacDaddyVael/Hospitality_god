/**
 * Review Response Generation Pipeline
 * Generates owner-voiced AI responses to guest reviews using Claude
 */

import Anthropic from '@anthropic-ai/sdk';
import type { ReviewResponseMetadata } from '../db/deliverables';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

export type ReviewInput = {
  text: string;
  rating: number;
  guestName?: string;
  date?: string;
};

export type VoiceProfile = {
  tone?: 'casual' | 'professional' | 'warm' | 'luxury';
  signOffName?: string;
  alwaysUse?: string;
  neverUse?: string;
  personalityNotes?: string;
};

export type ResponseVariant = 'warm' | 'professional';

export type GeneratedResponse = {
  responseText: string;
  sourceReview: string;
  reviewRating: number;
  reviewClassification: 'positive' | 'neutral' | 'negative';
  variant: ResponseVariant;
  voiceProfileApplied: boolean;
  voiceProfileMissing: boolean;
  wordCount: number;
  generatedAt: string;
};

function classifyReview(rating: number): 'positive' | 'neutral' | 'negative' {
  if (rating >= 4) return 'positive';
  if (rating === 3) return 'neutral';
  return 'negative';
}

function needsEmpathyOpener(rating: number): boolean {
  return rating <= 3;
}

function buildSystemPrompt(voiceProfile: VoiceProfile | null): string {
  if (!voiceProfile) {
    return `You are a professional short-term rental host writing responses to guest reviews on Airbnb.
Your tone is warm, professional, and grateful. You write concisely and authentically.
Keep all responses under 150 words. Sound like a real human host, not a robot or a PR department.`;
  }

  const { tone, signOffName, alwaysUse, neverUse, personalityNotes } = voiceProfile;

  const lines = [
    `You are a short-term rental host writing responses to guest reviews on Airbnb.`,
    `Write in this owner's authentic voice with these characteristics:`,
    ``,
    `Tone: ${tone || 'warm-professional'}`,
    signOffName ? `Sign-off name: ${signOffName}` : null,
    alwaysUse ? `Always include these elements: ${alwaysUse}` : null,
    neverUse ? `Never say or use: ${neverUse}` : null,
    personalityNotes ? `Personality notes: ${personalityNotes}` : null,
    ``,
    `Keep all responses under 150 words. Sound like a real human host, not a robot.`,
    `Do not use corporate-speak or generic filler phrases.`,
  ].filter((l) => l !== null);

  return lines.join('\n');
}

function buildUserPrompt(
  review: ReviewInput,
  variant: ResponseVariant,
  isNegative: boolean
): string {
  const variantInstruction =
    variant === 'warm'
      ? 'Write in a warm, personal, and heartfelt style. Show genuine appreciation and personal connection.'
      : 'Write in a polished, professional style. Be appreciative but concise and businesslike.';

  const sentimentInstruction = isNegative
    ? `This is a ${review.rating <= 2 ? 'negative' : 'neutral'} review. 
Start with a brief, sincere empathy opener that genuinely acknowledges the guest's experience — do NOT be defensive or make excuses. 
Then address the specific concern constructively (what you're doing about it or why it happened). 
End on a positive, forward-looking note that expresses hope to improve or make things right.`
    : `This is a positive review. Express genuine gratitude. Reference something specific from their review if possible. End warmly.`;

  const guestLabel = review.guestName ? `Guest: ${review.guestName}` : '';
  const dateLabel = review.date ? `Date: ${review.date}` : '';
  const contextLines = [guestLabel, dateLabel].filter(Boolean).join(' | ');

  return `Write a host response to the following Airbnb guest review.

${sentimentInstruction}

${variantInstruction}

REVIEW (${review.rating} star${review.rating !== 1 ? 's' : ''}):${contextLines ? `\n${contextLines}` : ''}
"${review.text}"

Requirements:
- Under 150 words (this is a hard limit)
- Sound authentic and human — not templated or corporate
- Do NOT start with "Thank you for your review" or "Thank you for staying with us"
- Do NOT use more than one exclamation point in the entire response
- For positive reviews: end with a warm invitation to return
- For negative/neutral reviews: end with genuine hope to serve them better or make it right

Write ONLY the response text. No preamble, no explanation, no quotes around it.`;
}

/**
 * Generate a single review response via Claude
 */
async function generateSingleResponse(
  review: ReviewInput,
  voiceProfile: VoiceProfile | null,
  variant: ResponseVariant
): Promise<string> {
  const isNegative = needsEmpathyOpener(review.rating);
  const systemPrompt = buildSystemPrompt(voiceProfile);
  const userPrompt = buildUserPrompt(review, variant, isNegative);

  const message = await anthropic.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 400,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: userPrompt,
      },
    ],
  });

  const content = message.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude');
  }

  return content.text.trim();
}

/**
 * Generate responses for multiple reviews
 * Returns one GeneratedResponse per review (up to 5)
 */
export async function generateReviewResponses(
  reviews: ReviewInput[],
  voiceProfile: VoiceProfile | null,
  variant: ResponseVariant = 'warm'
): Promise<GeneratedResponse[]> {
  // Cap at 5 reviews per AC
  const reviewsToProcess = reviews.slice(0, 5);
  const voiceProfileMissing = !voiceProfile;
  const generatedAt = new Date().toISOString();

  // Generate responses in parallel for speed
  const results = await Promise.allSettled(
    reviewsToProcess.map(async (review) => {
      const responseText = await generateSingleResponse(review, voiceProfile, variant);
      const classification = classifyReview(review.rating);
      const wordCount = responseText.split(/\s+/).filter(Boolean).length;

      const generated: GeneratedResponse = {
        responseText,
        sourceReview: review.text,
        reviewRating: review.rating,
        reviewClassification: classification,
        variant,
        voiceProfileApplied: !voiceProfileMissing,
        voiceProfileMissing,
        wordCount,
        generatedAt,
      };

      return generated;
    })
  );

  // Collect successes, throw on total failure
  const successes: GeneratedResponse[] = [];
  const errors: string[] = [];

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === 'fulfilled') {
      successes.push(result.value);
    } else {
      errors.push(`Review ${i + 1}: ${result.reason?.message || 'Unknown error'}`);
    }
  }

  if (successes.length === 0) {
    throw new Error(`All review response generations failed:\n${errors.join('\n')}`);
  }

  return successes;
}
