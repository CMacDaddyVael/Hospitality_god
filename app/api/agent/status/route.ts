import { NextRequest, NextResponse } from 'next/server'
import { getAgentTasks } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const sessionId = searchParams.get('sessionId')

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 })
    }

    const tasks = await getAgentTasks(sessionId)
    return NextResponse.json({ success: true, tasks })
  } catch (error) {
    console.error('Agent status error:', error)
    return NextResponse.json({ error: 'Failed to get agent status' }, { status: 500 })
  }
}
