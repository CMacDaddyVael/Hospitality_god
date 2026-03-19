/**
 * Worker: health_score
 * Calculates the listing health score for the dashboard.
 */

import type { WorkerContext, TaskResult } from '../types';

export async function runHealthScore(ctx: WorkerContext): Promise<TaskResult> {
  const { task } = ctx;
  const { listing_ids } = task.payload as {
    listing_ids?: string[];
  };

  console.log(`[health_score] Calculating health score for property ${task.property_id}`);

  // TODO: aggregate data from listing_analysis tasks, review sentiment, occupancy data
  // TODO: store result in property_health_scores table

  const scores = (listing_ids ?? []).map((id) => ({
    listing_id: id,
    score: Math.floor(Math.random() * 30) + 70, // 70-100
    factors: {
      photo_quality: 85,
      description_completeness: 90,
      response_rate: 95,
      review_sentiment: 88,
      pricing_competitiveness: 72,
    },
  }));

  const result = {
    property_id: task.property_id,
    calculated_at: new Date().toISOString(),
    overall_score: scores.reduce((acc, s) => acc + s.score, 0) / Math.max(scores.length, 1),
    listings: scores,
  };

  return { success: true, data: result };
}
