import type { PageData } from '../fetcher'
import type { SEOResults, AuditItem } from '../types'
import { scoreToGrade } from '../engine'
import { checkUrl } from '../fetcher'

export async function analyzeSEO(url: string, pageData: PageData): Promise<SEOResults> {
  const items: AuditItem[] = []
  const { $, html, headers, loadTimeMs, isDirectSite } = pageData

  // ── Meta Title ────────────────────────────────────────────────────
  const titleText = pageData.title
  const titleLength = titleText?.length ?? 0
  const metaTitleStatus =
    !titleText ? 'fail' : titleLength < 30 || titleLength > 60 ? 'warning' : 'pass'

  items.push({
    id: 'meta-title',
    title: 'Meta Title',
    status: metaTitleStatus,
    description: !titleText
      ? 'No meta title found — this is critical for search rankings.'
      : titleLength > 60
      ? `Title is ${titleLength} characters (optimal: 50-60). Google will truncate it.`
      : titleLength < 30
      ? `Title is only ${titleLength} characters. Add more descriptive keywords.`
      : `Title looks good at ${titleLength} characters.`,
    recommendation: !titleText
      ? 'Add a compelling meta title with your property name, location, and key amenity (e.g., "Oceanfront Cabin in Big Sur | Private Hot Tub & Chef\'s Kitchen").'
      : titleLength > 60
      ? 'Shorten your title to under 60 characters while keeping the most important keywords.'
      : undefined,
    impact: 'Optimizing your meta title can improve click-through rates from search by 20-30%.',
    canAutoFix: true,
    priority: metaTitleStatus === 'fail' ? 'critical' : 'high',
  })

  // ── Meta Description ──────────────────────────────────────────────
  const descText = pageData.metaDescription
  const descLength = descText?.length ?? 0
  const descStatus =
    !descText ? 'fail' : descLength < 100 || descLength > 160 ? 'warning' : 'pass'

  items.push({
    id: 'meta-description',
    title: 'Meta Description',
    status: descStatus,
    description: !descText
      ? 'No meta description found. Google will auto-generate one, which is usually poor.'
      : descLength > 160
      ? `Description is ${descLength} characters (optimal: 120-160). It will be cut off in search results.`
      : descLength < 100
      ? `Description is only ${descLength} characters — too short to be compelling.`
      : `Description is ${descLength} characters — good length.`,
    recommendation: !descText
      ? 'Write a compelling 120-160 character description that highlights your unique selling points and includes a call to action.'
      : undefined,
    impact: 'A compelling meta description can increase organic click-through rates by 15-25%.',
    canAutoFix: true,
    priority: descStatus === 'fail' ? 'critical' : 'medium',
  })

  // ── H1 Tags ───────────────────────────────────────────────────────
  const h1Tags = $('h1')
    .map((_, el) => $(el).text().trim())
    .get()
    .filter(Boolean)
  const h1Status = h1Tags.length === 0 ? 'fail' : h1Tags.length > 1 ? 'warning' : 'pass'

  items.push({
    id: 'h1-tags',
    title: 'H1 Heading',
    status: h1Status,
    description:
      h1Tags.length === 0
        ? 'No H1 heading found. Search engines use H1 to understand your page\'s main topic.'
        : h1Tags.length > 1
        ? `Found ${h1Tags.length} H1 headings. Pages should have exactly one H1.`
        : `H1 found: "${h1Tags[0]}"`,
    recommendation:
      h1Tags.length === 0
        ? 'Add a single H1 tag with your property name and location (e.g., "Luxury Beachfront Villa in Malibu, CA").'
        : h1Tags.length > 1
        ? 'Consolidate to a single H1 that clearly describes your property.'
        : undefined,
    impact: 'Proper H1 structure helps Google understand and rank your page for relevant searches.',
    canAutoFix: true,
    priority: h1Status === 'fail' ? 'critical' : 'medium',
  })

  // ── H2 Tags ───────────────────────────────────────────────────────
  const h2Tags = $('h2')
    .map((_, el) => $(el).text().trim())
    .get()
    .filter(Boolean)
  const h2Status = h2Tags.length === 0 ? 'warning' : 'pass'

  items.push({
    id: 'h2-tags',
    title: 'Heading Structure (H2/H3)',
    status: h2Status,
    description:
      h2Tags.length === 0
        ? 'No H2 subheadings found. Good heading structure helps both SEO and readability.'
        : `Found ${h2Tags.length} H2 headings — good structure.`,
    recommendation:
      h2Tags.length === 0
        ? 'Add H2 headings for key sections: amenities, location, nearby attractions, booking info.'
        : undefined,
    canAutoFix: true,
    priority: 'medium',
  })

  // ── Image Alt Tags ────────────────────────────────────────────────
  const allImages = $('img').get()
  const imagesWithoutAlt = allImages.filter(
    (img) => !$(img).attr('alt') || $(img).attr('alt')?.trim() === ''
  )
  const altStatus =
    allImages.length === 0
      ? 'warning'
      : imagesWithoutAlt.length === 0
      ? 'pass'
      : imagesWithoutAlt.length > allImages.length * 0.5
      ? 'fail'
      : 'warning'

  items.push({
    id: 'image-alt',
    title: 'Image Alt Tags',
    status: altStatus,
    description:
      allImages.length === 0
        ? 'No images found on this page.'
        : `${imagesWithoutAlt.length} of ${allImages.length} images are missing alt text.`,
    recommendation:
      imagesWithoutAlt.length > 0
        ? 'Add descriptive alt text to all images (e.g., "Ocean view from master bedroom deck" instead of "img_001.jpg"). This helps Google image search and accessibility.'
        : undefined,
    impact: 'Image optimization can drive 5-15% additional traffic via Google Image Search.',
    canAutoFix: true,
    priority: altStatus === 'fail' ? 'high' : 'medium',
  })

  // ── SSL Certificate ───────────────────────────────────────────────
  const hasSSL = url.startsWith('https://')
  items.push({
    id: 'ssl',
    title: 'SSL Certificate (HTTPS)',
    status: hasSSL ? 'pass' : 'fail',
    description: hasSSL
      ? 'Site is served over HTTPS — good.'
      : 'Site is not using HTTPS. This is a critical security and ranking issue.',
    recommendation: !hasSSL
      ? 'Enable HTTPS immediately. Contact your hosting provider — most offer free SSL via Let\'s Encrypt.'
      : undefined,
    impact: 'HTTPS is a confirmed Google ranking signal. Sites without it rank lower and show security warnings.',
    canAutoFix: false,
    priority: hasSSL ? 'low' : 'critical',
  })

  // ── Sitemap ───────────────────────────────────────────────────────
  const origin = new URL(url).origin
  const sitemapCheck = await checkUrl(`${origin}/sitemap.xml`)
  const hasSitemap = sitemapCheck.exists

  items.push({
    id: 'sitemap',
    title: 'XML Sitemap',
    status: hasSitemap ? 'pass' : 'warning',
    description: hasSitemap
      ? 'XML sitemap found at /sitemap.xml'
      : 'No XML sitemap found. Google needs this to efficiently crawl your site.',
    recommendation: !hasSitemap
      ? 'Create and submit an XML sitemap to Google Search Console. Most website platforms can generate this automatically.'
      : undefined,
    canAutoFix: true,
    priority: 'medium',
  })

  // ── Robots.txt ────────────────────────────────────────────────────
  const robotsCheck = await checkUrl(`${origin}/robots.txt`)
  const hasRobotstxt = robotsCheck.exists

  items.push({
    id: 'robots',
    title: 'Robots.txt',
    status: hasRobotsxt ? 'pass' : 'warning',
    description: hasRobotsxt
      ? 'robots.txt found'
      : 'No robots.txt file found.',
    recommendation: !hasRobotsxt
      ? 'Add a robots.txt file to control how search engines crawl your site.'
      : undefined,
    canAutoFix: true,
    priority: 'low',
  })

  // ── Page Load Time ────────────────────────────────────────────────
  const loadStatus =
    loadTimeMs < 2000 ? 'pass' : loadTimeMs < 4000 ? 'warning' : 'fail'

  items.push({
    id: 'load-speed',
    title: 'Page Load Speed',
    status: loadStatus,
    description:
      loadTimeMs < 2000
        ? `Page loaded in ${(loadTimeMs / 1000).toFixed(1)}s — fast!`
        : loadTimeMs < 4000
        ? `Page loaded in ${(loadTimeMs / 1000).toFixed(1)}s — needs improvement. Google recommends under 2.5s.`
        : `Page loaded in ${(loadTimeMs / 1000).toFixed(1)}s — critically slow. This is hurting your rankings.`,
    recommendation:
      loadStatus !== 'pass'
        ? 'Compress images, enable browser caching, use a CDN, and minimize CSS/JS. Consider upgrading your hosting.'
        : undefined,
    impact: 'Reducing load time to under 2.5s can improve conversions by 15% and rankings significantly.',
    canAutoFix: false,
    priority: loadStatus === 'fail' ? 'high' : 'medium',
  })

  // ── URL Structure ─────────────────────────────────────────────────
  const urlObj = new URL(url)
  const hasCleanUrl = !urlObj.search || urlObj.search === '?'
  const urlStatus = hasCleanUrl ? 'pass' : 'warning'

  items.push({
    id: 'url-structure',
    title: 'URL Structure',
    status: urlStatus,
    description: hasCleanUrl
      ? 'URL structure looks clean.'
      : `URL contains query parameters (${urlObj.search}). Clean URLs rank better.`,
    canAutoFix: false,
    priority: 'low',
  })

  // ── Internal Links ────────────────────────────────────────────────
  const internalLinks = $('a[href]')
    .get()
    .filter((el) => {
      const href = $(el).attr('href') || ''
      return (
        href.startsWith('/') ||
        href.startsWith(origin) ||
        (!href.startsWith('http') && !href.startsWith('mailto') && !href.startsWith('#'))
      )
    }).length

  const externalLinks = $('a[href^="http"]')
    .get()
    .filter((el) => {
      const href = $(el).attr('href') || ''
      return !href.startsWith(origin)
    }).length

  const linkStatus = internalLinks < 3 ? 'warning' : 'pass'
  items.push({
    id: 'internal-links',
    title: 'Internal Linking',
    status: linkStatus,
    description:
      internalLinks < 3
        ? `Only ${internalLinks} internal links found. Good internal linking helps search engines discover all your pages.`
        : `${internalLinks} internal links found — good.`,
    recommendation:
      internalLinks < 3
        ? 'Add internal links to your amenities page, location guide, and booking page. Link from blog posts to your booking page.'
        : undefined,
    canAutoFix: false,
    priority: 'medium',
  })

  // ── Canonical URL ─────────────────────────────────────────────────
  const canonicalUrl = $('link[rel="canonical"]').attr('href') || null
  items.push({
    id: 'canonical',
    title: 'Canonical URL',
    status: canonicalUrl ? 'pass' : 'warning',
    description: canonicalUrl
      ? `Canonical URL set to: ${canonicalUrl}`
      : 'No canonical URL tag found. This can cause duplicate content issues.',
    canAutoFix: true,
    priority: 'low',
  })

  // ── Score Calculation ─────────────────────────────────────────────
  const weights: Record<string, number> = {
    'meta-title': 15,
    'meta-description': 12,
    'h1-tags': 10,
    ssl: 15,
    'load-speed': 12,
    'image-alt': 8,
    sitemap: 5,
    'h2-tags': 5,
    'internal-links': 5,
    'url-structure': 5,
    canonical: 4,
    robots: 4,
  }

  let totalWeight = 0
  let weightedScore = 0
  for (const item of items) {
    const w = weights[item.id] || 3
    totalWeight += w
    const pts = item.status === 'pass' ? 100 : item.status === 'warning' ? 60 : 20
    weightedScore += pts * w
  }
  const score = Math.round(weightedScore / totalWeight)

  return {
    score,
    grade: scoreToGrade(score),
    items,
    summary: buildSEOSummary(score, items),
    metaTitle: {
      value: titleText,
      length: titleLength,
      status: metaTitleStatus,
    },
    metaDescription: {
      value: descText,
      length: descLength,
      status: descStatus,
    },
    h1Tags,
    h2Tags,
    imageAltMissing: imagesWithoutAlt.length,
    imageAltTotal: allImages.length,
    hasSSL,
    hasSitemap,
    hasRobotsxt,
    loadTime: loadTimeMs,
    mobileScore: null, // Would need Lighthouse for real scores
    desktopScore: null,
    canonicalUrl,
    internalLinks,
    externalLinks,
  }
}

function buildSEOSummary(score: number, items: AuditItem[]): string {
  const fails = items.filter((i) => i.status === 'fail').length
  const warnings = items.filter((i) => i.status === 'warning').length
  if (fails > 3)
    return `Critical SEO issues found. Your site has ${fails} failing checks that are significantly harming your Google rankings.`
  if (fails > 0)
    return `SEO needs work. ${fails} critical issues and ${warnings} warnings are preventing you from ranking well.`
  if (warnings > 3)
    return `SEO is functional but has ${warnings} areas that could be improved to boost rankings.`
  return 'SEO fundamentals are solid. Focus on content quality to reach the next level.'
}
