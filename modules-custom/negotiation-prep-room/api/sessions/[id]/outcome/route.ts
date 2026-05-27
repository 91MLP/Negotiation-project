import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-helpers'
import { validateRequestBody, createErrorResponse, toSnakeCase } from '@/lib/api-helpers'
import { z } from 'zod'
import { negotiationSessions } from '../../../../database/schema'
import { eq, and, sql } from 'drizzle-orm'

const OutcomeSchema = z.object({
  outcome: z.enum(['won', 'lost', 'partial', 'no-deal'], {
    errorMap: () => ({ message: 'Outcome must be won, lost, partial, or no-deal' }),
  }),
  outcome_notes: z.string().max(1000, 'Notes must be 1000 characters or fewer').optional(),
  outcome_value: z.string().max(200, 'Outcome value must be 200 characters or fewer').optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const validation = await validateRequestBody(request, OutcomeSchema)
    if (!validation.success) return validation.response

    const { user, withRLS } = await getAuthenticatedUser()
    if (!user || !withRLS) return createErrorResponse('Unauthorized', 401)

    const [updated] = await withRLS((db) =>
      db.update(negotiationSessions)
        .set({
          outcome: validation.data.outcome,
          outcomeNotes: validation.data.outcome_notes,
          outcomeValue: validation.data.outcome_value,
          status: 'completed',
          updatedAt: sql`timezone('utc'::text, now())`,
        })
        .where(and(eq(negotiationSessions.id, id), eq(negotiationSessions.userId, user.id)))
        .returning()
    )

    if (!updated) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

    return NextResponse.json({ session: toSnakeCase(updated) })
  } catch (error) {
    console.error('POST /api/modules/negotiation-prep-room/sessions/[id]/outcome error:', error instanceof Error ? error.message : error)
    return createErrorResponse('Internal server error', 500)
  }
}
