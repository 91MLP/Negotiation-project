-- ============================================================================
-- MANUAL TEARDOWN SCRIPT — DO NOT RUN AUTOMATICALLY
-- ============================================================================
-- This file is NEVER executed by the ARI module loader.
-- It exists only so a user can run it in their SQL client of choice
-- (Supabase Studio, pgweb, or psql) to remove this module's tables.
--
-- Running this will PERMANENTLY DELETE all data in the listed tables.
-- ============================================================================

DROP TABLE IF EXISTS anxiety_crushes CASCADE;
DROP TABLE IF EXISTS anxiety_comments CASCADE;
DROP TABLE IF EXISTS anxiety_sessions CASCADE;
DROP TABLE IF EXISTS anxiety_tags CASCADE;
