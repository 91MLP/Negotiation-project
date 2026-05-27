import { pgTable, index, pgPolicy, uuid, text, varchar, integer, jsonb, timestamp, check } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const anxietyTags = pgTable("anxiety_tags", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  userId: text("user_id").notNull(),
  name: varchar({ length: 100 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (table) => [
  index("idx_anxiety_tags_user_id").using("btree", table.userId.asc().nullsLast().op("text_ops")),
  pgPolicy("anxiety_tags_rls_select", { as: "permissive", for: "select", to: ["public"], using: sql`(user_id = (select current_setting('app.current_user_id')))` }),
  pgPolicy("anxiety_tags_rls_insert", { as: "permissive", for: "insert", to: ["public"], withCheck: sql`(user_id = (select current_setting('app.current_user_id')))` }),
  pgPolicy("anxiety_tags_rls_update", { as: "permissive", for: "update", to: ["public"], using: sql`(user_id = (select current_setting('app.current_user_id')))` }),
  pgPolicy("anxiety_tags_rls_delete", { as: "permissive", for: "delete", to: ["public"], using: sql`(user_id = (select current_setting('app.current_user_id')))` }),
])

export const anxietySessions = pgTable("anxiety_sessions", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  userId: text("user_id").notNull(),
  tagNames: jsonb("tag_names").notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (table) => [
  index("idx_anxiety_sessions_user_id").using("btree", table.userId.asc().nullsLast().op("text_ops")),
  index("idx_anxiety_sessions_user_created").using("btree", table.userId.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
  pgPolicy("anxiety_sessions_rls_select", { as: "permissive", for: "select", to: ["public"], using: sql`(user_id = (select current_setting('app.current_user_id')))` }),
  pgPolicy("anxiety_sessions_rls_insert", { as: "permissive", for: "insert", to: ["public"], withCheck: sql`(user_id = (select current_setting('app.current_user_id')))` }),
  pgPolicy("anxiety_sessions_rls_delete", { as: "permissive", for: "delete", to: ["public"], using: sql`(user_id = (select current_setting('app.current_user_id')))` }),
])

export const anxietyComments = pgTable("anxiety_comments", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  sessionId: uuid("session_id").notNull().references(() => anxietySessions.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  content: text().notNull(),
  position: integer().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (table) => [
  index("idx_anxiety_comments_session_id").using("btree", table.sessionId.asc().nullsLast().op("uuid_ops")),
  index("idx_anxiety_comments_user_id").using("btree", table.userId.asc().nullsLast().op("text_ops")),
  pgPolicy("anxiety_comments_rls_select", { as: "permissive", for: "select", to: ["public"], using: sql`(user_id = (select current_setting('app.current_user_id')))` }),
  pgPolicy("anxiety_comments_rls_insert", { as: "permissive", for: "insert", to: ["public"], withCheck: sql`(user_id = (select current_setting('app.current_user_id')))` }),
  pgPolicy("anxiety_comments_rls_delete", { as: "permissive", for: "delete", to: ["public"], using: sql`(user_id = (select current_setting('app.current_user_id')))` }),
])

export const anxietyCrushes = pgTable("anxiety_crushes", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  commentId: uuid("comment_id").notNull().references(() => anxietyComments.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  scriptName: text("script_name").notNull(),
  crushedContent: text("crushed_content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (table) => [
  index("idx_anxiety_crushes_comment_id").using("btree", table.commentId.asc().nullsLast().op("uuid_ops")),
  index("idx_anxiety_crushes_user_id").using("btree", table.userId.asc().nullsLast().op("text_ops")),
  check("anxiety_crushes_script_name_check", sql`script_name IN ('kindergarten-tantrum','dramatic-movie-trailer','boomer-facebook-post','fortune-cookie-wisdom','emoji-overload','medieval-proclamation')`),
  pgPolicy("anxiety_crushes_rls_select", { as: "permissive", for: "select", to: ["public"], using: sql`(user_id = (select current_setting('app.current_user_id')))` }),
  pgPolicy("anxiety_crushes_rls_insert", { as: "permissive", for: "insert", to: ["public"], withCheck: sql`(user_id = (select current_setting('app.current_user_id')))` }),
  pgPolicy("anxiety_crushes_rls_delete", { as: "permissive", for: "delete", to: ["public"], using: sql`(user_id = (select current_setting('app.current_user_id')))` }),
])
