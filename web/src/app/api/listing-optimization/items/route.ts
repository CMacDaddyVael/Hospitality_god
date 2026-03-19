/**
 * GET /api/listing-optimization/items?userId=...&propertyId=...
 *
 * Returns all listing optimization content items for a user/property.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('userId')
    const propertyId = searchParams.get('propertyId')

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    let query = supabase
      .from('content')
      .select('*')
      .eq('user_id', userId)
      .eq('type', 'listing_optimization')
      .order('created_at', { ascending: false })

    if (propertyId) {
      query = query.eq('property_id', propertyId)
    }

    const { data, error } = await query

    if (error) {
      console.error('[items] Supabase error:', error)
      return NextResponse.json({ error: 'Failed to fetch content items' }, { status: 500 })
    }

    // Also fetch regeneration counts for today
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)

    const contentIds = (data || []).map((item) => item.id)
    const regenCounts: Record<string, number> = {}

    if (contentIds.length > 0) {
      const { data: regenData } = await supabase
        .from('regeneration_log')
        .select('content_id')
        .in('content_id', contentIds)
        .gte('regenerated_at', startOfDay.toISOString())

      if (regenData) {
        regenData.forEach((row) => {
          regenCounts[row.content_id] = (regenCounts[row.content_id] || 0) + 1
        })
      }
    }

    const itemsWithRegenInfo = (data || []).map((item) => ({
      ...item,
      regenerationsUsedToday: regenCounts[item.id] || 0,
      regenerationsRemainingToday: Math.max(
        0,
        3 - (regenCounts[item.id] || 0)
      ),
    }))

    return NextResponse.json({ success: true, items: itemsWithRegenInfo })
  } catch (error) {
    console.error('[items] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
