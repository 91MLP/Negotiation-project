import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-helpers'
import { createErrorResponse, toSnakeCase } from '@/lib/api-helpers'
import { negotiationSessions } from '../../../../database/schema'
import { eq, and, sql } from 'drizzle-orm'
import type { NegotiationContext, AiAnalysis } from '../../../../types'

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'

const TYPE_LABELS: Record<string, string> = {
  salary: 'salary negotiation',
  freelance: 'freelance rate negotiation',
  car: 'car purchase negotiation',
  lease: 'lease negotiation',
  other: 'negotiation',
}

const AGGRESSIVENESS_DESCRIPTIONS: Record<number, string> = {
  1: 'Collaborative (1/5) — prioritize the relationship, be warm and flexible, aim for a win-win, soften scripts with empathy and openness',
  2: 'Friendly-firm (2/5) — polite but confident, hold your position without pressure tactics, focus on mutual benefit',
  3: 'Balanced (3/5) — professional and assertive, use principled negotiation, stand firm on key points while remaining reasonable',
  4: 'Assertive (4/5) — push hard for your number, use strategic silence and anchoring, make concessions slowly and reluctantly',
  5: 'Hardball (5/5) — maximize every dollar, use high anchors, create urgency, make them work for every concession — still ethical but no softening',
}

function extractJson(text: string): string {
  // Strip markdown code fences
  const stripped = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
  // Find the first { and last } to extract the JSON object
  const start = stripped.indexOf('{')
  const end = stripped.lastIndexOf('}')
  if (start === -1 || end === -1) throw new Error('No JSON object found in response')
  return stripped.slice(start, end + 1)
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return createErrorResponse('ANTHROPIC_API_KEY is not configured', 500)

    const { id } = await params
    const { user, withRLS } = await getAuthenticatedUser()
    if (!user || !withRLS) return createErrorResponse('Unauthorized', 401)

    const rows = await withRLS((db) =>
      db.select().from(negotiationSessions)
        .where(and(eq(negotiationSessions.id, id), eq(negotiationSessions.userId, user.id)))
        .limit(1)
    )

    if (rows.length === 0) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

    const session = rows[0]
    const ctx = session.context as NegotiationContext
    const typeLabel = TYPE_LABELS[session.type] || 'negotiation'

    const aggressiveness = (ctx.aggressiveness as number) || 3
    const styleGuide = AGGRESSIVENESS_DESCRIPTIONS[aggressiveness] ?? AGGRESSIVENESS_DESCRIPTIONS[3]

    const prompt = `You are an expert negotiation coach. Analyze this ${typeLabel} and provide a complete preparation kit.

NEGOTIATION DETAILS:
- What I want to achieve: ${ctx.what_you_want}
- My BATNA (Best Alternative To Negotiated Agreement): ${ctx.your_batna}
- Their likely opening position: ${ctx.their_likely_position}
${ctx.deadline ? `- Deadline/time pressure: ${ctx.deadline}` : ''}
${ctx.additional_notes ? `- Additional context: ${ctx.additional_notes}` : ''}

NEGOTIATION STYLE: ${styleGuide}
Calibrate ALL scripts, the anchor point, and tactical advice to this exact style. The tone and language of every script must reflect this aggressiveness level.

Respond with ONLY a valid JSON object. No markdown, no explanation, no text before or after. Use this exact structure:
{
  "batna_assessment": "2-3 sentences evaluating the strength of my BATNA and what leverage it gives me",
  "anchor_point": "The specific number/term I should open with (be concrete)",
  "anchor_rationale": "1-2 sentences on why this anchor is strategically optimal",
  "counteroffers": [
    {
      "scenario": "Brief description of their likely counteroffer",
      "script": "Word-for-word script I should say in response (2-4 sentences)"
    },
    {
      "scenario": "Second scenario",
      "script": "Word-for-word script"
    },
    {
      "scenario": "Third scenario",
      "script": "Word-for-word script"
    }
  ],
  "closing_script": "A 3-4 sentence script to close the deal once we're close to agreement",
  "red_flags": ["Watch out for X", "If they say Y it means Z", "Third warning sign"]
}`

    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!response.ok) {
      const errBody = await response.text()
      console.error('Anthropic API error:', response.status, errBody)
      return createErrorResponse(`AI service error: ${response.status}`, 500)
    }

    const aiResponse = await response.json()
    const rawText: string = aiResponse.content?.[0]?.text ?? ''

    let analysis: AiAnalysis
    try {
      analysis = JSON.parse(extractJson(rawText))
    } catch (parseErr) {
      console.error('JSON parse failed. Raw response:', rawText.slice(0, 800))
      return createErrorResponse('AI returned invalid response', 500)
    }

    const [updated] = await withRLS((db) =>
      db.update(negotiationSessions)
        .set({ aiAnalysis: analysis, updatedAt: sql`timezone('utc'::text, now())` })
        .where(eq(negotiationSessions.id, id))
        .returning()
    )

    return NextResponse.json({ session: toSnakeCase(updated) })
  } catch (error) {
    console.error('POST generate error:', error instanceof Error ? error.message : error)
    return createErrorResponse('Internal server error', 500)
  }
}
