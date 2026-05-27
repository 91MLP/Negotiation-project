import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-helpers'
import { validateRequestBody, createErrorResponse, toSnakeCase } from '@/lib/api-helpers'
import { z } from 'zod'
import { anxietyTags } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'

const CreateTagSchema = z.object({
  name: z
    .string()
    .min(1, 'Tag name is required')
    .max(100, 'Tag name must be 100 characters or less')
    .transform((s) => s.trim()),
})

export async function GET() {
  try {
    const { user, withRLS } = await getAuthenticatedUser()
    if (!user || !withRLS) {
      return createErrorResponse('Unauthorized', 401)
    }

    const tags = await withRLS((db) =>
      db
        .select()
        .from(anxietyTags)
        .where(eq(anxietyTags.userId, user.id))
        .orderBy(desc(anxietyTags.createdAt))
    )

    return NextResponse.json({ tags: toSnakeCase(tags) })
  } catch (error) {
    console.error('GET /api/modules/anxiety-crusher/tags error:', error instanceof Error ? error.message : error)
    return createErrorResponse('Internal server error', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const validation = await validateRequestBody(request, CreateTagSchema)
    if (!validation.success) {
      return validation.response
    }

    const { user, withRLS } = await getAuthenticatedUser()
    if (!user || !withRLS) {
      return createErrorResponse('Unauthorized', 401)
    }

    const data = await withRLS((db) =>
      db
        .insert(anxietyTags)
        .values({ userId: user.id, name: validation.data.name })
        .returning()
    )

    return NextResponse.json({ tag: toSnakeCase(data[0]) }, { status: 201 })
  } catch (error) {
    console.error('POST /api/modules/anxiety-crusher/tags error:', error instanceof Error ? error.message : error)
    return createErrorResponse('Internal server error', 500)
  }
}
