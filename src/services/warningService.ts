import { 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  EmbedBuilder,
  Guild,
  GuildMember,
  TextChannel,
  User
} from 'discord.js';
import { warningRepository } from '../repositories/warningRepository';
import { auditLogger } from '../security/audit';
import { t } from '../i18n';

export interface WarningAction {
  type: 'ban' | 'kick' | 'mute' | 'role' | 'message';
  duration?: number;
  roleId?: string;
  message?: string;
}

export class WarningService {
  async createWarning(
    guild: Guild,
    user: User,
    moderator: User,
    title: string,
    description?: string,
    level: number = 1,
    proof?: string
  ) {
    // Create the warning
    const warning = await warningRepository.createWarning({
      guildId: guild.id,
      userId: user.id,
      moderatorId: moderator.id,
      title,
      description,
      level,
      proof,
    });

    // Log the action
    await auditLogger.logAction({
      action: 'WARN_CREATE',
      userId: moderator.id,
      guildId: guild.id,
      targetId: user.id,
      details: {
        warnId: warning.warnId,
        title,
        level,
      },
    });

    // Check automations
    await this.checkAutomations(guild, user);

    return warning;
  }

  async editWarning(
    warnId: string,
    title: string,
    description: string | null,
    editedBy: User
  ) {
    const warning = await warningRepository.getWarningById(warnId);
    if (!warning) {
      throw new Error('Warning not found');
    }

    const updated = await warningRepository.updateWarning(warnId, {
      title,
      description: description || undefined,
      editedBy: editedBy.id,
    });

    await auditLogger.logAction({
      action: 'WARN_EDIT',
      userId: editedBy.id,
      guildId: warning.guildId,
      targetId: warning.userId,
      details: {
        warnId,
        oldTitle: warning.title,
        newTitle: title,
      },
    });

    return updated;
  }

  async checkAutomations(guild: Guild, user: User) {
    const stats = await warningRepository.getUserWarningStats(guild.id, user.id);
    const automations = await warningRepository.getActiveAutomations(guild.id);

    for (const automation of automations) {
      let shouldTrigger = false;

      if (automation.triggerType === 'warn_count' && stats.count >= automation.triggerValue) {
        shouldTrigger = true;
      } else if (automation.triggerType === 'warn_level' && stats.totalLevel >= automation.triggerValue) {
        shouldTrigger = true;
      }

      if (shouldTrigger) {
        // Check if automation was triggered recently (cooldown of 1 hour)
        if (automation.lastTriggeredAt) {
          const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
          if (automation.lastTriggeredAt > hourAgo) {
            continue;
          }
        }

        await this.executeAutomation(guild, user, automation, stats);
        await warningRepository.updateAutomationLastTriggered(automation.automationId);
      }
    }
  }

  private async executeAutomation(
    guild: Guild,
    user: User,
    automation: any,
    stats: { count: number; totalLevel: number }
  ) {
    const actions = automation.actions as WarningAction[];
    
    // Send notification with action buttons if configured
    const notificationChannel = guild.systemChannel || guild.channels.cache.find(
      (ch): ch is TextChannel => ch.type === 0 && ch.permissionsFor(guild.members.me!)?.has('SendMessages') || false
    );

    if (notificationChannel) {
      const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle(t('warnings.automation.triggered'))
        .setDescription(
          t('warnings.automation.description', {
            user: user.tag,
            userId: user.id,
            automation: automation.name,
            count: stats.count,
            level: stats.totalLevel,
          })
        )
        .setTimestamp();

      const row = new ActionRowBuilder<ButtonBuilder>();

      // Add action buttons based on automation actions
      for (const action of actions) {
        if (action.type === 'ban') {
          row.addComponents(
            new ButtonBuilder()
              .setCustomId(`warn_action:ban:${user.id}`)
              .setLabel(t('warnings.actions.ban'))
              .setStyle(ButtonStyle.Danger)
          );
        } else if (action.type === 'kick') {
          row.addComponents(
            new ButtonBuilder()
              .setCustomId(`warn_action:kick:${user.id}`)
              .setLabel(t('warnings.actions.kick'))
              .setStyle(ButtonStyle.Danger)
          );
        } else if (action.type === 'mute' && action.duration) {
          row.addComponents(
            new ButtonBuilder()
              .setCustomId(`warn_action:mute:${user.id}:${action.duration}`)
              .setLabel(t('warnings.actions.mute', { duration: action.duration }))
              .setStyle(ButtonStyle.Secondary)
          );
        }
      }

      // Add view warnings button
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`warn_view:${user.id}`)
          .setLabel(t('warnings.actions.view'))
          .setStyle(ButtonStyle.Primary)
      );

