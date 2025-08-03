import { pgTable, varchar, timestamp, integer, primaryKey } from 'drizzle-orm/pg-core';
import { guilds } from './guilds';
import { users } from './users';

export const members = pgTable('members', {
  userId: varchar('user_id', { length: 20 }).references(() => users.id, { onDelete: 'cascade' }).notNull(),
  guildId: varchar('guild_id', { length: 20 }).references(() => guilds.id, { onDelete: 'cascade' }).notNull(),
  nickname: varchar('nickname', { length: 32 }),
  joinedAt: timestamp('joined_at').notNull(),
  xp: integer('xp').default(0).notNull(),
  level: integer('level').default(0).notNull(),
  messages: integer('messages').default(0).notNull(),
  voiceMinutes: integer('voice_minutes').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.userId, table.guildId] }),
}));