import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { optimizeListing } from '@agents/listing-optimizer'

export async function POST(req: NextRequest) {
  try {
    const supabase = createServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { property_id } = await req.json()

    if (!property_id) {
      return NextResponse.json({ error: 'property_id is required' }, { status: 400 })
    }

    // Verify user owns the property
    const { data: property, error } = await supabase
      .from('properties')
      .select('id, user_id')
      .eq('id', property_id)
      .eq('user_id', user.id)
      .single()

    if (error || !property) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 })
    }

    const result = await optimizeListing(property_id)

    return NextResponse.json({ success: true, result })
  } catch (err: any) {
    console.error('Listing optimize error:', err)
    return NextResponse.json({ error: err.message || 'Optimization failed' }, { status: 500 })
  }
}
