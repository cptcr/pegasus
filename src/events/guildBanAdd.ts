import { EmbedBuilder, Events, type GuildBan } from 'discord.js';
import { modLogService } from '../services/modLogService';
import { t } from '../i18n';
import { logger } from '../utils/logger';

export const name = Events.GuildBanAdd;
export const once = false;

export async function execute(ban: GuildBan) {
  try {
    const embed = new EmbedBuilder()
      .setColor(0xed4245)
      .setTitle(t('modLogs.moderation.ban.title'))
      .setDescription(
        t('modLogs.moderation.ban.description', {
          user: `${ban.user.tag} (${ban.user.id})`,
        })
      )
      .addFields(
        {
          name: t('modLogs.fields.reason'),
          value: ban.reason ?? t('common.noReasonProvided'),
          inline: false,
        },
        {
          name: t('modLogs.fields.bannedAt'),
          value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
          inline: true,
        }
      )
      .setThumbnail(ban.user.displayAvatarURL())
      .setTimestamp();

    await modLogService.sendLog(ban.guild, 'moderation', {
      embeds: [embed],
    });
  } catch (error) {
    logger.error('Failed to log guild ban add:', error);
  }
}
