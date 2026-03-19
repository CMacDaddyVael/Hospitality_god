/**
 * Worker registry — maps task_type to worker function.
 * Add new workers here as features are built.
 */

import type { TaskType } from '../types';
import type { WorkerContext, TaskResult } from '../types';
import { runListingAnalysis } from './listing-analysis';
import { runReviewResponse } from './review-response';
import { runGuestMessage } from './guest-message';
import { runSocialPost } from './social-post';
import { runHealthScore } from './health-score';

type WorkerFn = (ctx: WorkerContext) => Promise<TaskResult>;

export const WORKERS: Record<TaskType, WorkerFn> = {
  listing_analysis: runListingAnalysis,
  review_response: runReviewResponse,
  guest_message: runGuestMessage,
  social_post: runSocialPost,
  health_score: runHealthScore,
};

export { runListingAnalysis, runReviewResponse, runGuestMessage, runSocialPost, runHealthScore };
