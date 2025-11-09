import {
  EmbedBuilder,
  Events,
  type GuildMember,
  type PartialGuildMember,
} from 'discord.js';
import { modLogService } from '../services/modLogService';
import { t } from '../i18n';
import { logger } from '../utils/logger';

export const name = Events.GuildMemberUpdate;
export const once = false;

export async function execute(
  oldMember: GuildMember | PartialGuildMember,
  newMember: GuildMember
) {
  try {
    if ('partial' in oldMember && oldMember.partial) {
      try {
        await oldMember.fetch();
      } catch (error) {
        logger.debug(`Failed to fetch partial member ${oldMember.id}:`, error);
      }
    }

    const changes: string[] = [];

    const oldNickname =
      'nickname' in oldMember && oldMember.nickname !== undefined
        ? oldMember.nickname
        : null;
    const newNickname = newMember.nickname;

    if (oldNickname !== newNickname) {
      changes.push(
        t('modLogs.member.update.nickname', {
          old: oldNickname ?? t('modLogs.member.update.noNickname'),
          current: newNickname ?? t('modLogs.member.update.noNickname'),
        })
      );
    }

    if ('roles' in oldMember && oldMember.roles) {
      const addedRoles = newMember.roles.cache.filter(
        role => !oldMember.roles.cache.has(role.id)
      );
      const removedRoles = oldMember.roles.cache.filter(
        role => !newMember.roles.cache.has(role.id)
      );

      if (addedRoles.size > 0) {
        changes.push(
          t('modLogs.member.update.rolesAdded', {
            roles: addedRoles.map(role => `<@&${role.id}>`).join(', '),
          })
        );
      }

      if (removedRoles.size > 0) {
        changes.push(
          t('modLogs.member.update.rolesRemoved', {
            roles: removedRoles.map(role => `<@&${role.id}>`).join(', '),
          })
        );
      }
    }

    if (changes.length === 0) {
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(t('modLogs.member.update.title'))
      .setDescription(
        t('modLogs.member.update.description', {
          user: `${newMember.user.tag} (${newMember.id})`,
        })
      )
      .addFields({
        name: t('modLogs.member.update.changes'),
        value: changes.join('\n'),
        inline: false,
      })
      .setTimestamp();

    await modLogService.sendLog(newMember.guild, 'member', {
      embeds: [embed],
    });
  } catch (error) {
    logger.error('Failed to log member update:', error);
  }
}
