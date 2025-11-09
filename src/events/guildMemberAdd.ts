import { EmbedBuilder, Events, type GuildMember } from 'discord.js';
import { modLogService } from '../services/modLogService';
import { t } from '../i18n';
import { logger } from '../utils/logger';

export const name = Events.GuildMemberAdd;
export const once = false;

export async function execute(member: GuildMember) {
  try {
    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle(t('modLogs.member.join.title'))
      .setDescription(
        t('modLogs.member.join.description', {
          user: member.user.tag,
        })
      )
      .setThumbnail(member.user.displayAvatarURL())
      .addFields(
        {
          name: t('modLogs.fields.user'),
          value: `${member.user.tag} (${member.id})`,
          inline: false,
        },
        {
          name: t('modLogs.fields.accountCreated'),
          value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`,
          inline: true,
        },
        {
          name: t('modLogs.fields.joinedAt'),
          value: member.joinedTimestamp
            ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:F>`
            : t('common.unknown'),
          inline: true,
        }
      )
      .setTimestamp();

    await modLogService.sendLog(member.guild, 'member', {
      embeds: [embed],
    });
  } catch (error) {
    logger.error('Failed to log member join:', error);
  }
}