      await notificationChannel.send({
        embeds: [embed],
        components: row.components.length > 0 ? [row] : [],
      });
    }

    // Execute automatic actions (non-interactive)
    for (const action of actions) {
      if (action.type === 'message' && action.message) {
        // Send a DM to the user
        try {
          await user.send(action.message);
        } catch (error) {
          // User has DMs disabled
        }
      } else if (action.type === 'role' && action.roleId) {
        // Add role to user
        const member = await guild.members.fetch(user.id).catch(() => null);
        if (member) {
          await member.roles.add(action.roleId).catch(() => {});
        }
      }
    }
  }

  async getWarningEmbed(warning: any, guild: Guild): Promise<EmbedBuilder> {
    const user = await guild.client.users.fetch(warning.userId).catch(() => null);
    const moderator = await guild.client.users.fetch(warning.moderatorId).catch(() => null);

    const embed = new EmbedBuilder()
      .setColor(0xFFA500)
      .setTitle(t('warnings.embed.title', { warnId: warning.warnId }))
      .addFields(
        {
          name: t('warnings.embed.user'),
          value: user ? `${user.tag} (${user.id})` : warning.userId,
          inline: true,
        },
        {
          name: t('warnings.embed.moderator'),
          value: moderator ? `${moderator.tag}` : warning.moderatorId,
          inline: true,
        },
        {
          name: t('warnings.embed.level'),
          value: warning.level.toString(),
          inline: true,
        },
        {
          name: t('warnings.embed.title'),
          value: warning.title,
          inline: false,
        }
      )
      .setTimestamp(warning.createdAt);

    if (warning.description) {
      embed.addFields({
        name: t('warnings.embed.description'),
        value: warning.description,
        inline: false,
      });
    }

    if (warning.proof) {
      embed.setImage(warning.proof);
    }

    if (warning.editedAt && warning.editedBy) {
      const editor = await guild.client.users.fetch(warning.editedBy).catch(() => null);
      embed.setFooter({
        text: t('warnings.embed.edited', {
          editor: editor ? editor.tag : warning.editedBy,
          date: warning.editedAt.toLocaleString(),
        }),
      });
    }

    return embed;
  }

  async createAutomation(
    guild: Guild,
    name: string,
    description: string | undefined,
    triggerType: 'warn_count' | 'warn_level',
    triggerValue: number,
    actions: WarningAction[],
    createdBy: User
  ) {
    const automation = await warningRepository.createAutomation({
      guildId: guild.id,
      name,
      description,
      triggerType,
      triggerValue,
      actions,
      createdBy: createdBy.id,
    });

    await auditLogger.logAction({
      action: 'WARN_AUTOMATION_CREATE',
      userId: createdBy.id,
      guildId: guild.id,
      details: {
        automationId: automation.automationId,
        name,
        triggerType,
        triggerValue,
      },
    });

    return automation;
  }

  async deleteAutomation(automationId: string, deletedBy: User) {
    const automation = await warningRepository.deleteAutomation(automationId);
    
    if (automation) {
      await auditLogger.logAction({
        action: 'WARN_AUTOMATION_DELETE',
        userId: deletedBy.id,
        guildId: automation.guildId,
        details: {
          automationId: automation.automationId,
          name: automation.name,
        },
      });
    }

    return automation;
  }
}

export const warningService = new WarningService();