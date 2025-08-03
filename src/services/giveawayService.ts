import {
  EmbedBuilder,
  TextChannel,
  User,
  Guild,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Message,
} from 'discord.js';
import { giveawayRepository } from '../repositories/giveawayRepository';
import { auditLogger } from '../security/audit';
import { t } from '../i18n';
import { nanoid } from 'nanoid';

export interface CreateGiveawayData {
  guildId: string;
  channelId: string;
  hostedBy: string;
  prize: string;
  winnerCount: number;
  endTime: Date;
  description: string | null;
  requirements: any;
  bonusEntries: any;
  embedColor: number;
}

export interface GiveawayResult {
  success: boolean;
  error?: string;
  winners?: string[];
}

export class GiveawayService {
  private activeTimers = new Map<string, NodeJS.Timeout>();

  async createGiveaway(data: CreateGiveawayData) {
    const giveawayId = `GW${nanoid(10)}`;

    const giveaway = await giveawayRepository.createGiveaway({
      giveawayId,
      ...data,
    });

    // Schedule the giveaway end
    this.scheduleGiveawayEnd(giveaway);

    // Log the action
    await auditLogger.logAction({
      action: 'GIVEAWAY_CREATE',
      userId: data.hostedBy,
      guildId: data.guildId,
      details: {
        giveawayId: giveaway.giveawayId,
        prize: data.prize,
        winnerCount: data.winnerCount,
        endTime: data.endTime,
      },
    });

    return giveaway;
  }

  async updateGiveawayMessage(giveawayId: string, messageId: string) {
    await giveawayRepository.updateGiveaway(giveawayId, { messageId });
  }

  async getGiveaway(giveawayId: string) {
    return giveawayRepository.getGiveaway(giveawayId);
  }

  async enterGiveaway(giveawayId: string, userId: string, guild: Guild): Promise<{ success: boolean; error?: string; entries?: number }> {
    const giveaway = await giveawayRepository.getGiveaway(giveawayId);
    
    if (!giveaway) {
      return { success: false, error: 'Giveaway not found' };
    }

    if (giveaway.status !== 'active') {
      return { success: false, error: 'This giveaway has ended' };
    }

    // Check requirements
    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) {
      return { success: false, error: 'Member not found' };
    }

    const requirementCheck = await this.checkRequirements(member, giveaway.requirements);
    if (!requirementCheck.met) {
      return { success: false, error: requirementCheck.reason };
    }

    // Calculate entries
    const bonusMultiplier = await this.calculateBonusEntries(member, giveaway.bonusEntries);
    const totalEntries = 1 * bonusMultiplier;

    // Add entry
    await giveawayRepository.addEntry(giveawayId, userId, totalEntries);

