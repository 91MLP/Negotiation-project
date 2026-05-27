import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-helpers'
import { createErrorResponse, toSnakeCase } from '@/lib/api-helpers'
import { anxietySessions, anxietyComments, anxietyCrushes } from '@/lib/db/schema'
import { and, eq, asc } from 'drizzle-orm'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const { user, withRLS } = await getAuthenticatedUser()
    if (!user || !withRLS) {
      return createErrorResponse('Unauthorized', 401)
    }

    const [sessionRows, commentRows, crushRows] = await Promise.all([
      withRLS((db) =>
        db
          .select()
          .from(anxietySessions)
          .where(and(eq(anxietySessions.id, id), eq(anxietySessions.userId, user.id)))
      ),
      withRLS((db) =>
        db
          .select()
          .from(anxietyComments)
          .where(and(eq(anxietyComments.sessionId, id), eq(anxietyComments.userId, user.id)))
          .orderBy(asc(anxietyComments.position))
      ),
      withRLS((db) =>
        db
          .select()
          .from(anxietyCrushes)
          .where(eq(anxietyCrushes.userId, user.id))
      ),
    ])

    if (sessionRows.length === 0) {
      return createErrorResponse('Session not found', 404)
    }

    const crushByCommentId = crushRows.reduce<Record<string, typeof crushRows>>((acc, crush) => {
      const key = crush.commentId
      if (!acc[key]) acc[key] = []
      acc[key].push(crush)
      return acc
    }, {})

    const commentsWithCrushes = commentRows.map((comment) => ({
      ...comment,
      crushes: crushByCommentId[comment.id] ?? [],
    }))

    const session = {
      ...toSnakeCase(sessionRows[0]),
      comments: toSnakeCase(commentsWithCrushes),
    }

    return NextResponse.json({ session })
  } catch (error) {
    console.error('GET /api/modules/anxiety-crusher/sessions/[id] error:', error instanceof Error ? error.message : error)
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
    if (!user || !withRLS) {
      return createErrorResponse('Unauthorized', 401)
    }

    const deleted = await withRLS((db) =>
      db
        .delete(anxietySessions)
        .where(and(eq(anxietySessions.id, id), eq(anxietySessions.userId, user.id)))
        .returning()
    )

    if (deleted.length === 0) {
      return createErrorResponse('Session not found', 404)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/modules/anxiety-crusher/sessions/[id] error:', error instanceof Error ? error.message : error)
    return createErrorResponse('Internal server error', 500)
  }
}
