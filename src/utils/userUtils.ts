import { User, Guild } from 'discord.js';
import { getDatabase } from '../database/connection';
import { users, guilds } from '../database/schema';
import { eq } from 'drizzle-orm';

/**
 * Ensures a user exists in the database, creates them if they don't
 */
export async function ensureUserExists(user: User): Promise<void> {
  const db = getDatabase();
  
  try {
    await db.insert(users).values({
      id: user.id,
      username: user.username,
      discriminator: user.discriminator,
      globalName: user.globalName,
      avatar: user.avatar,
      avatarUrl: user.displayAvatarURL(),
      bot: user.bot,
    }).onConflictDoUpdate({
      target: users.id,
      set: {
        username: user.username,
        discriminator: user.discriminator,
        globalName: user.globalName,
        avatar: user.avatar,
        avatarUrl: user.displayAvatarURL(),
        updatedAt: new Date(),
      },
    });
  } catch (error) {
    // Fallback to manual check and insert
    const existingUser = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
    
    if (existingUser.length === 0) {
      await db.insert(users).values({
        id: user.id,
        username: user.username,
        discriminator: user.discriminator,
        globalName: user.globalName,
        avatar: user.avatar,
        avatarUrl: user.displayAvatarURL(),
        bot: user.bot,
      });
    } else {
      await db.update(users)
        .set({
          username: user.username,
          discriminator: user.discriminator,
          globalName: user.globalName,
          avatar: user.avatar,
          avatarUrl: user.displayAvatarURL(),
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id));
    }
  }
}

/**
 * Ensures a guild exists in the database, creates it if it doesn't
 */
export async function ensureGuildExists(guild: Guild): Promise<void> {
  const db = getDatabase();
  
  try {
    await db.insert(guilds).values({
      id: guild.id,
    }).onConflictDoUpdate({
      target: guilds.id,
      set: {
        updatedAt: new Date(),
      },
    });
  } catch (error) {
    // Fallback to manual check and insert
    const existingGuild = await db.select().from(guilds).where(eq(guilds.id, guild.id)).limit(1);
    
    if (existingGuild.length === 0) {
      await db.insert(guilds).values({
        id: guild.id,
      });
    }
  }
}

/**
 * Ensures both user and guild exist in database
 */
export async function ensureUserAndGuildExist(user: User, guild: Guild): Promise<void> {
  await Promise.all([
    ensureUserExists(user),
    ensureGuildExists(guild),
  ]);
}