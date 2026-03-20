import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    throw new Error('Missing Supabase environment variables')
  }

  return createClient(url, serviceKey)
}

// GET /api/deliverables — fetch pending deliverables for the authenticated user's properties
export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseClient()

    // Get owner_id from query param (passed by client after auth check)
    const { searchParams } = new URL(req.url)
    const ownerId = searchParams.get('owner_id')

    if (!ownerId) {
      return NextResponse.json({ error: 'owner_id is required' }, { status: 400 })
    }

    // Fetch properties for this owner
    const { data: properties, error: propError } = await supabase
      .from('properties')
      .select('id, name, airbnb_url')
      .eq('owner_id', ownerId)

    if (propError) {
      console.error('Error fetching properties:', propError)
      return NextResponse.json({ error: 'Failed to fetch properties' }, { status: 500 })
    }

    if (!properties || properties.length === 0) {
      return NextResponse.json({ deliverables: [], properties: [] })
    }

    const propertyIds = properties.map((p: { id: string }) => p.id)

    // Fetch pending deliverables for all owner's properties
    const { data: deliverables, error: delError } = await supabase
      .from('deliverables')
      .select('*')
      .in('property_id', propertyIds)
      .eq('status', 'pending_review')
      .order('created_at', { ascending: false })

    if (delError) {
      console.error('Error fetching deliverables:', delError)
      return NextResponse.json({ error: 'Failed to fetch deliverables' }, { status: 500 })
    }

    // Attach property info to each deliverable
    const propertyMap = Object.fromEntries(
      properties.map((p: { id: string; name: string; airbnb_url: string }) => [p.id, p])
    )

    const enriched = (deliverables || []).map((d: Record<string, unknown>) => ({
      ...d,
      property: propertyMap[d.property_id as string] || null,
    }))

    return NextResponse.json({ deliverables: enriched, properties })
  } catch (error) {
    console.error('Deliverables GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/deliverables — approve a deliverable (update status to 'approved')
export async function PATCH(req: NextRequest) {
  try {
    const supabase = getSupabaseClient()
    const body = await req.json()
    const { id, owner_id, edited_content } = body

    if (!id || !owner_id) {
      return NextResponse.json({ error: 'id and owner_id are required' }, { status: 400 })
    }

    // Verify ownership before updating: deliverable must belong to one of owner's properties
    const { data: properties, error: propError } = await supabase
      .from('properties')
      .select('id')
      .eq('owner_id', owner_id)

    if (propError || !properties || properties.length === 0) {
      return NextResponse.json({ error: 'No properties found for owner' }, { status: 403 })
    }

    const propertyIds = properties.map((p: { id: string }) => p.id)

    // Build update payload
    const updatePayload: Record<string, unknown> = {
      status: 'approved',
      approved_at: new Date().toISOString(),
    }

    // If the owner edited the content before approving, persist their edits
    if (edited_content !== undefined && edited_content !== null) {
      updatePayload.approved_content = edited_content
    }

    const { data, error } = await supabase
      .from('deliverables')
      .update(updatePayload)
      .eq('id', id)
      .in('property_id', propertyIds)
      .select()
      .single()

    if (error) {
      console.error('Error approving deliverable:', error)
      return NextResponse.json({ error: 'Failed to approve deliverable' }, { status: 500 })
    }

    return NextResponse.json({ success: true, deliverable: data })
  } catch (error) {
    console.error('Deliverables PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
