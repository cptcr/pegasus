// src/events/guildMemberRemove.ts - Guild Member Remove Event
import { GuildMember, PartialGuildMember } from 'discord.js';
import { ExtendedClient } from '../index.js';
import { BotEvent } from '../types/index.js';

const event: BotEvent<'guildMemberRemove'> = {
  name: 'guildMemberRemove',
  async execute(client: ExtendedClient, member: GuildMember | PartialGuildMember) {
    try {
      // If member is partial, try to fetch full data
      let fullMember = member;
      if (member.partial) {
        try {
          fullMember = await member.fetch();
        } catch (error) {
          client.logger.warn('Could not fetch partial member data:', error);
        }
      }

      // Remove active quarantine if exists
      await client.db.quarantine.updateMany({
        where: {
          guildId: member.guild.id,
          userId: member.id,
          active: true
        },
        data: {
          active: false,
          updatedAt: new Date()
        }
      });

      // Emit member leave event to dashboard
      client.wsManager.emitMemberLeave(member.guild.id, {
        userId: member.id,
        username: fullMember.user?.username || 'Unknown User'
      });

      client.logger.info(`👋 Member left ${member.guild.name}: ${fullMember.user?.tag || member.id}`);

    } catch (error) {
      client.logger.error('Error handling member leave:', error);
    }
  },
};

export default event;