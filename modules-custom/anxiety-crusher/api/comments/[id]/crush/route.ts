import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-helpers'
import { validateRequestBody, createErrorResponse, toSnakeCase } from '@/lib/api-helpers'
import { z } from 'zod'
import { anxietyComments, anxietyCrushes } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import type { CrushScript } from '@/modules/anxiety-crusher/types'

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
const MODEL = 'claude-haiku-4-5-20251001'

const VALID_SCRIPTS = [
  'kindergarten-tantrum',
  'dramatic-movie-trailer',
  'boomer-facebook-post',
  'fortune-cookie-wisdom',
  'emoji-overload',
  'medieval-proclamation',
] as const

const CrushSchema = z.object({
  script_name: z.enum(VALID_SCRIPTS, {
    errorMap: () => ({ message: 'Invalid crushing script selected' }),
  }),
})

const SCRIPT_PROMPTS: Record<CrushScript, string> = {
  'kindergarten-tantrum': `Rewrite this comment as a whiny 5-year-old having a tantrum. Use baby talk, lots of "but WHY?!", "it's not FAIR!", pouting, and the kind of logic only a kindergartner would use. Keep it under 3 sentences.`,
  'dramatic-movie-trailer': `Transform this comment into an over-the-top Hollywood blockbuster movie trailer voiceover. Use dramatic pauses (shown with "..."), epic language like "IN A WORLD WHERE...", thunderous stakes, and end with a ridiculous tagline. Keep it under 4 sentences.`,
  'boomer-facebook-post': `Rewrite this comment as an ALL CAPS boomer Facebook post. Include random. Punctuation!! Spelling mistakes, references to "back in MY day", sharing it to Facebook, and at least one "I'm just asking questions" moment. Keep it under 4 sentences.`,
  'fortune-cookie-wisdom': `Condense this comment into 2-3 vague, contradictory fortune cookie sayings. Make them sound profound but say absolutely nothing useful. Include at least one lucky number or auspicious suggestion.`,
  'emoji-overload': `Replace every meaningful word or concept in this comment with emojis. Use as many emojis as possible. The result should be barely comprehensible but convey the same chaotic energy. Use at least 15 emojis total.`,
  'medieval-proclamation': `Rewrite this comment as a pompous royal decree from a medieval king. Use archaic language ("thee", "thou", "henceforth", "verily"), reference the royal court, and sign it with an absurd royal title. Keep it under 4 sentences.`,
}

async function crushComment(commentContent: string, scriptName: CrushScript): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured')
  }

  const scriptPrompt = SCRIPT_PROMPTS[scriptName]
  const prompt = `${scriptPrompt}

Original toxic comment to transform:
"${commentContent}"

Respond with only the transformed text, no explanations or quotes around it.`

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!response.ok) {
    const errText = await response.text()
    let userMessage = 'AI crushing failed. Please try again.'
    try {
      const errJson = JSON.parse(errText)
      const msg = errJson?.error?.message ?? ''
      if (msg.toLowerCase().includes('credit') || msg.toLowerCase().includes('billing')) {
        userMessage = 'Anthropic API account has insufficient credits. Please add credits at console.anthropic.com.'
      } else if (msg) {
        userMessage = `AI error: ${msg}`
      }
    } catch {}
    const apiError = new Error(userMessage)
    ;(apiError as any).isAnthropicError = true
    throw apiError
  }

  const data = await response.json()
  return data.content?.[0]?.text?.trim() ?? ''
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: commentId } = await params

    const validation = await validateRequestBody(request, CrushSchema)
    if (!validation.success) {
      return validation.response
    }

    const { user, withRLS } = await getAuthenticatedUser()
    if (!user || !withRLS) {
      return createErrorResponse('Unauthorized', 401)
    }

    const commentRows = await withRLS((db) =>
      db
        .select()
        .from(anxietyComments)
        .where(and(eq(anxietyComments.id, commentId), eq(anxietyComments.userId, user.id)))
    )

    if (commentRows.length === 0) {
      return createErrorResponse('Comment not found', 404)
    }

    const crushedContent = await crushComment(
      commentRows[0].content,
      validation.data.script_name as CrushScript
    )

    const [crush] = await withRLS((db) =>
      db
        .insert(anxietyCrushes)
        .values({
          commentId,
          userId: user.id,
          scriptName: validation.data.script_name,
          crushedContent,
        })
        .returning()
    )

    return NextResponse.json({ crush: toSnakeCase(crush) }, { status: 201 })
  } catch (error) {
    const isAnthropicError = error instanceof Error && (error as any).isAnthropicError
    const message = error instanceof Error ? error.message : 'Internal server error'
    if (message.includes('ANTHROPIC_API_KEY')) {
      return createErrorResponse('AI generation is not configured. Please add ANTHROPIC_API_KEY to your environment.', 503)
    }
    if (isAnthropicError) {
      return NextResponse.json({ error: message }, { status: 503 })
    }
    console.error('POST /api/modules/anxiety-crusher/comments/[id]/crush error:', message)
    return createErrorResponse('Internal server error', 500)
  }
}
