import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-helpers'
import { createErrorResponse } from '@/lib/api-helpers'
import { moduleSettings } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function GET(_request: NextRequest) {
  try {
    const { user, withRLS } = await getAuthenticatedUser()
    if (!user || !withRLS) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const data = await withRLS((db) =>
      db.select({ settings: moduleSettings.settings })
        .from(moduleSettings)
        .where(eq(moduleSettings.moduleId, 'negotiation-prep-room'))
        .limit(1)
    )

    return NextResponse.json(data[0]?.settings || {})
  } catch (error) {
    console.error('GET /api/modules/negotiation-prep-room/settings error:', error instanceof Error ? error.message : error)
    return createErrorResponse('Internal server error', 500)
  }
}