    return { success: true, entries: totalEntries };
  }

  async removeEntry(giveawayId: string, userId: string): Promise<{ success: boolean; error?: string }> {
    const giveaway = await giveawayRepository.getGiveaway(giveawayId);
    
    if (!giveaway) {
      return { success: false, error: 'Giveaway not found' };
    }

    if (giveaway.status !== 'active') {
      return { success: false, error: 'This giveaway has ended' };
    }

    await giveawayRepository.removeEntry(giveawayId, userId);
    return { success: true };
  }

  async endGiveaway(giveawayId: string, endedBy: User): Promise<GiveawayResult> {
    const giveaway = await giveawayRepository.getGiveaway(giveawayId);
    
    if (!giveaway) {
      return { success: false, error: 'Giveaway not found' };
    }

    if (giveaway.status !== 'active') {
      return { success: false, error: 'Giveaway already ended' };
    }

    // Get entries and select winners
    const entries = await giveawayRepository.getEntries(giveawayId);
    const winners = this.selectWinners(entries, giveaway.winnerCount);

    // Update giveaway status
    await giveawayRepository.updateGiveaway(giveawayId, {
      status: 'ended',
      winners,
      endedAt: new Date(),
    });

    // Cancel timer
    const timer = this.activeTimers.get(giveawayId);
    if (timer) {
      clearTimeout(timer);
      this.activeTimers.delete(giveawayId);
    }

    // Update the giveaway message
    await this.updateGiveawayEmbed(giveaway, winners);

    // Log the action
    await auditLogger.logAction({
      action: 'GIVEAWAY_END',
      userId: endedBy.id,
      guildId: giveaway.guildId,
      details: {
        giveawayId,
        winners,
        entryCount: entries.length,
      },
    });

    return { success: true, winners };
  }

  async rerollGiveaway(giveawayId: string, rerolledBy: User, newWinnerCount?: number): Promise<GiveawayResult> {
    const giveaway = await giveawayRepository.getGiveaway(giveawayId);
    
    if (!giveaway) {
      return { success: false, error: 'Giveaway not found' };
    }

    if (giveaway.status !== 'ended') {
      return { success: false, error: 'Giveaway must be ended before rerolling' };
    }

    const winnerCount = newWinnerCount || giveaway.winnerCount;

    // Get entries and select new winners
    const entries = await giveawayRepository.getEntries(giveawayId);
    const winners = this.selectWinners(entries, winnerCount);

    // Update giveaway with new winners
    await giveawayRepository.updateGiveaway(giveawayId, {
      winners,
      winnerCount,
    });

    // Update the giveaway message
    await this.updateGiveawayEmbed(giveaway, winners);

    // Log the action
    await auditLogger.logAction({
      action: 'GIVEAWAY_REROLL',
      userId: rerolledBy.id,
      guildId: giveaway.guildId,
      details: {
        giveawayId,
        oldWinners: giveaway.winners,
        newWinners: winners,
      },
    });

    return { success: true, winners };
  }

  async updateGiveaway(giveawayId: string, updates: any, updatedBy: User) {
    const giveaway = await giveawayRepository.getGiveaway(giveawayId);
    
    if (!giveaway || giveaway.status !== 'active') {
      throw new Error('Giveaway not found or not active');
    }

    await giveawayRepository.updateGiveaway(giveawayId, updates);

    // Update the giveaway embed
    const updatedGiveaway = await giveawayRepository.getGiveaway(giveawayId);
    await this.updateGiveawayEmbed(updatedGiveaway!);

    // Log the action
    await auditLogger.logAction({
      action: 'GIVEAWAY_UPDATE',
      userId: updatedBy.id,
      guildId: giveaway.guildId,
      details: {
        giveawayId,
        updates,
      },
    });
  }

  private async checkRequirements(member: any, requirements: any): Promise<{ met: boolean; reason?: string }> {
    // Check role requirements
    if (requirements.roleIds?.length > 0) {
      const hasRequiredRole = requirements.roleIds.some((roleId: string) => 
        member.roles.cache.has(roleId)
      );
      if (!hasRequiredRole) {
        return { met: false, reason: 'You must have one of the required roles' };
      }
    }

    // Check level requirement
    if (requirements.minLevel) {
      // This would check XP system
      // For now, we'll skip this check
    }

    // Check time in server requirement
    if (requirements.minTimeInServer) {
      const joinedAt = member.joinedAt;
      if (!joinedAt) {
        return { met: false, reason: 'Could not verify join date' };
      }

      const timeInServer = Date.now() - joinedAt.getTime();
      const requiredTime = this.parseTimeRequirement(requirements.minTimeInServer);
      
      if (timeInServer < requiredTime) {
        return { met: false, reason: `You must be in the server for at least ${requirements.minTimeInServer}` };
      }
    }

    return { met: true };
  }

  private async calculateBonusEntries(member: any, bonusEntries: any): Promise<number> {
    let multiplier = 1;

    // Check role bonuses
    if (bonusEntries.roles) {
      for (const [roleId, bonus] of Object.entries(bonusEntries.roles)) {
        if (member.roles.cache.has(roleId)) {
          multiplier = Math.max(multiplier, bonus as number);
        }
      }
    }

    // Check booster bonus
    if (bonusEntries.booster && member.premiumSince) {
      multiplier = Math.max(multiplier, bonusEntries.booster);
    }

    return multiplier;
  }

  private selectWinners(entries: any[], count: number): string[] {
    if (entries.length === 0) return [];

    // Create weighted array
    const weightedEntries: string[] = [];
    for (const entry of entries) {
      for (let i = 0; i < entry.entries; i++) {
        weightedEntries.push(entry.userId);
      }
    }

    // Shuffle and select unique winners
    const shuffled = weightedEntries.sort(() => Math.random() - 0.5);
    const winners = new Set<string>();
    
    for (const userId of shuffled) {
      winners.add(userId);
      if (winners.size >= Math.min(count, entries.length)) break;
    }

    return Array.from(winners);
  }

  private async updateGiveawayEmbed(giveaway: any, winners?: string[]) {
    const client = (global as any).client;
    if (!client) return;

    try {
      const channel = await client.channels.fetch(giveaway.channelId).catch(() => null) as TextChannel;
      if (!channel || !giveaway.messageId) return;

      const message = await channel.messages.fetch(giveaway.messageId).catch(() => null);
      if (!message) return;

      const embed = new EmbedBuilder()
        .setColor(giveaway.status === 'active' ? (giveaway.embedColor || 0x0099FF) : 0x808080)
        .setTitle(giveaway.status === 'active' ? t('commands.giveaway.embed.title') : t('commands.giveaway.embed.ended'))
        .setDescription(
          giveaway.description || 
          t('commands.giveaway.embed.description', { prize: giveaway.prize })
        )
        .addFields(
          {
            name: t('commands.giveaway.embed.hostedBy'),
            value: `<@${giveaway.hostedBy}>`,
            inline: true,
          },
          {
            name: t('commands.giveaway.embed.winners'),
            value: giveaway.winnerCount.toString(),
            inline: true,
          }
        )
        .setFooter({
          text: t('commands.giveaway.embed.footer', { id: giveaway.giveawayId }),
        })
        .setTimestamp();

      if (giveaway.status === 'active') {
        embed.addFields({
          name: t('commands.giveaway.embed.endsAt'),
          value: `<t:${Math.floor(giveaway.endTime.getTime() / 1000)}:R>`,
          inline: true,
        });
      } else if (winners && winners.length > 0) {
        embed.addFields({
          name: t('commands.giveaway.embed.winnersField'),
          value: winners.map(w => `<@${w}>`).join('\n'),
          inline: false,
        });
      } else {
        embed.addFields({
          name: t('commands.giveaway.embed.winnersField'),
          value: t('commands.giveaway.embed.noWinners'),
          inline: false,
        });
      }

      const components = giveaway.status === 'active' ? [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`gw_enter:${giveaway.giveawayId}`)
            .setLabel(t('commands.giveaway.buttons.enter'))
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🎉'),
          new ButtonBuilder()
            .setCustomId(`gw_info:${giveaway.giveawayId}`)
            .setLabel(t('commands.giveaway.buttons.info'))
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('ℹ️')
        )
      ] : [];

      await message.edit({ embeds: [embed], components });

      // Send winner announcement
      if (giveaway.status === 'ended' && winners && winners.length > 0) {
        await channel.send({
          content: t('commands.giveaway.winnerAnnouncement', {
            winners: winners.map(w => `<@${w}>`).join(', '),
            prize: giveaway.prize,
          }),
        });
      }
    } catch (error) {
      console.error('Error updating giveaway embed:', error);
    }
  }

  private scheduleGiveawayEnd(giveaway: any) {
    const timeUntilEnd = giveaway.endTime.getTime() - Date.now();
    
    if (timeUntilEnd <= 0) {
      // Giveaway should have already ended
      this.endGiveaway(giveaway.giveawayId, { id: 'system' } as User);
      return;
    }

    const timer = setTimeout(() => {
      this.endGiveaway(giveaway.giveawayId, { id: 'system' } as User);
      this.activeTimers.delete(giveaway.giveawayId);
    }, timeUntilEnd);

    this.activeTimers.set(giveaway.giveawayId, timer);
  }

  async initializeActiveGiveaways() {
    const activeGiveaways = await giveawayRepository.getActiveGiveaways();
    
    for (const giveaway of activeGiveaways) {
      this.scheduleGiveawayEnd(giveaway);
    }
  }

  private parseTimeRequirement(time: string): number {
    const regex = /^(\d+)([dhm])$/;
    const match = time.match(regex);
    
    if (!match) return 0;
    
    const value = parseInt(match[1]);
    const unit = match[2];
    
    switch (unit) {
      case 'd':
        return value * 24 * 60 * 60 * 1000;
      case 'h':
        return value * 60 * 60 * 1000;
      case 'm':
        return value * 60 * 1000;
      default:
        return 0;
    }
  }
}

export const giveawayService = new GiveawayService();