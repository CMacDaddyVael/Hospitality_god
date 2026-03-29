import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = createServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { property_id, edited_listing } = await req.json()

    if (!property_id) {
      return NextResponse.json({ error: 'property_id is required' }, { status: 400 })
    }

    // Verify ownership
    const { data: property, error: propError } = await supabase
      .from('properties')
      .select('id, user_id, optimized_listing')
      .eq('id', property_id)
      .eq('user_id', user.id)
      .single()

    if (propError || !property) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 })
    }

    if (!property.optimized_listing) {
      return NextResponse.json({ error: 'No optimized listing to approve' }, { status: 400 })
    }

    // If owner edited the listing before approving, merge edits
    const finalListing = edited_listing
      ? { ...property.optimized_listing, ...edited_listing }
      : property.optimized_listing

    const now = new Date().toISOString()

    const { error: updateError } = await supabase
      .from('properties')
      .update({
        optimized_listing: finalListing,
        optimization_approved: true,
        optimization_approved_at: now,
        optimization_approved_by: user.id,
        // Push optimized values to live fields
        title: finalListing.title,
        description: finalListing.description,
      })
      .eq('id', property_id)

    if (updateError) {
      throw new Error(updateError.message)
    }

    // Mark the most recent listing_optimization task as complete
    await supabase
      .from('agent_tasks')
      .update({ status: 'approved' })
      .eq('property_id', property_id)
      .eq('task_type', 'listing_optimization')
      .eq('status', 'complete')
      .order('completed_at', { ascending: false })
      .limit(1)

    return NextResponse.json({ success: true, listing: finalListing })
  } catch (err: any) {
    console.error('Listing approve error:', err)
    return NextResponse.json({ error: err.message || 'Approval failed' }, { status: 500 })
  }
}
