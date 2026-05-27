export type NegotiationType = 'salary' | 'freelance' | 'car' | 'lease' | 'other'
export type NegotiationStatus = 'prep' | 'completed'
export type NegotiationOutcome = 'won' | 'lost' | 'partial' | 'no-deal'

export interface NegotiationContext {
  what_you_want: string          // e.g. "$120k salary" or "3% lower APR"
  your_batna: string             // your walk-away alternative
  their_likely_position: string  // what you expect them to open with
  deadline?: string              // any time pressure
  additional_notes?: string
  aggressiveness: number         // 1 (collaborative) to 5 (hardball)
}

export interface Counteroffer {
  scenario: string   // e.g. "They push back to $105k"
  script: string     // word-for-word response
}

export interface AiAnalysis {
  batna_assessment: string       // AI evaluation of your BATNA strength
  anchor_point: string           // recommended opening ask
  anchor_rationale: string       // why this anchor
  counteroffers: Counteroffer[]  // 3 likely counteroffers + scripts
  closing_script: string         // script to close the deal
  red_flags: string[]            // things to watch out for
}

export interface NegotiationSession {
  id: string
  user_id: string
  title: string
  type: NegotiationType
  status: NegotiationStatus
  context: NegotiationContext
  ai_analysis: AiAnalysis | null
  outcome: NegotiationOutcome | null
  outcome_notes: string | null
  outcome_value: string | null
  created_at: string
  updated_at: string
}

export interface CreateSessionRequest {
  title: string
  type: NegotiationType
  context: NegotiationContext
}

export interface LogOutcomeRequest {
  outcome: NegotiationOutcome
  outcome_notes?: string
  outcome_value?: string
}
