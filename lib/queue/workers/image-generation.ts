/**
 * Queue worker for VAEL lifestyle image generation
 * Handles async generation jobs with retry logic
 */

import type { Job } from '../types'

export interface ImageGenerationJob {
  propertyId: string
  property: {
    title?: string
    propertyType?: string
    location?: string
    amenities?: string[]
    photos?: string[]
  }
  season?: string
  scenes?: Array<{ scene: string; sourceImageUrl?: string }>
  triggeredBy?: 'onboarding' | 'seasonal_rotation' | 'manual'
}

export async function processImageGenerationJob(job: Job<ImageGenerationJob>): Promise<void> {
  const { propertyId, property, season, scenes, triggeredBy } = job.data

  console.log(`[image-generation] Starting job for property ${propertyId}, triggered by: ${triggeredBy}`)

  // Dynamic import to avoid issues with ES module
  const { generateSeasonalBatch, getCurrentSeason, SCENE_TYPES } = await import(
    '../../ai/image-gen/vael-hospitality.mjs'
  )

  const targetSeason = season || getCurrentSeason()

  // Default scenes if none specified — pick scenes appropriate for the property
  const targetScenes = scenes || buildDefaultScenes(property)

  const { results, errors } = await generateSeasonalBatch({
    propertyId,
    property,
    season: targetSeason,
    scenes: targetScenes,
    concurrency: 2,
  })

  console.log(`[image-generation] Complete: ${results.length} generated, ${errors.length} errors`)

  if (errors.length > 0) {
    console.warn('[image-generation] Errors:', errors)
  }

  // Update job status in DB
  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  await supabase
    .from('image_generation_jobs')
    .update({
      status: errors.length === targetScenes.length ? 'failed' : 'completed',
      completed_at: new Date().toISOString(),
      results_count: results.length,
      errors: errors.length > 0 ? errors : null,
    })
    .eq('property_id', propertyId)
    .eq('status', 'running')
}

function buildDefaultScenes(property: ImageGenerationJob['property']) {
  const amenities = (property?.amenities || []).map((a: string) => a.toLowerCase())
  const photos = property?.photos || []

  const scenes: Array<{ scene: string; sourceImageUrl?: string }> = []

  // Always include these universal scenes
  scenes.push({ scene: 'cozy_reading', sourceImageUrl: photos[0] })
  scenes.push({ scene: 'wine_evening', sourceImageUrl: photos[0] })

  // Conditional scenes based on amenities
  if (amenities.some(a => a.includes('pool') || a.includes('hot_tub'))) {
    scenes.push({ scene: 'friends_pool', sourceImageUrl: findPhotoForScene(photos, 'pool') })
  }

  if (amenities.some(a => a.includes('balcony') || a.includes('patio') || a.includes('deck'))) {
    scenes.push({ scene: 'couple_coffee', sourceImageUrl: findPhotoForScene(photos, 'balcon') })
    scenes.push({ scene: 'sunset_drinks', sourceImageUrl: findPhotoForScene(photos, 'patio') })
  }

  if (amenities.some(a => a.includes('kitchen'))) {
    scenes.push({ scene: 'family_kitchen', sourceImageUrl: findPhotoForScene(photos, 'kitchen') })
  }

  if (amenities.some(a => a.includes('fireplace'))) {
    scenes.push({ scene: 'solo_fireplace', sourceImageUrl: findPhotoForScene(photos, 'living') })
  }

  if (amenities.some(a => a.includes('bbq') || a.includes('grill'))) {
    scenes.push({ scene: 'bbq_patio', sourceImageUrl: findPhotoForScene(photos, 'patio') })
  }

  if (amenities.some(a => a.includes('yard') || a.includes('garden') || a.includes('backyard'))) {
    scenes.push({ scene: 'kids_backyard', sourceImageUrl: findPhotoForScene(photos, 'yard') })
  }

  // Cap at 6 scenes for cost management
  return scenes.slice(0, 6)
}

function findPhotoForScene(photos: string[], keyword: string): string | undefined {
  if (!photos.length) return undefined
  // Try to find a photo URL that contains the keyword (rough heuristic)
  const match = photos.find(p => p.toLowerCase().includes(keyword))
  return match || photos[0]
}
