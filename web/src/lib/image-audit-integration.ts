/**
 * Image Audit Integration Helper
 *
 * Wraps the image-audit API internal logic for use inside the main audit pipeline.
 * Runs image analysis in parallel with scoring, merges results, and surfaces
 * top issues as Claude prompt context.
 *
 * Per issue #110: additive only — does not modify the image-audit module itself.
 */

export interface PhotoAuditResult {
  url: string
  score: number // 0–100
  flags: PhotoFlag[]
}

export interface PhotoFlag {
  type: 'lighting' | 'composition' | 'subject_quality' | 'resolution' | 'clutter' | 'other'
  severity: 'low' | 'medium' | 'high'
  message: string
}

export interface ImageAuditOutput {
  photos: PhotoAuditResult[]
  averageScore: number
  topIssues: string[] // top 2 human-readable issues for Claude prompt
  timedOut: boolean
}

const IMAGE_AUDIT_TIMEOUT_MS = 8000

/**
 * Analyze up to 10 photos from the listing.
 * Returns a structured ImageAuditOutput even on timeout (graceful degradation).
 */
export async function runImageAudit(
  photoUrls: string[],
  baseUrl: string
): Promise<ImageAuditOutput> {
  const urlsToAudit = photoUrls.slice(0, 10)

  if (urlsToAudit.length === 0) {
    return {
      photos: [],
      averageScore: 0,
      topIssues: [],
      timedOut: false,
    }
  }

  const timeoutPromise = new Promise<null>((resolve) =>
    setTimeout(() => resolve(null), IMAGE_AUDIT_TIMEOUT_MS)
  )

  try {
    const auditPromise = callImageAuditEndpoint(urlsToAudit, baseUrl)
    const result = await Promise.race([auditPromise, timeoutPromise])

    if (result === null) {
      // Timed out
      console.warn('[ImageAudit] Timed out after 8s — continuing with count-only photo scoring')
      return {
        photos: [],
        averageScore: 0,
        topIssues: [],
        timedOut: true,
      }
    }

    return result
  } catch (err) {
    console.warn('[ImageAudit] Failed — continuing with count-only photo scoring:', err)
    return {
      photos: [],
      averageScore: 0,
      topIssues: [],
      timedOut: false,
    }
  }
}

/**
 * Calls the image audit endpoint internally.
 * We call our own API route to avoid duplicating the image analysis logic.
 */
async function callImageAuditEndpoint(
  photoUrls: string[],
  baseUrl: string
): Promise<ImageAuditOutput> {
  const response = await fetch(`${baseUrl}/api/image-audit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ photoUrls }),
  })

  if (!response.ok) {
    throw new Error(`Image audit API returned ${response.status}`)
  }

  const data = await response.json()

  // Normalize the response from the image-audit route into our internal shape
  return normalizeImageAuditResponse(data, photoUrls)
}

/**
 * Normalizes the image-audit API response into our standard ImageAuditOutput shape.
 * Handles variations in the upstream response format gracefully.
 */
function normalizeImageAuditResponse(
  data: Record<string, unknown>,
  originalUrls: string[]
): ImageAuditOutput {
  // The image-audit route may return { results: [...] } or { photos: [...] }
  const rawPhotos =
    (data.results as PhotoAuditResult[] | undefined) ||
    (data.photos as PhotoAuditResult[] | undefined) ||
    []

  const photos: PhotoAuditResult[] = rawPhotos.map((p, i) => ({
    url: p.url || originalUrls[i] || '',
    score: typeof p.score === 'number' ? Math.max(0, Math.min(100, p.score)) : 50,
    flags: Array.isArray(p.flags) ? p.flags : [],
  }))

  const averageScore =
    photos.length > 0
      ? Math.round(photos.reduce((sum, p) => sum + p.score, 0) / photos.length)
      : 0

  // Build top 2 issues for Claude prompt — prioritize high severity flags
  const allFlags: Array<{ message: string; severity: string; photoIndex: number }> = []
  photos.forEach((photo, idx) => {
    photo.flags.forEach((flag) => {
      allFlags.push({ message: flag.message, severity: flag.severity, photoIndex: idx + 1 })
    })
  })

  // Sort: high > medium > low
  const severityOrder = { high: 0, medium: 1, low: 2 }
  allFlags.sort(
    (a, b) =>
      (severityOrder[a.severity as keyof typeof severityOrder] ?? 3) -
      (severityOrder[b.severity as keyof typeof severityOrder] ?? 3)
  )

  const topIssues = allFlags.slice(0, 2).map((f) => `Photo ${f.photoIndex}: ${f.message}`)

  return { photos, averageScore, topIssues, timedOut: false }
}

/**
 * Merges image audit results into the Photos category score.
 *
 * Photo count scoring (baseline): if ≥20 photos → 100, if <5 → 20, linear in between.
 * Image quality score (from audit): weighted 60% quality, 40% count.
 *
 * If image audit timed out or returned no photos, falls back to count-only scoring.
 */
export function mergePhotoScore(
  photoCount: number,
  imageAuditResult: ImageAuditOutput
): number {
  const countScore = calculateCountScore(photoCount)

  // If no quality data available, use count-only
  if (imageAuditResult.timedOut || imageAuditResult.photos.length === 0) {
    return countScore
  }

  // Blend: 40% count (you have enough photos), 60% quality (they're actually good)
  const blended = Math.round(countScore * 0.4 + imageAuditResult.averageScore * 0.6)
  return Math.max(0, Math.min(100, blended))
}

/**
 * Returns a 0–100 score based purely on photo count.
 */
function calculateCountScore(count: number): number {
  if (count >= 20) return 100
  if (count <= 0) return 0
  if (count < 5) return Math.round((count / 5) * 20)
  // Linear from 5 → 20 photos maps to 20 → 100
  return Math.round(20 + ((count - 5) / 15) * 80)
}

/**
 * Builds the image-specific context string to inject into the Claude summary prompt.
 * Returns empty string if no issues found (don't pollute prompt with nothing useful).
 */
export function buildImageAuditPromptContext(imageAuditResult: ImageAuditOutput): string {
  if (imageAuditResult.timedOut || imageAuditResult.topIssues.length === 0) {
    return ''
  }

  const lines = [
    'Photo quality analysis identified these specific issues:',
    ...imageAuditResult.topIssues.map((issue) => `  - ${issue}`),
  ]

  return lines.join('\n')
}
