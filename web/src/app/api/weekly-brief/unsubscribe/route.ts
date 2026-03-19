import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const token = searchParams.get('token')

    if (!token) {
      return new NextResponse(renderPage('Missing unsubscribe token.', false), {
        headers: { 'Content-Type': 'text/html' },
        status: 400,
      })
    }

    // Look up the user by their unsubscribe token
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, email_brief')
      .eq('unsubscribe_token', token)
      .single()

    if (error || !user) {
      return new NextResponse(renderPage('Invalid or expired unsubscribe link.', false), {
        headers: { 'Content-Type': 'text/html' },
        status: 404,
      })
    }

    if (!user.email_brief) {
      // Already unsubscribed
      return new NextResponse(
        renderPage("You're already unsubscribed from weekly briefs.", true),
        { headers: { 'Content-Type': 'text/html' } }
      )
    }

    // Set email_brief = false
    const { error: updateError } = await supabase
      .from('users')
      .update({ email_brief: false, updated_at: new Date().toISOString() })
      .eq('id', user.id)

    if (updateError) {
      console.error('Unsubscribe update error:', updateError)
      return new NextResponse(renderPage('Something went wrong. Please try again.', false), {
        headers: { 'Content-Type': 'text/html' },
        status: 500,
      })
    }

    return new NextResponse(
      renderPage(
        "You've been unsubscribed from weekly email briefs. Your subscription is still active — you'll still get your deliverables on the dashboard.",
        true
      ),
      { headers: { 'Content-Type': 'text/html' } }
    )
  } catch (error) {
    console.error('Unsubscribe error:', error)
    return new NextResponse(renderPage('Something went wrong. Please try again.', false), {
      headers: { 'Content-Type': 'text/html' },
      status: 500,
    })
  }
}

function renderPage(message: string, success: boolean): string {
  const color = success ? '#10b981' : '#ef4444'
  const icon = success ? '✓' : '✗'

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Unsubscribe — Hospitality God</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #0f172a;
      color: #f1f5f9;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .card {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 16px;
      padding: 48px;
      max-width: 480px;
      width: 100%;
      text-align: center;
    }
    .icon {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      background: ${color}22;
      border: 2px solid ${color};
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 28px;
      color: ${color};
      margin: 0 auto 24px;
    }
    h1 { font-size: 22px; font-weight: 700; margin-bottom: 12px; }
    p { color: #94a3b8; line-height: 1.6; margin-bottom: 24px; }
    a {
      display: inline-block;
      background: #f59e0b;
      color: #0f172a;
      font-weight: 600;
      text-decoration: none;
      padding: 12px 28px;
      border-radius: 8px;
      font-size: 14px;
    }
    a:hover { background: #fbbf24; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${icon}</div>
    <h1>${success ? 'Unsubscribed' : 'Error'}</h1>
    <p>${message}</p>
    <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://hospitalitygod.com'}/dashboard">
      Go to Dashboard
    </a>
  </div>
</body>
</html>`
}
