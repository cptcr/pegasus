import { EmbedBuilder, Events, type GuildBan } from 'discord.js';
import { modLogService } from '../services/modLogService';
import { t } from '../i18n';
import { logger } from '../utils/logger';

export const name = Events.GuildBanRemove;
export const once = false;

export async function execute(ban: GuildBan) {
  try {
    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle(t('modLogs.moderation.unban.title'))
      .setDescription(
        t('modLogs.moderation.unban.description', {
          user: `${ban.user.tag} (${ban.user.id})`,
        })
      )
      .setThumbnail(ban.user.displayAvatarURL())
      .addFields({
        name: t('modLogs.fields.unbannedAt'),
        value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
        inline: true,
      })
      .setTimestamp();

    await modLogService.sendLog(ban.guild, 'moderation', {
      embeds: [embed],
    });
  } catch (error) {
    logger.error('Failed to log guild ban remove:', error);
  }
}
