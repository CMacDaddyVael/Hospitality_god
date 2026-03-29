import { NextRequest, NextResponse } from 'next/server'
import { sendWeeklyBriefs } from '@/lib/email/weekly-brief'

// This endpoint can be called by Vercel cron or manually
// Vercel cron config is in vercel.json
export async function POST(req: NextRequest) {
  try {
    // Verify cron secret to prevent unauthorized calls
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await sendWeeklyBriefs()

    return NextResponse.json({
      success: true,
      ...result,
    })
  } catch (error) {
    console.error('Weekly brief send error:', error)
    return NextResponse.json(
      { error: 'Failed to send weekly briefs', details: String(error) },
      { status: 500 }
    )
  }
}

// Allow GET for health checks / manual triggers in dev
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await sendWeeklyBriefs()
  return NextResponse.json({ success: true, ...result })
}
