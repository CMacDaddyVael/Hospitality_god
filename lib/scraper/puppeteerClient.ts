/**
 * Puppeteer browser management for the Vercel serverless environment.
 *
 * We use `puppeteer-core` + `@sparticuz/chromium` which bundles a lightweight
 * Chromium binary compatible with AWS Lambda / Vercel lambda environments
 * (no native binary size issues that block deployment).
 *
 * In local development, puppeteer-core falls back to the locally installed
 * Chrome/Chromium via PUPPETEER_EXECUTABLE_PATH env var.
 */

import type { Browser, Page } from 'puppeteer-core'

let _browser: Browser | null = null

/**
 * Returns a Chromium executablePath appropriate for the current environment.
 * Vercel / AWS Lambda: uses @sparticuz/chromium
 * Local dev: uses PUPPETEER_EXECUTABLE_PATH env var or falls back to standard paths
 */
async function getExecutablePath(): Promise<string> {
  // Prefer explicit env override (useful in CI and local dev)
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return process.env.PUPPETEER_EXECUTABLE_PATH
  }

  // Serverless / Lambda environment
  if (process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.VERCEL) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const chromium = require('@sparticuz/chromium')
      return await chromium.executablePath()
    } catch {
      // @sparticuz/chromium not installed — fall through to local paths
    }
  }

  // Common local Chrome paths as fallback
  const { existsSync } = await import('fs')
  const localPaths = [
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  ]
  for (const p of localPaths) {
    if (existsSync(p)) return p
  }

  throw new Error(
    'No Chromium executable found. Set PUPPETEER_EXECUTABLE_PATH or install @sparticuz/chromium.'
  )
}

/**
 * Launch (or reuse) a Puppeteer browser instance.
 * We reuse across calls within the same serverless function invocation.
 */
export async function getBrowser(): Promise<Browser> {
  if (_browser && _browser.connected) return _browser

  const puppeteer = (await import('puppeteer-core')).default
  const executablePath = await getExecutablePath()

  // Pick args: if @sparticuz/chromium is available, use its recommended args
  let args: string[] = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--no-first-run',
    '--no-zygote',
    '--disable-gpu',
    '--single-process',
    '--disable-extensions',
  ]

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const chromium = require('@sparticuz/chromium')
    args = chromium.args ?? args
  } catch {
    // use defaults above
  }

  _browser = await puppeteer.launch({
    executablePath,
    args,
    headless: true,
    defaultViewport: { width: 1280, height: 800 },
  })

  return _browser
}

/**
 * Open a new page with sensible defaults for scraping.
 */
export async function openPage(browser: Browser): Promise<Page> {
  const page = await browser.newPage()

  // Mimic a real browser UA
  await page.setUserAgent(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ' +
      'AppleWebKit/537.36 (KHTML, like Gecko) ' +
      'Chrome/122.0.0.0 Safari/537.36'
  )

  // Abort image / font / media requests to speed up load
  await page.setRequestInterception(true)
  page.on('request', (req) => {
    const type = req.resourceType()
    if (['image', 'media', 'font'].includes(type)) {
      req.abort()
    } else {
      req.continue()
    }
  })

  // Accept language header
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-US,en;q=0.9',
  })

  return page
}

/**
 * Gracefully close the browser.
 * Call this in tests or at the end of a long-running process.
 */
export async function closeBrowser(): Promise<void> {
  if (_browser) {
    await _browser.close().catch(() => {})
    _browser = null
  }
}
