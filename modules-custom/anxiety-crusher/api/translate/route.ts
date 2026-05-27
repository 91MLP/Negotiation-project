import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-helpers'
import { validateRequestBody, createErrorResponse } from '@/lib/api-helpers'
import { z } from 'zod'

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
const MODEL = 'claude-haiku-4-5-20251001'

const TranslateSchema = z.object({
  texts: z
    .array(z.string().min(1, 'Text cannot be empty').max(2000, 'Text too long'))
    .min(1, 'At least one text is required')
    .max(10, 'Too many texts in one request'),
})

async function translateTexts(texts: string[]): Promise<string[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not configured')

  const prompt = `Translate each text in the array below into natural, fluent Simplified Chinese (简体中文). The texts may be humorous, dramatic, or stylized (e.g. movie trailer voiceovers, kindergarten tantrums, medieval proclamations, boomer rants). Preserve the comedic tone and style — adapt idioms and cultural references so the humor lands in Chinese rather than translating word-for-word. If a text is already in Chinese, return it exactly as-is.

Return only a JSON array of strings in the same order, with no other text or explanation.

Texts:
${JSON.stringify(texts)}`

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!response.ok) {
    const errText = await response.text()
    let userMessage = 'Translation failed. Please try again.'
    try {
      const errJson = JSON.parse(errText)
      const msg = errJson?.error?.message ?? ''
      if (msg.toLowerCase().includes('credit') || msg.toLowerCase().includes('billing')) {
        userMessage = 'Anthropic API account has insufficient credits.'
      } else if (msg) {
        userMessage = `AI error: ${msg}`
      }
    } catch {}
    const apiError = new Error(userMessage)
    ;(apiError as any).isAnthropicError = true
    throw apiError
  }

  const data = await response.json()
  let text: string = data.content?.[0]?.text ?? '[]'
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()

  const parsed = JSON.parse(text)
  if (!Array.isArray(parsed)) throw new Error('Unexpected translation response format')
  return parsed.slice(0, texts.length).map(String)
}

export async function POST(request: NextRequest) {
  try {
    const validation = await validateRequestBody(request, TranslateSchema)
    if (!validation.success) return validation.response

    const { user, withRLS } = await getAuthenticatedUser()
    if (!user || !withRLS) return createErrorResponse('Unauthorized', 401)

    const translations = await translateTexts(validation.data.texts)
    return NextResponse.json({ translations })
  } catch (error) {
    const isAnthropicError = error instanceof Error && (error as any).isAnthropicError
    const message = error instanceof Error ? error.message : 'Internal server error'
    if (isAnthropicError) return NextResponse.json({ error: message }, { status: 503 })
    console.error('POST /api/modules/anxiety-crusher/translate error:', message)
    return createErrorResponse('Internal server error', 500)
  }
}
