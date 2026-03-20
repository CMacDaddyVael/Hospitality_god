/**
 * Review Response Queue Worker
 *
 * Handles jobs with job_type = 'review_responses'.
 * Invoked by the generation queue executor when a review_responses job is dequeued.
 *
 * Expected job payload:
 *   { listingId: string, userId: string }
 */

import { generateReviewResponses } from '../../agents/review-response-agent'

export interface ReviewResponseJobPayload {
  listingId: string
  userId: string
}

export async function handleReviewResponseJob(
  payload: ReviewResponseJobPayload
): Promise<{ success: boolean; generated: number; errors: string[] }> {
  const { listingId, userId } = payload

  if (!listingId || !userId) {
    throw new Error(
      `Invalid review_responses payload — required fields missing. Received: ${JSON.stringify(payload)}`
    )
  }

  console.log(
    `[review-response-worker] Starting job: listing=${listingId} user=${userId}`
  )

  const result = await generateReviewResponses(listingId, userId)

  console.log(
    `[review-response-worker] Completed: generated=${result.generated} skipped=${result.skipped} errors=${result.errors.length}`
  )

  if (result.errors.length > 0) {
    console.warn('[review-response-worker] Non-fatal errors during generation:', result.errors)
  }

  return {
    success: result.success,
    generated: result.generated,
    errors: result.errors,
  }
}
