import { NextRequest, NextResponse } from 'next/server'
import { saveOnboardingProgress } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { sessionId, step, data } = body

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 })
    }

    await saveOnboardingProgress(sessionId, step, data)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Save progress error:', error)
    return NextResponse.json({ error: 'Failed to save progress' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const sessionId = searchParams.get('sessionId')

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 })
    }

    const { getOnboardingProgress } = await import('@/lib/db')
    const progress = await getOnboardingProgress(sessionId)
    return NextResponse.json({ success: true, progress })
  } catch (error) {
    console.error('Get progress error:', error)
    return NextResponse.json({ error: 'Failed to get progress' }, { status: 500 })
  }
}
