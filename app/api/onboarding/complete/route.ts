import { NextRequest, NextResponse } from 'next/server'
import { triggerAgentTasks } from '@/lib/agent-tasks'
import { saveOnboardingProgress } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { sessionId, onboardingData } = body

    if (!sessionId || !onboardingData) {
      return NextResponse.json({ error: 'Missing required data' }, { status: 400 })
    }

    // Mark onboarding as complete
    await saveOnboardingProgress(sessionId, 'complete', {
      completedAt: new Date().toISOString(),
      ...onboardingData,
    })

    // Trigger all agent tasks in parallel (non-blocking)
    triggerAgentTasks(sessionId, onboardingData).catch((err) => {
      console.error('Agent task error:', err)
    })

    return NextResponse.json({
      success: true,
      message: 'Onboarding complete! Your agent is starting up.',
      redirectTo: `/dashboard?session=${sessionId}`,
    })
  } catch (error) {
    console.error('Complete onboarding error:', error)
    return NextResponse.json({ error: 'Failed to complete onboarding' }, { status: 500 })
  }
}
