import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-helpers'
import { validateRequestBody, createErrorResponse, toSnakeCase } from '@/lib/api-helpers'
import { z } from 'zod'
import { anxietySessions, anxietyComments } from '@/lib/db/schema'
import { eq, desc, count } from 'drizzle-orm'

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
const MODEL = 'claude-haiku-4-5-20251001'

const CreateSessionSchema = z.object({
  tag_names: z
    .array(z.string().min(1, 'Tag name cannot be empty').max(100, 'Tag name too long'))
    .min(1, 'Select at least one tag')
    .max(20, 'Too many tags selected'),
  language: z.enum(['en', 'zh'], { errorMap: () => ({ message: 'Language must be "en" or "zh"' }) }).default('en'),
})

async function generateToxicComments(tagNames: string[], language: 'en' | 'zh'): Promise<string[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured')
  }

  const isZh = language === 'zh'

  const prompt = isZh
    ? `这是一个心理减压应用的功能——通过幽默化解焦虑。请你扮演一个夸张的、戏剧化的"内心批评家"，为正在经历以下焦虑的用户生成7条模拟的自我内心吐槽：${tagNames.join('、')}。

这些内心吐槽要：
- 夸张到可笑的程度，像焦虑时大脑里最钻牛角尖的那个声音
- 充满末日感和灾难化思维，比如"这辈子完了"、"所有人都在嘲笑你"
- 非常具体地针对焦虑主题，戳中那种熟悉的自我怀疑
- 语气尖刻、阴阳怪气，像网络上最爱唱反调的评论
- 每条1-3句，言简意赅但扎心
- 内容属于夸张的心理喜剧，不涉及暴力

只用JSON字符串数组回复，不要其他文字：
["吐槽1", "吐槽2", "吐槽3", "吐槽4", "吐槽5", "吐槽6", "吐槽7"]`
    : `This is a therapeutic stress-relief app feature that helps users process anxiety through humor. Play the role of an exaggerated, dramatic "inner critic" and generate 7 mock self-doubt comments for someone anxious about: ${tagNames.join(', ')}.

These inner-critic comments should:
- Be so catastrophically over-the-top they become funny ("you'll never recover from this", "everyone can already tell")
- Zero in specifically on the anxiety topic — hit the exact flavor of self-doubt it produces
- Drip with the kind of sarcastic, hopeless inner monologue anxiety sufferers recognize
- Use dramatic comparisons, worst-case scenarios, and spiral logic ("and THEN what?")
- Feel like the most ruthless version of imposter syndrome talking
- 1-3 sentences each, punchy and specific
- Exaggerated satire — no real threats

Respond with a JSON array of strings only, no other text:
["comment 1", "comment 2", "comment 3", "comment 4", "comment 5", "comment 6", "comment 7"]`

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!response.ok) {
    const errText = await response.text()
    let userMessage = 'AI generation failed. Please try again.'
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
  let text: string = data.content?.[0]?.text ?? '[]'

  // Strip markdown code fences if Claude wraps the response
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()

  const parsed = JSON.parse(text)
  if (!Array.isArray(parsed)) throw new Error('Unexpected AI response format')
  return parsed.slice(0, 8).map(String)
}

export async function GET() {
  try {
    const { user, withRLS } = await getAuthenticatedUser()
    if (!user || !withRLS) {
      return createErrorResponse('Unauthorized', 401)
    }

    const [sessions, [{ total }]] = await Promise.all([
      withRLS((db) =>
        db
          .select()
          .from(anxietySessions)
          .where(eq(anxietySessions.userId, user.id))
          .orderBy(desc(anxietySessions.createdAt))
          .limit(50)
      ),
      withRLS((db) =>
        db
          .select({ total: count() })
          .from(anxietySessions)
          .where(eq(anxietySessions.userId, user.id))
      ),
    ])

    return NextResponse.json({
      sessions: toSnakeCase(sessions),
      total_sessions: Number(total),
    })
  } catch (error) {
    console.error('GET /api/modules/anxiety-crusher/sessions error:', error instanceof Error ? error.message : error)
    return createErrorResponse('Internal server error', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const validation = await validateRequestBody(request, CreateSessionSchema)
    if (!validation.success) {
      return validation.response
    }

    const { user, withRLS } = await getAuthenticatedUser()
    if (!user || !withRLS) {
      return createErrorResponse('Unauthorized', 401)
    }

    const { tag_names, language = 'en' } = validation.data

    const comments = await generateToxicComments(tag_names, language)

    const [sessionRow] = await withRLS((db) =>
      db
        .insert(anxietySessions)
        .values({ userId: user.id, tagNames: tag_names })
        .returning()
    )

    const commentRows = await withRLS((db) =>
      db
        .insert(anxietyComments)
        .values(
          comments.map((content, i) => ({
            sessionId: sessionRow.id,
            userId: user.id,
            content,
            position: i,
          }))
        )
        .returning()
    )

    const session = {
      ...toSnakeCase(sessionRow),
      comments: toSnakeCase(commentRows),
    }

    return NextResponse.json({ session }, { status: 201 })
  } catch (error) {
    const isAnthropicError = error instanceof Error && (error as any).isAnthropicError
    const message = error instanceof Error ? error.message : 'Internal server error'
    if (message.includes('ANTHROPIC_API_KEY')) {
      return createErrorResponse('AI generation is not configured. Please add ANTHROPIC_API_KEY to your environment.', 503)
    }
    if (isAnthropicError) {
      return NextResponse.json({ error: message }, { status: 503 })
    }
    console.error('POST /api/modules/anxiety-crusher/sessions error:', message)
    return createErrorResponse('Internal server error', 500)
  }
}
