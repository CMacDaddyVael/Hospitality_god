import * as cheerio from 'cheerio'

export type PageData = {
  url: string
  html: string
  $: ReturnType<typeof cheerio.load>
  statusCode: number
  headers: Record<string, string>
  loadTimeMs: number
  isAirbnb: boolean
  isVrbo: boolean
  isDirectSite: boolean
  title: string | null
  metaDescription: string | null
  bodyText: string
  error?: string
}

export async function fetchPageData(url: string): Promise<PageData> {
  const isAirbnb = url.includes('airbnb.com')
  const isVrbo = url.includes('vrbo.com') || url.includes('homeaway.com')
  const isDirectSite = !isAirbnb && !isVrbo

  const start = Date.now()

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; HospitalityGodBot/1.0; +https://hospitalitygod.com/bot)',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
      },
    }).finally(() => clearTimeout(timeout))

    const loadTimeMs = Date.now() - start
    const html = await response.text()
    const $ = cheerio.load(html)

    // Extract headers
    const headers: Record<string, string> = {}
    response.headers.forEach((value, key) => {
      headers[key] = value
    })

    // Extract key meta info
    const title = $('title').first().text().trim() || null
    const metaDescription =
      $('meta[name="description"]').attr('content')?.trim() ||
      $('meta[property="og:description"]').attr('content')?.trim() ||
      null

    // Extract visible body text (strip scripts/styles)
    $('script, style, nav, footer, header').remove()
    const bodyText = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 10000)

    return {
      url,
      html,
      $,
      statusCode: response.status,
      headers,
      loadTimeMs,
      isAirbnb,
      isVrbo,
      isDirectSite,
      title,
      metaDescription,
      bodyText,
    }
  } catch (error: any) {
    const loadTimeMs = Date.now() - start
    const $ = cheerio.load('')

    return {
      url,
      html: '',
      $,
      statusCode: 0,
      headers: {},
      loadTimeMs,
      isAirbnb,
      isVrbo,
      isDirectSite,
      title: null,
      metaDescription: null,
      bodyText: '',
      error: error.message,
    }
  }
}

export async function checkUrl(url: string): Promise<{ exists: boolean; statusCode: number }> {
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; HospitalityGodBot/1.0)',
      },
      signal: AbortSignal.timeout(5000),
    })
    return { exists: response.ok, statusCode: response.status }
  } catch {
    return { exists: false, statusCode: 0 }
  }
}
