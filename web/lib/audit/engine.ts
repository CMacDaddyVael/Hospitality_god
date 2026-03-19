import { analyzeSEO } from './analyzers/seo'
import { analyzeGEO } from './analyzers/geo'
import { analyzeContent } from './analyzers/content'
import { analyzeCompetitive } from './analyzers/competitive'
import { fetchPageData, PageData } from './fetcher'
import { generateAuditReport } from './report-generator'
import type { AuditResults } from './types'

export async function runAudit(url: string): Promise<AuditResults> {
  console.log(`[Audit] Starting audit for: ${url}`)

  // Fetch page data first — everything else depends on it
  const pageData = await fetchPageData(url)

  // Run analyzers in parallel
  const [seo, geo, content] = await Promise.all([
    analyzeSEO(url, pageData),
    analyzeGEO(url, pageData),
    analyzeContent(url, pageData),
  ])

  // Competitive analysis (runs independently, lower priority)
  const competitive = await analyzeCompetitive(url, pageData).catch((err) => {
    console.warn('[Audit] Competitive analysis failed, skipping:', err.message)
    return null
  })

  // Generate the final report with Claude
  const report = await generateAuditReport({ url, pageData, seo, geo, content, competitive })

  const overallScore = Math.round(
    (seo.score * 0.35 + geo.score * 0.30 + content.score * 0.35)
  )

  return {
    url,
    overallScore,
    grade: scoreToGrade(overallScore),
    seo,
    geo,
    content,
    competitive,
    report,
    analyzedAt: new Date().toISOString(),
  }
}

export function scoreToGrade(score: number): string {
  if (score >= 90) return 'A'
  if (score >= 80) return 'B'
  if (score >= 70) return 'C'
  if (score >= 60) return 'D'
  return 'F'
}
