import { pgTable, varchar, timestamp, integer, serial, text, boolean, jsonb } from 'drizzle-orm/pg-core';
import { guilds } from './guilds';
import { users } from './users';

export const modCases = pgTable('mod_cases', {
  id: serial('id').primaryKey(),
  guildId: varchar('guild_id', { length: 20 }).references(() => guilds.id, { onDelete: 'cascade' }).notNull(),
  userId: varchar('user_id', { length: 20 }).references(() => users.id, { onDelete: 'cascade' }).notNull(),
  moderatorId: varchar('moderator_id', { length: 20 }).references(() => users.id, { onDelete: 'set null' }).notNull(),
  type: varchar('type', { length: 20 }).notNull(), // warn, mute, kick, ban, etc.
  reason: text('reason'),
  duration: integer('duration'), // in milliseconds
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const warnings = pgTable('warnings', {
  id: serial('id').primaryKey(),
  warnId: varchar('warn_id', { length: 20 }).unique().notNull(), // Custom warn ID format
  guildId: varchar('guild_id', { length: 20 }).references(() => guilds.id, { onDelete: 'cascade' }).notNull(),
  userId: varchar('user_id', { length: 20 }).references(() => users.id, { onDelete: 'cascade' }).notNull(),
  moderatorId: varchar('moderator_id', { length: 20 }).references(() => users.id, { onDelete: 'set null' }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  level: integer('level').default(1).notNull(),
  proof: text('proof'), // URL to attachment
  active: boolean('active').default(true).notNull(),
  editedAt: timestamp('edited_at'),
  editedBy: varchar('edited_by', { length: 20 }).references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const warningAutomations = pgTable('warning_automations', {
  id: serial('id').primaryKey(),
  automationId: varchar('automation_id', { length: 20 }).unique().notNull(),
  guildId: varchar('guild_id', { length: 20 }).references(() => guilds.id, { onDelete: 'cascade' }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  triggerType: varchar('trigger_type', { length: 50 }).notNull(), // 'warn_count' or 'warn_level'
  triggerValue: integer('trigger_value').notNull(), // Number of warns or total level
  actions: jsonb('actions').notNull(), // Array of action objects
  enabled: boolean('enabled').default(true).notNull(),
  createdBy: varchar('created_by', { length: 20 }).references(() => users.id, { onDelete: 'set null' }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  lastTriggeredAt: timestamp('last_triggered_at'),
});

export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  action: varchar('action', { length: 50 }).notNull(),
  userId: varchar('user_id', { length: 20 }).references(() => users.id, { onDelete: 'set null' }).notNull(),
  guildId: varchar('guild_id', { length: 20 }).references(() => guilds.id, { onDelete: 'cascade' }).notNull(),
  targetId: varchar('target_id', { length: 20 }),
  details: jsonb('details'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const blacklist = pgTable('blacklist', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id', { length: 20 }).references(() => users.id, { onDelete: 'cascade' }).notNull(),
  guildId: varchar('guild_id', { length: 20 }).references(() => guilds.id, { onDelete: 'cascade' }).notNull(),
  reason: text('reason').notNull(),
  blacklistedBy: varchar('blacklisted_by', { length: 20 }).references(() => users.id, { onDelete: 'set null' }).notNull(),
  blacklistedAt: timestamp('blacklisted_at').defaultNow().notNull(),
});