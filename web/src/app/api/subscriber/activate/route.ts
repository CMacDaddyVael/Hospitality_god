import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Valid module identifiers
const VALID_MODULES = [
  'social',
  'listing_optimization',
  'review_responses',
  'seasonal_updates',
  'seo_geo',
  'guest_messages',
  'competitive_analysis',
] as const

type ValidModule = (typeof VALID_MODULES)[number]

interface ActivateRequestBody {
  subscriber_id: string
  preferences: {
    modules: string[]
    properties: string[]
    voice_sample?: string
  }
}

export async function POST(req: NextRequest) {
  try {
    const body: ActivateRequestBody = await req.json()
    const { subscriber_id, preferences } = body

    // --- Validate inputs ---
    if (!subscriber_id || typeof subscriber_id !== 'string') {
      return NextResponse.json(
        { error: 'subscriber_id is required and must be a string' },
        { status: 400 }
      )
    }

    if (!preferences || typeof preferences !== 'object') {
      return NextResponse.json(
        { error: 'preferences object is required' },
        { status: 400 }
      )
    }

    if (!Array.isArray(preferences.modules) || preferences.modules.length === 0) {
      return NextResponse.json(
        { error: 'preferences.modules must be a non-empty array' },
        { status: 400 }
      )
    }

    if (!Array.isArray(preferences.properties) || preferences.properties.length === 0) {
      return NextResponse.json(
        { error: 'preferences.properties must be a non-empty array' },
        { status: 400 }
      )
    }

    // Validate module names
    const invalidModules = preferences.modules.filter(
      (m) => !VALID_MODULES.includes(m as ValidModule)
    )
    if (invalidModules.length > 0) {
      return NextResponse.json(
        {
          error: `Invalid modules: ${invalidModules.join(', ')}. Valid modules are: ${VALID_MODULES.join(', ')}`,
        },
        { status: 400 }
      )
    }

    // Validate property URLs
    const invalidUrls = preferences.properties.filter((url) => {
      try {
        new URL(url)
        return false
      } catch {
        return true
      }
    })
    if (invalidUrls.length > 0) {
      return NextResponse.json(
        { error: `Invalid property URLs: ${invalidUrls.join(', ')}` },
        { status: 400 }
      )
    }

    // --- Upsert subscriber preferences (idempotent) ---
    const { data: existingPrefs, error: fetchError } = await supabase
      .from('subscriber_preferences')
      .select('subscriber_id, created_at')
      .eq('subscriber_id', subscriber_id)
      .maybeSingle()

    if (fetchError) {
      console.error('[activate] Error fetching existing preferences:', fetchError)
      return NextResponse.json(
        { error: 'Database error while checking existing preferences' },
        { status: 500 }
      )
    }

    const now = new Date().toISOString()
    const prefsPayload = {
      subscriber_id,
      modules: preferences.modules,
      property_urls: preferences.properties,
      voice_sample: preferences.voice_sample ?? null,
      updated_at: now,
      ...(existingPrefs ? {} : { created_at: now }),
    }

    const { error: upsertError } = await supabase
      .from('subscriber_preferences')
      .upsert(prefsPayload, { onConflict: 'subscriber_id' })

    if (upsertError) {
      console.error('[activate] Error upserting preferences:', upsertError)
      return NextResponse.json(
        { error: 'Failed to save subscriber preferences' },
        { status: 500 }
      )
    }

    const isFirstActivation = !existingPrefs

    // --- Enqueue immediate jobs (idempotent via trigger check) ---
    const enqueuedJobs = await enqueueActivationJobs(
      subscriber_id,
      preferences.modules as ValidModule[],
      preferences.properties,
      isFirstActivation
    )

    return NextResponse.json(
      {
        success: true,
        subscriber_id,
        is_first_activation: isFirstActivation,
        modules_activated: preferences.modules,
        jobs_enqueued: enqueuedJobs,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('[activate] Unhandled error:', error)
    return NextResponse.json(
      { error: 'Internal server error during activation' },
      { status: 500 }
    )
  }
}

/**
 * Enqueues one weekly job batch per selected module.
 * Idempotent: skips modules that already have a pending immediate_activation job
 * for this subscriber (prevents duplicates on double-call).
 */
async function enqueueActivationJobs(
  subscriberId: string,
  modules: ValidModule[],
  propertyUrls: string[],
  isFirstActivation: boolean
): Promise<number> {
  // If not first activation, check for existing pending immediate_activation jobs
  // to maintain idempotency
  let alreadyEnqueued: Set<string> = new Set()

  if (!isFirstActivation) {
    const { data: existingJobs, error: jobFetchError } = await supabase
      .from('jobs')
      .select('module')
      .eq('subscriber_id', subscriberId)
      .eq('trigger', 'immediate_activation')
      .eq('status', 'pending')

    if (jobFetchError) {
      console.error('[activate] Error checking existing jobs:', jobFetchError)
      // Non-fatal — continue but log it
    } else if (existingJobs) {
      alreadyEnqueued = new Set(existingJobs.map((j) => j.module))
    }
  }

  const now = new Date().toISOString()
  const jobsToInsert = []

  for (const module of modules) {
    if (alreadyEnqueued.has(module)) {
      console.log(
        `[activate] Skipping duplicate job for subscriber=${subscriberId} module=${module}`
      )
      continue
    }

    for (const propertyUrl of propertyUrls) {
      jobsToInsert.push({
        subscriber_id: subscriberId,
        module,
        property_url: propertyUrl,
        cadence: 'weekly',
        trigger: 'immediate_activation',
        status: 'pending',
        created_at: now,
        scheduled_for: now, // Run immediately, not at next cron cycle
      })
    }
  }

  if (jobsToInsert.length === 0) {
    return 0
  }

  const { error: insertError } = await supabase.from('jobs').insert(jobsToInsert)

  if (insertError) {
    console.error('[activate] Error inserting jobs:', insertError)
    // Non-fatal — preferences were saved; jobs can be retried
    return 0
  }

  return jobsToInsert.length
}
