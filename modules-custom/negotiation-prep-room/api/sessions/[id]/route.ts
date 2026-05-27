import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-helpers'
import { createErrorResponse, toSnakeCase } from '@/lib/api-helpers'
import { negotiationSessions } from '../../../database/schema'
import { eq, and, sql } from 'drizzle-orm'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { user, withRLS } = await getAuthenticatedUser()
    if (!user || !withRLS) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const rows = await withRLS((db) =>
      db.select().from(negotiationSessions)
        .where(and(eq(negotiationSessions.id, id), eq(negotiationSessions.userId, user.id)))
        .limit(1)
    )

    if (rows.length === 0) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

    return NextResponse.json({ session: toSnakeCase(rows[0]) })
  } catch (error) {
    console.error('GET /api/modules/negotiation-prep-room/sessions/[id] error:', error instanceof Error ? error.message : error)
    return createErrorResponse('Internal server error', 500)
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { user, withRLS } = await getAuthenticatedUser()
    if (!user || !withRLS) return createErrorResponse('Unauthorized', 401)

    const deleted = await withRLS((db) =>
      db.delete(negotiationSessions)
        .where(and(eq(negotiationSessions.id, id), eq(negotiationSessions.userId, user.id)))
        .returning({ id: negotiationSessions.id })
    )

    if (deleted.length === 0) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/modules/negotiation-prep-room/sessions/[id] error:', error instanceof Error ? error.message : error)
    return createErrorResponse('Internal server error', 500)
  }
}
