-- Anxiety Crusher schema
-- Idempotent: safe to run on every module enable.
-- Mirrors modules-custom/anxiety-crusher/database/schema.ts

-- User-created custom anxiety tags
CREATE TABLE IF NOT EXISTS anxiety_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_anxiety_tags_user_id ON anxiety_tags(user_id);

ALTER TABLE anxiety_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS anxiety_tags_rls_select ON anxiety_tags;
CREATE POLICY anxiety_tags_rls_select ON anxiety_tags FOR SELECT
  USING (user_id = (SELECT current_setting('app.current_user_id')));

DROP POLICY IF EXISTS anxiety_tags_rls_insert ON anxiety_tags;
CREATE POLICY anxiety_tags_rls_insert ON anxiety_tags FOR INSERT
  WITH CHECK (user_id = (SELECT current_setting('app.current_user_id')));

DROP POLICY IF EXISTS anxiety_tags_rls_update ON anxiety_tags;
CREATE POLICY anxiety_tags_rls_update ON anxiety_tags FOR UPDATE
  USING (user_id = (SELECT current_setting('app.current_user_id')));

DROP POLICY IF EXISTS anxiety_tags_rls_delete ON anxiety_tags;
CREATE POLICY anxiety_tags_rls_delete ON anxiety_tags FOR DELETE
  USING (user_id = (SELECT current_setting('app.current_user_id')));

-- ─────────────────────────────────────────────────────────────────────────────

-- Anxiety sessions — each represents one "generate toxic comments" run
CREATE TABLE IF NOT EXISTS anxiety_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  tag_names JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_anxiety_sessions_user_id ON anxiety_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_anxiety_sessions_user_created ON anxiety_sessions(user_id, created_at DESC);

ALTER TABLE anxiety_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS anxiety_sessions_rls_select ON anxiety_sessions;
CREATE POLICY anxiety_sessions_rls_select ON anxiety_sessions FOR SELECT
  USING (user_id = (SELECT current_setting('app.current_user_id')));

DROP POLICY IF EXISTS anxiety_sessions_rls_insert ON anxiety_sessions;
CREATE POLICY anxiety_sessions_rls_insert ON anxiety_sessions FOR INSERT
  WITH CHECK (user_id = (SELECT current_setting('app.current_user_id')));

DROP POLICY IF EXISTS anxiety_sessions_rls_delete ON anxiety_sessions;
CREATE POLICY anxiety_sessions_rls_delete ON anxiety_sessions FOR DELETE
  USING (user_id = (SELECT current_setting('app.current_user_id')));

-- ─────────────────────────────────────────────────────────────────────────────

-- AI-generated toxic comments within a session
CREATE TABLE IF NOT EXISTS anxiety_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES anxiety_sessions(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  content TEXT NOT NULL,
  position INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_anxiety_comments_session_id ON anxiety_comments(session_id);
CREATE INDEX IF NOT EXISTS idx_anxiety_comments_user_id ON anxiety_comments(user_id);

ALTER TABLE anxiety_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS anxiety_comments_rls_select ON anxiety_comments;
CREATE POLICY anxiety_comments_rls_select ON anxiety_comments FOR SELECT
  USING (user_id = (SELECT current_setting('app.current_user_id')));

DROP POLICY IF EXISTS anxiety_comments_rls_insert ON anxiety_comments;
CREATE POLICY anxiety_comments_rls_insert ON anxiety_comments FOR INSERT
  WITH CHECK (user_id = (SELECT current_setting('app.current_user_id')));

DROP POLICY IF EXISTS anxiety_comments_rls_delete ON anxiety_comments;
CREATE POLICY anxiety_comments_rls_delete ON anxiety_comments FOR DELETE
  USING (user_id = (SELECT current_setting('app.current_user_id')));

-- ─────────────────────────────────────────────────────────────────────────────

-- Crushing transformations applied to individual comments
CREATE TABLE IF NOT EXISTS anxiety_crushes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES anxiety_comments(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  script_name TEXT NOT NULL,
  crushed_content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT anxiety_crushes_script_name_check CHECK (
    script_name IN (
      'kindergarten-tantrum',
      'dramatic-movie-trailer',
      'boomer-facebook-post',
      'fortune-cookie-wisdom',
      'emoji-overload',
      'medieval-proclamation'
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_anxiety_crushes_comment_id ON anxiety_crushes(comment_id);
CREATE INDEX IF NOT EXISTS idx_anxiety_crushes_user_id ON anxiety_crushes(user_id);

ALTER TABLE anxiety_crushes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS anxiety_crushes_rls_select ON anxiety_crushes;
CREATE POLICY anxiety_crushes_rls_select ON anxiety_crushes FOR SELECT
  USING (user_id = (SELECT current_setting('app.current_user_id')));

DROP POLICY IF EXISTS anxiety_crushes_rls_insert ON anxiety_crushes;
CREATE POLICY anxiety_crushes_rls_insert ON anxiety_crushes FOR INSERT
  WITH CHECK (user_id = (SELECT current_setting('app.current_user_id')));

DROP POLICY IF EXISTS anxiety_crushes_rls_delete ON anxiety_crushes;
CREATE POLICY anxiety_crushes_rls_delete ON anxiety_crushes FOR DELETE
  USING (user_id = (SELECT current_setting('app.current_user_id')));
