import { pgTable, index, pgPolicy, uuid, text, timestamp, jsonb } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

const RLS_USER = sql`(user_id = (select current_setting('app.current_user_id')))`

export const negotiationSessions = pgTable('negotiation_sessions', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  userId: text('user_id').notNull(),
  title: text('title').notNull(),
  type: text('type').notNull().default('other'),
  status: text('status').notNull().default('prep'),
  context: jsonb('context').notNull().default(sql`'{}'`),
  aiAnalysis: jsonb('ai_analysis'),
  outcome: text('outcome'),
  outcomeNotes: text('outcome_notes'),
  outcomeValue: text('outcome_value'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (table) => [
  index('idx_negotiation_sessions_user_id').using('btree', table.userId.asc()),
  index('idx_negotiation_sessions_user_created').using('btree', table.userId.asc(), table.createdAt.desc()),
  index('idx_negotiation_sessions_status').using('btree', table.userId.asc(), table.status.asc()),
  pgPolicy('negotiation_sessions_rls_select', { as: 'permissive', for: 'select', to: ['public'], using: RLS_USER }),
  pgPolicy('negotiation_sessions_rls_insert', { as: 'permissive', for: 'insert', to: ['public'], withCheck: RLS_USER }),
  pgPolicy('negotiation_sessions_rls_update', { as: 'permissive', for: 'update', to: ['public'], using: RLS_USER }),
  pgPolicy('negotiation_sessions_rls_delete', { as: 'permissive', for: 'delete', to: ['public'], using: RLS_USER }),
])
