import {
  pgTable,
  varchar,
  timestamp,
  integer,
  serial,
  text,
  boolean,
  jsonb,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { guilds } from './guilds';
import { users } from './users';

export const modCases = pgTable('mod_cases', {
  id: serial('id').primaryKey(),
  guildId: varchar('guild_id', { length: 20 })
    .references(() => guilds.id, { onDelete: 'cascade' })
    .notNull(),
  userId: varchar('user_id', { length: 20 })
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  moderatorId: varchar('moderator_id', { length: 20 })
    .references(() => users.id, { onDelete: 'set null' })
    .notNull(),
  type: varchar('type', { length: 20 }).notNull(), // warn, mute, kick, ban, etc.
  reason: text('reason'),
  duration: integer('duration'), // in milliseconds
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const warnings = pgTable('warnings', {
  id: serial('id').primaryKey(),
  warnId: varchar('warn_id', { length: 20 }).unique().notNull(), // Custom warn ID format
  guildId: varchar('guild_id', { length: 20 })
    .references(() => guilds.id, { onDelete: 'cascade' })
    .notNull(),
  userId: varchar('user_id', { length: 20 })
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  moderatorId: varchar('moderator_id', { length: 20 })
    .references(() => users.id, { onDelete: 'set null' })
    .notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  level: integer('level').default(1).notNull(),
  proof: text('proof'), // URL to attachment
  active: boolean('active').default(true).notNull(),
  editedAt: timestamp('edited_at'),
  editedBy: varchar('edited_by', { length: 20 }).references(() => users.id, {
    onDelete: 'set null',
  }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const warningAutomations = pgTable('warning_automations', {
  id: serial('id').primaryKey(),
  automationId: varchar('automation_id', { length: 20 }).unique().notNull(),
  guildId: varchar('guild_id', { length: 20 })
    .references(() => guilds.id, { onDelete: 'cascade' })
    .notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  triggerType: varchar('trigger_type', { length: 50 }).notNull(), // 'warn_count' or 'warn_level'
  triggerValue: integer('trigger_value').notNull(), // Number of warns or total level
  actions: jsonb('actions').notNull(), // Array of action objects
  enabled: boolean('enabled').default(true).notNull(),
  createdBy: varchar('created_by', { length: 20 })
    .references(() => users.id, { onDelete: 'set null' })
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  lastTriggeredAt: timestamp('last_triggered_at'),
  notifyChannelId: varchar('notify_channel_id', { length: 20 }),
  notifyMessage: text('notify_message'),
});

// Note: auditLogs and blacklist tables have been moved to security.ts for better organization

export const modLogSettings = pgTable(
  'mod_log_settings',
  {
    id: serial('id').primaryKey(),
    guildId: varchar('guild_id', { length: 20 })
      .references(() => guilds.id, { onDelete: 'cascade' })
      .notNull(),
    category: varchar('category', { length: 50 }).notNull(),
    channelId: varchar('channel_id', { length: 20 }).notNull(),
    enabled: boolean('enabled').default(true).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  table => ({
    guildCategoryIdx: uniqueIndex('mod_log_settings_guild_category_idx').on(
      table.guildId,
      table.category
    ),
  })
);

export const wordFilterRules = pgTable(
  'word_filter_rules',
  {
    id: serial('id').primaryKey(),
    guildId: varchar('guild_id', { length: 20 })
      .references(() => guilds.id, { onDelete: 'cascade' })
      .notNull(),
    pattern: text('pattern').notNull(),
    matchType: varchar('match_type', { length: 20 }).default('literal').notNull(),
    caseSensitive: boolean('case_sensitive').default(false).notNull(),
    wholeWord: boolean('whole_word').default(true).notNull(),
    severity: varchar('severity', { length: 20 }).default('medium').notNull(),
    autoDelete: boolean('auto_delete').default(true).notNull(),
    notifyChannelId: varchar('notify_channel_id', { length: 20 }),
    actions: jsonb('actions').default('[]').notNull(),
    createdBy: varchar('created_by', { length: 20 }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  table => ({
    guildIdx: index('word_filter_rules_guild_idx').on(table.guildId),
  })
);
