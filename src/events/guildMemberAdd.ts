// src/events/guildMemberAdd.ts - Guild Member Add Event
import { GuildMember } from 'discord.js';
import { ExtendedClient } from '../index.js';
import { BotEvent } from '../types/index.js';

const event: BotEvent<'guildMemberAdd'> = {
  name: 'guildMemberAdd',
  async execute(client: ExtendedClient, member: GuildMember) {
    try {
      // Create user in database if not exists
      await client.db.user.upsert({
        where: { id: member.id },
        update: {
          username: member.user.username,
          discriminator: member.user.discriminator,
          avatar: member.user.avatar,
          updatedAt: new Date()
        },
        create: {
          id: member.id,
          username: member.user.username,
          discriminator: member.user.discriminator,
          avatar: member.user.avatar
        }
      });

      // Create user level entry
      await client.db.userLevel.upsert({
        where: {
          userId_guildId: {
            userId: member.id,
            guildId: member.guild.id
          }
        },
        update: {},
        create: {
          userId: member.id,
          guildId: member.guild.id,
          xp: 0,
          level: 0,
          messages: 0,
          voiceTime: 0
        }
      });

      // Emit member join event to dashboard
      client.wsManager.emitMemberJoin(member.guild.id, {
        userId: member.id,
        username: member.user.username
      });

      client.logger.info(`👋 Member joined ${member.guild.name}: ${member.user.tag}`);

    } catch (error) {
      client.logger.error('Error handling member join:', error);
    }
  },
};

export default event;