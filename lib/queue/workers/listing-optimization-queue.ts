/**
 * Queue job type constants and registration for listing-optimization worker.
 * Integrates with the existing queue system in lib/queue/.
 */

import { handleListingOptimizationJob } from './listing-optimization'
import type { PropertyObject, AuditScoreBreakdown } from './listing-optimization'

export const LISTING_OPTIMIZATION_JOB_TYPE = 'listing_optimization' as const

export interface ListingOptimizationJobPayload {
  property: PropertyObject
  audit: AuditScoreBreakdown
  sessionId?: string
  propertyId?: string
}

/**
 * Register the listing-optimization handler with the queue executor.
 * Call this from lib/queue/workers/index.ts registration.
 */
export function registerListingOptimizationWorker(
  registerFn: (jobType: string, handler: (data: unknown) => Promise<void>) => void
): void {
  registerFn(
    LISTING_OPTIMIZATION_JOB_TYPE,
    async (data: unknown) => {
      const payload = data as ListingOptimizationJobPayload
      await handleListingOptimizationJob(payload)
    }
  )
}
