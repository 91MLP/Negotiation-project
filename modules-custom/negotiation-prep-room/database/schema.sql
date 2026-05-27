-- Negotiation Prep Room - Database Schema
-- Idempotent: safe to run on every module enable.

CREATE TABLE IF NOT EXISTS negotiation_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'other' CHECK (type IN ('salary', 'freelance', 'car', 'lease', 'other')),
  status TEXT NOT NULL DEFAULT 'prep' CHECK (status IN ('prep', 'completed')),
  context JSONB NOT NULL DEFAULT '{}',
  ai_analysis JSONB,
  outcome TEXT CHECK (outcome IN ('won', 'lost', 'partial', 'no-deal')),
  outcome_notes TEXT,
  outcome_value TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_negotiation_sessions_user_id ON negotiation_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_negotiation_sessions_user_created ON negotiation_sessions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_negotiation_sessions_status ON negotiation_sessions(user_id, status);

ALTER TABLE negotiation_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS negotiation_sessions_rls_select ON negotiation_sessions;
CREATE POLICY negotiation_sessions_rls_select ON negotiation_sessions FOR SELECT
  USING (user_id = (SELECT current_setting('app.current_user_id')));

DROP POLICY IF EXISTS negotiation_sessions_rls_insert ON negotiation_sessions;
CREATE POLICY negotiation_sessions_rls_insert ON negotiation_sessions FOR INSERT
  WITH CHECK (user_id = (SELECT current_setting('app.current_user_id')));

DROP POLICY IF EXISTS negotiation_sessions_rls_update ON negotiation_sessions;
CREATE POLICY negotiation_sessions_rls_update ON negotiation_sessions FOR UPDATE
  USING (user_id = (SELECT current_setting('app.current_user_id')));

DROP POLICY IF EXISTS negotiation_sessions_rls_delete ON negotiation_sessions;
CREATE POLICY negotiation_sessions_rls_delete ON negotiation_sessions FOR DELETE
  USING (user_id = (SELECT current_setting('app.current_user_id')));
