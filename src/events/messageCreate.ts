import { Events, Message, EmbedBuilder, TextChannel } from 'discord.js';
import { xpService } from '../services/xpService';
import { configurationService } from '../services/configurationService';
import { guildService } from '../services/guildService';
import { listCommandService } from '../services/listCommandService';
import { logger } from '../utils/logger';
import { getTranslation } from '../i18n';

export const name = Events.MessageCreate;
export const once = false;

export async function execute(message: Message) {
  // Ignore bot messages
  if (message.author.bot) return;

  // Ignore DMs
  if (!message.guild || !message.member) return;

  try {
    // Ensure guild exists in database
    await guildService.ensureGuild(message.guild);

    // Handle prefix list commands before processing XP
    const handled = await listCommandService.handle(message);
    if (handled) return;

    // Process XP gain
    await processXPGain(message);
  } catch (error) {
    logger.error('Error in messageCreate event:', error);
  }
}

async function processXPGain(message: Message) {
  if (!message.guild || !message.member) return;

  try {
    const config = await configurationService.getXPConfig(message.guild.id);

    // Check if XP is enabled
    if (!config.enabled) return;

    // Add XP for message
    const result = await xpService.addXP(
      message.author.id,
      message.guild.id,
      message.member,
      config.perMessage,
      message.channel.id
    );

    if (!result || !result.leveledUp) return;

    // Handle level up
    if (config.announceLevelUp) {
      const locale = getTranslation(message.guild.id, message.author.id);

      // Prepare level up message
      const xpLocale = locale.commands?.xp as
        | { levelUp: { defaultMessage: string; title: string; rolesEarned: string } }
        | undefined;
      const defaultMessage =
        xpLocale?.levelUp?.defaultMessage ||
        'Congratulations {{user}}! You reached level {{level}}!';

      let levelUpMessage = config.levelUpMessage || defaultMessage;
      levelUpMessage = levelUpMessage
        .replace('{{user}}', message.author.toString())
        .replace('{{level}}', result.newLevel.toString())
        .replace('{{username}}', message.author.username);

      // Determine where to send the message
      const targetChannel = config.levelUpChannel
        ? (message.guild.channels.cache.get(config.levelUpChannel) as TextChannel)
        : (message.channel as TextChannel);

      if (targetChannel && targetChannel.isTextBased()) {
        const embed = new EmbedBuilder()
          .setColor(0x00ff00)
          .setTitle(xpLocale?.levelUp?.title || 'Level Up!')
          .setDescription(levelUpMessage)
          .setThumbnail(message.author.displayAvatarURL())
          .setTimestamp();

        // Add role rewards info if any
        if (result.rewardRoles && result.rewardRoles.length > 0) {
          const roleRewards = result.rewardRoles.map(roleId => `<@&${roleId}>`).join(', ');

          embed.addFields({
            name: xpLocale?.levelUp?.rolesEarned || 'Roles Earned',
            value: roleRewards,
            inline: false,
          });

          // Add roles to member
          for (const roleId of result.rewardRoles) {
            try {
              const role = message.guild.roles.cache.get(roleId);
              if (role && message.member && !message.member.roles.cache.has(roleId)) {
                await message.member.roles.add(role);
              }
            } catch (error) {
              logger.error(`Failed to add role ${roleId} to member ${message.author.id}:`, error);
            }
          }
        }

        await targetChannel.send({ embeds: [embed] });
      }
    }

    // Add role rewards even if announce is disabled
    if (result.rewardRoles && result.rewardRoles.length > 0 && !config.announceLevelUp) {
      for (const roleId of result.rewardRoles) {
        try {
          const role = message.guild.roles.cache.get(roleId);
          if (role && message.member && !message.member.roles.cache.has(roleId)) {
            await message.member.roles.add(role);
          }
        } catch (error) {
          logger.error(`Failed to add role ${roleId} to member ${message.author.id}:`, error);
        }
      }
    }
  } catch (error) {
    logger.error('Failed to process XP gain:', error);
  }
}
