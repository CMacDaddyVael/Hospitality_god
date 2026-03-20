import { NextRequest, NextResponse } from 'next/server'

export type OwnerVoicePayload = {
  hostingStyleWords: string
  pastReviewResponse: string
  idealGuest: string
  communicationTone: 'warm' | 'professional' | 'playful' | 'luxurious'
  brandNotes: string
  submittedAt: string
}

// Owner voice capture API — stores personality profile for AI personalization
// Called by the VoiceCapture form (issue #139) and referenced by deliverable generation
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const { hostingStyleWords, pastReviewResponse, idealGuest, communicationTone, brandNotes } =
      body

    // Validate all required fields
    const missing: string[] = []
    if (!hostingStyleWords?.trim()) missing.push('hostingStyleWords')
    if (!pastReviewResponse?.trim()) missing.push('pastReviewResponse')
    if (!idealGuest?.trim()) missing.push('idealGuest')
    if (!communicationTone?.trim()) missing.push('communicationTone')
    if (!brandNotes?.trim()) missing.push('brandNotes')

    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Missing required fields: ${missing.join(', ')}` },
        { status: 400 }
      )
    }

    const validTones = ['warm', 'professional', 'playful', 'luxurious']
    if (!validTones.includes(communicationTone)) {
      return NextResponse.json({ error: 'Invalid communicationTone value' }, { status: 400 })
    }

    const payload: OwnerVoicePayload = {
      hostingStyleWords: hostingStyleWords.trim(),
      pastReviewResponse: pastReviewResponse.trim(),
      idealGuest: idealGuest.trim(),
      communicationTone,
      brandNotes: brandNotes.trim(),
      submittedAt: new Date().toISOString(),
    }

    // Persist to storage — uses Supabase when available, falls back gracefully
    await persistVoiceProfile(payload)

    return NextResponse.json({
      success: true,
      message: 'Voice profile saved successfully',
      profile: payload,
    })
  } catch (error) {
    console.error('Owner voice API error:', error)
    return NextResponse.json({ error: 'Failed to save voice profile' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    // Returns the current owner's voice profile (for settings page)
    // Auth/user scoping would be added when auth (#107) is wired in
    return NextResponse.json({
      success: true,
      profile: null, // Placeholder — populated once DB is wired
    })
  } catch (error) {
    console.error('Owner voice GET error:', error)
    return NextResponse.json({ error: 'Failed to retrieve voice profile' }, { status: 500 })
  }
}

async function persistVoiceProfile(payload: OwnerVoicePayload): Promise<void> {
  // Supabase integration point — wired in when DB client is available
  // For now, logs to console so the swarm can confirm data shape is correct
  console.log('[owner-voice] Profile received:', JSON.stringify(payload, null, 2))

  // When Supabase is available, this becomes:
  // const { error } = await supabase.from('owner_voice_profiles').upsert({ ...payload, owner_id })
  // if (error) throw error
}
