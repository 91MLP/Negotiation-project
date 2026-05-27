import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-helpers'
import { validateRequestBody, createErrorResponse, toSnakeCase } from '@/lib/api-helpers'
import { z } from 'zod'
import { negotiationSessions } from '../../database/schema'
import { eq, desc } from 'drizzle-orm'

const ContextSchema = z.object({
  what_you_want: z.string({ required_error: 'Describe what you want to achieve' }).min(1, 'Required').max(500),
  your_batna: z.string({ required_error: 'Your BATNA is required' }).min(1, 'Required').max(500),
  their_likely_position: z.string({ required_error: 'Their likely position is required' }).min(1, 'Required').max(500),
  deadline: z.string().max(200).optional(),
  additional_notes: z.string().max(1000).optional(),
})

const CreateSessionSchema = z.object({
  title: z.string({ required_error: 'Title is required' }).min(1, 'Title cannot be empty').max(150, 'Title must be 150 characters or fewer'),
  type: z.enum(['salary', 'freelance', 'car', 'lease', 'other'], {
    errorMap: () => ({ message: 'Type must be salary, freelance, car, lease, or other' }),
  }),
  context: ContextSchema,
})

export async function GET(_request: NextRequest) {
  try {
    const { user, withRLS } = await getAuthenticatedUser()
    if (!user || !withRLS) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const sessions = await withRLS((db) =>
      db.select().from(negotiationSessions)
        .where(eq(negotiationSessions.userId, user.id))
        .orderBy(desc(negotiationSessions.createdAt))
    )

    return NextResponse.json({ sessions: sessions.map(toSnakeCase) })
  } catch (error) {
    console.error('GET /api/modules/negotiation-prep-room/sessions error:', error instanceof Error ? error.message : error)
    return createErrorResponse('Internal server error', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const validation = await validateRequestBody(request, CreateSessionSchema)
    if (!validation.success) return validation.response

    const { user, withRLS } = await getAuthenticatedUser()
    if (!user || !withRLS) return createErrorResponse('Unauthorized', 401)

    const [session] = await withRLS((db) =>
      db.insert(negotiationSessions).values({
        userId: user.id,
        title: validation.data.title,
        type: validation.data.type,
        context: validation.data.context,
      }).returning()
    )

    return NextResponse.json({ session: toSnakeCase(session) }, { status: 201 })
  } catch (error) {
    console.error('POST /api/modules/negotiation-prep-room/sessions error:', error instanceof Error ? error.message : error)
    return createErrorResponse('Internal server error', 500)
  }
}
