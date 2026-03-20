import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Supabase client (service-role so we can upsert without RLS friction)
// ---------------------------------------------------------------------------
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error('Missing Supabase environment variables')
  }

  return createClient(url, key)
}

// ---------------------------------------------------------------------------
// Claude client
// ---------------------------------------------------------------------------
function getClaudeClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('Missing ANTHROPIC_API_KEY')
  return new Anthropic({ apiKey })
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface VoiceAnswers {
  q1: string
  q2: string
  q3: string
  q4: string
  q5: string
  q6?: string
  q7?: string
  [key: string]: string | undefined
}

interface VoiceProfileRow {
  id: string
  user_id: string
  raw_answers: VoiceAnswers
  profile_summary: string
  tone_tags: string[]
  created_at: string
  updated_at: string
}

interface ExtractedVoiceProfile {
  profile_summary: string
  tone_tags: string[]
}

// ---------------------------------------------------------------------------
// Claude extraction logic
// ---------------------------------------------------------------------------
async function extractVoiceProfile(answers: VoiceAnswers): Promise<ExtractedVoiceProfile> {
  const client = getClaudeClient()

  const answersText = Object.entries(answers)
    .filter(([, v]) => v && v.trim())
    .map(([k, v]) => `${k.toUpperCase()}: ${v}`)
    .join('\n\n')

  const prompt = `You are a brand voice analyst specializing in short-term rental hosts. Your task is to read a host's interview answers and extract a concise voice profile.

Here are the host's interview answers:

${answersText}

Based on these answers, produce a JSON object with exactly two fields:

1. "profile_summary": A 2–3 sentence description of this host's communication style, personality, and how they come across to guests. Write it in third person (e.g. "This host comes across as..."). Be specific — reference actual details from their answers. This will be injected into AI prompts to personalize all content generated for this host.

2. "tone_tags": An array of 3–5 single-word or short-phrase descriptors that capture their tone (e.g. ["warm", "witty", "laid-back", "coastal", "family-friendly"]). Choose tags that will help an AI writer match their voice. All lowercase.

Respond with ONLY valid JSON — no markdown, no explanation, no code fences. Example format:
{"profile_summary":"This host comes across as...","tone_tags":["warm","relaxed"]}`

  const message = await client.messages.create({
    model: 'claude-3-5-haiku-20241022',
    max_tokens: 512,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  })

  const rawText = message.content
    .filter((block) => block.type === 'text')
    .map((block) => (block as { type: 'text'; text: string }).text)
    .join('')
    .trim()

  let parsed: ExtractedVoiceProfile
  try {
    parsed = JSON.parse(rawText)
  } catch {
    // Attempt to extract JSON from inside the response if Claude added any surrounding text
    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error(`Claude returned non-JSON response: ${rawText.slice(0, 200)}`)
    }
    parsed = JSON.parse(jsonMatch[0])
  }

  if (typeof parsed.profile_summary !== 'string' || !Array.isArray(parsed.tone_tags)) {
    throw new Error('Claude response missing required fields: profile_summary or tone_tags')
  }

  // Normalize tone_tags — ensure all lowercase strings, max 5
  parsed.tone_tags = parsed.tone_tags
    .filter((t) => typeof t === 'string')
    .map((t) => t.toLowerCase().trim())
    .slice(0, 5)

  return parsed
}

// ---------------------------------------------------------------------------
// POST /api/onboarding/voice-profile
// Body: { userId: string, answers: VoiceAnswers }
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { userId, answers } = body as { userId?: string; answers?: VoiceAnswers }

    // --- Validate userId ---
    if (!userId || typeof userId !== 'string' || !userId.trim()) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    // --- Validate answers ---
    if (!answers || typeof answers !== 'object') {
      return NextResponse.json({ error: 'answers object is required' }, { status: 400 })
    }

    const requiredKeys = ['q1', 'q2', 'q3', 'q4', 'q5'] as const
    const missingKeys = requiredKeys.filter(
      (k) => !answers[k] || typeof answers[k] !== 'string' || !answers[k]!.trim()
    )

    if (missingKeys.length > 0) {
      return NextResponse.json(
        {
          error: `Minimum 5 answer fields required. Missing or empty: ${missingKeys.join(', ')}`,
        },
        { status: 400 }
      )
    }

    // --- Extract voice profile via Claude ---
    let extracted: ExtractedVoiceProfile
    try {
      extracted = await extractVoiceProfile(answers)
    } catch (claudeErr) {
      console.error('[voice-profile] Claude extraction failed:', claudeErr)
      return NextResponse.json(
        { error: 'Failed to analyze voice profile. Please try again.' },
        { status: 502 }
      )
    }

    // --- Upsert into Supabase ---
    const supabase = getSupabase()

    const { data, error: dbError } = await supabase
      .from('voice_profiles')
      .upsert(
        {
          user_id: userId.trim(),
          raw_answers: answers,
          profile_summary: extracted.profile_summary,
          tone_tags: extracted.tone_tags,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id',
          ignoreDuplicates: false,
        }
      )
      .select()
      .single()

    if (dbError) {
      console.error('[voice-profile] Supabase upsert error:', dbError)
      return NextResponse.json({ error: 'Failed to save voice profile' }, { status: 500 })
    }

    const profile = data as VoiceProfileRow

    return NextResponse.json(
      {
        success: true,
        profile: {
          id: profile.id,
          userId: profile.user_id,
          profileSummary: profile.profile_summary,
          toneTags: profile.tone_tags,
          createdAt: profile.created_at,
          updatedAt: profile.updated_at,
        },
      },
      { status: 200 }
    )
  } catch (err) {
    console.error('[voice-profile] POST error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// GET /api/onboarding/voice-profile?userId=X
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('userId')

    if (!userId || !userId.trim()) {
      return NextResponse.json({ error: 'userId query parameter is required' }, { status: 400 })
    }

    const supabase = getSupabase()

    const { data, error: dbError } = await supabase
      .from('voice_profiles')
      .select('*')
      .eq('user_id', userId.trim())
      .maybeSingle()

    if (dbError) {
      console.error('[voice-profile] Supabase fetch error:', dbError)
      return NextResponse.json({ error: 'Failed to fetch voice profile' }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ success: true, profile: null }, { status: 200 })
    }

    const profile = data as VoiceProfileRow

    return NextResponse.json(
      {
        success: true,
        profile: {
          id: profile.id,
          userId: profile.user_id,
          rawAnswers: profile.raw_answers,
          profileSummary: profile.profile_summary,
          toneTags: profile.tone_tags,
          createdAt: profile.created_at,
          updatedAt: profile.updated_at,
        },
      },
      { status: 200 }
    )
  } catch (err) {
    console.error('[voice-profile] GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
