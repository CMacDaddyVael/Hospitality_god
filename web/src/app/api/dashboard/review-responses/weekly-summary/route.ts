import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * GET /api/dashboard/review-responses/weekly-summary
 * Returns count of new review responses generated this week — used in the weekly email brief.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 })
    }

    // Get start of current week (Monday)
    const now = new Date()
    const dayOfWeek = now.getDay() // 0 = Sunday
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() - daysToMonday)
    weekStart.setHours(0, 0, 0, 0)

    const { data, error } = await supabase
      .from('content')
      .select('id, is_negative, sentiment, created_at')
      .eq('user_id', userId)
      .eq('type', 'review_response')
      .gte('created_at', weekStart.toISOString())

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch weekly summary' }, { status: 500 })
    }

    const total = data?.length || 0
    const negative = data?.filter((d) => d.is_negative).length || 0
    const positive = data?.filter((d) => d.sentiment === 'positive').length || 0
    const neutral = data?.filter((d) => d.sentiment === 'neutral').length || 0

    return NextResponse.json({
      success: true,
      summary: {
        total,
        positive,
        neutral,
        negative,
        weekStart: weekStart.toISOString(),
        // Pre-formatted for use in email brief
        emailLine:
          total === 0
            ? null
            : total === 1
            ? `We drafted 1 review response for you this week.`
            : `We drafted ${total} review responses for you this week.`,
      },
    })
  } catch (error) {
    console.error('[weekly-summary] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
