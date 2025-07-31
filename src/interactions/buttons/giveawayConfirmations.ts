import { ButtonInteraction, PermissionFlagsBits } from 'discord.js';
import { giveawayHandler } from '../../handlers/giveaway';
import { i18n } from '../../i18n';
import { logger } from '../../utils/logger';
import { createErrorEmbed, createSuccessEmbed } from '../../utils/helpers';

/**
 * Handle giveaway end confirmation button
 */
export async function handleGiveawayConfirmEnd(interaction: ButtonInteraction): Promise<void> {
    try {
        const giveawayId = interaction.customId.replace('giveaway_confirm_end_', '');
        const userId = interaction.user.id;
        const guildId = interaction.guildId!;
        
        // Create translator for this user/guild
        const t = i18n.createTranslator(userId, guildId);

        // Check permissions
        if (!await checkManagementPermissions(interaction)) {
            return;
        }

        await interaction.deferReply({ ephemeral: true });

        // End the giveaway
        const result = await giveawayHandler.endGiveaway(giveawayId, true);

        if (result.success) {
            const winnerList = result.winners?.map(id => `<@${id}>`).join(', ') || 'None';
            
            await interaction.editReply({
                embeds: [createSuccessEmbed(
                    t('giveaway.end.success.title', {}, '🎉 Giveaway Ended'),
                    t('giveaway.end.success.description', { 
                        count: result.winners?.length || 0,
                        winners: winnerList
                    }, `**Winners (${result.winners?.length}):** ${winnerList}`)
                )]
            });

            // Update the original message to remove the confirmation buttons
            await interaction.message.edit({
                embeds: interaction.message.embeds,
                components: []
            }).catch(() => {});

            logger.audit('GIVEAWAY_ENDED_EARLY', userId, guildId, {
                giveawayId,
                winners: result.winners
            });
        } else {
            await interaction.editReply({
                embeds: [createErrorEmbed(
                    t('giveaway.end.error.title', {}, 'End Failed'),
                    result.message
                )]
            });
        }

    } catch (error) {
        logger.error('Error handling giveaway end confirmation', error as Error);
        
        if (interaction.deferred) {
            await interaction.editReply({
                content: 'An error occurred while ending the giveaway.'
            }).catch(() => {});
        }
    }
}

/**
 * Handle giveaway cancel confirmation button
 */
export async function handleGiveawayConfirmCancel(interaction: ButtonInteraction): Promise<void> {
    try {
        const giveawayId = interaction.customId.replace('giveaway_confirm_cancel_', '');
        const userId = interaction.user.id;
        const guildId = interaction.guildId!;
        
        // Create translator for this user/guild
        const t = i18n.createTranslator(userId, guildId);

        // Check permissions
        if (!await checkManagementPermissions(interaction)) {
            return;
        }

        await interaction.deferReply({ ephemeral: true });

        // Cancel the giveaway
        const result = await giveawayHandler.cancelGiveaway(giveawayId, 'Cancelled by administrator');

        if (result.success) {
            await interaction.editReply({
                embeds: [createSuccessEmbed(
                    t('giveaway.cancel.success.title', {}, '🗑️ Giveaway Cancelled'),
                    t('giveaway.cancel.success.description', {}, result.message)
                )]
            });

            // Update the original message to remove the confirmation buttons
            await interaction.message.edit({
                embeds: interaction.message.embeds,
                components: []
            }).catch(() => {});

            logger.audit('GIVEAWAY_CANCELLED', userId, guildId, {
                giveawayId,
                reason: 'Cancelled by administrator'
            });
        } else {
            await interaction.editReply({
                embeds: [createErrorEmbed(
                    t('giveaway.cancel.error.title', {}, 'Cancel Failed'),
                    result.message
                )]
            });
        }

    } catch (error) {
        logger.error('Error handling giveaway cancel confirmation', error as Error);
        
        if (interaction.deferred) {
            await interaction.editReply({
                content: 'An error occurred while cancelling the giveaway.'
            }).catch(() => {});
        }
    }
}

/**
 * Handle giveaway action cancellation button
 */
export async function handleGiveawayCancelAction(interaction: ButtonInteraction): Promise<void> {
    try {
        const userId = interaction.user.id;
        const guildId = interaction.guildId!;
        
        // Create translator for this user/guild
        const t = i18n.createTranslator(userId, guildId);

        await interaction.reply({
            content: t('giveaway.action_cancelled', {}, '✅ Action cancelled.'),
            ephemeral: true
        });

        // Update the original message to remove the confirmation buttons
        await interaction.message.edit({
            embeds: interaction.message.embeds,
            components: []
        }).catch(() => {});

    } catch (error) {
        logger.error('Error handling giveaway action cancellation', error as Error);
        
        await interaction.reply({
            content: 'Action cancelled.',
            ephemeral: true
        }).catch(() => {});
    }
}

/**
 * Handle giveaway entries export button
 */
export async function handleGiveawayEntriesExport(interaction: ButtonInteraction): Promise<void> {
    try {
        const giveawayId = interaction.customId.replace('giveaway_entries_export_', '');
        const userId = interaction.user.id;
        const guildId = interaction.guildId!;
        
        // Create translator for this user/guild
        const t = i18n.createTranslator(userId, guildId);

        // Check permissions
        if (!await checkManagementPermissions(interaction)) {
            return;
        }

        await interaction.deferReply({ ephemeral: true });

        const giveaway = await giveawayHandler.getGiveaway(giveawayId);
        if (!giveaway) {
            await interaction.editReply({
                content: t('giveaway.not_found', {}, 'Giveaway not found.'),
            });
            return;
        }

        try {
            const entries = await giveawayHandler.getGiveawayEntries(giveawayId);
            const winners = await giveawayHandler.getGiveawayWinners(giveawayId);
            
            // Create CSV-like format
            let csvData = 'User ID,Username,Entry Count,Bonus Reason,Entry Time,Is Winner\n';
            
            for (const entry of entries) {
                const user = await interaction.client.users.fetch(entry.userId).catch(() => null);
                const username = user ? user.username.replace(/,/g, ';') : 'Unknown User';
                const isWinner = winners.some(w => w.userId === entry.userId);
                
                csvData += `${entry.userId},"${username}",${entry.entryCount},"${entry.bonusReason || 'None'}","${entry.entryTime.toISOString()}",${isWinner ? 'Yes' : 'No'}\n`;
            }

            // Create a text file attachment
            const buffer = Buffer.from(csvData, 'utf8');
            const attachment = {
                attachment: buffer,
                name: `giveaway-${giveaway.id}-export.csv`
            };

            const embed = createSuccessEmbed(
                t('giveaway.export.success.title', {}, '📁 Data Exported'),
                t('giveaway.export.success.description', { 
                    participants: entries.length,
                    winners: winners.length
                }, `Exported data for ${entries.length} participants and ${winners.length} winners.`)
            );

            await interaction.editReply({
                embeds: [embed],
                files: [attachment]
            });

            logger.audit('GIVEAWAY_DATA_EXPORTED', userId, guildId, {
                giveawayId,
                participantCount: entries.length,
                winnerCount: winners.length
            });

        } catch (error) {
            logger.error('Error exporting giveaway data', error as Error);
            await interaction.editReply({
                content: t('error.export_failed', {}, 'Failed to export giveaway data.')
            });
        }

    } catch (error) {
        logger.error('Error handling giveaway entries export', error as Error);
        
        if (interaction.deferred) {
            await interaction.editReply({
                content: 'An error occurred while exporting data.'
            }).catch(() => {});
        }
    }
}

/**
 * Handle giveaway reroll confirmation (for complex rerolls that need confirmation)
 */
export async function handleGiveawayConfirmReroll(interaction: ButtonInteraction): Promise<void> {
    try {
        const customIdParts = interaction.customId.split('_');
        const giveawayId = customIdParts.slice(-2, -1)[0]; // Extract giveaway ID
        const rerollCount = parseInt(customIdParts.slice(-1)[0]) || 1; // Extract reroll count
        
        const userId = interaction.user.id;
        const guildId = interaction.guildId!;
        
        // Create translator for this user/guild
        const t = i18n.createTranslator(userId, guildId);

        // Check permissions
        if (!await checkManagementPermissions(interaction)) {
            return;
        }

        await interaction.deferReply({ ephemeral: true });

        // Perform the reroll
        const result = await giveawayHandler.rerollGiveaway(giveawayId, rerollCount);

        if (result.success) {
            const winnerList = result.winners?.map(id => `<@${id}>`).join(', ') || 'None';
            
            await interaction.editReply({
                embeds: [createSuccessEmbed(
                    t('giveaway.reroll.success.title', {}, '🔄 Giveaway Rerolled'),
                    t('giveaway.reroll.success.description', { 
                        count: result.winners?.length || 0,
                        winners: winnerList
                    }, `**New Winners (${result.winners?.length}):** ${winnerList}`)
                )]
            });

            // Update the original message to remove the confirmation buttons
            await interaction.message.edit({
                embeds: interaction.message.embeds,
                components: []
            }).catch(() => {});

            logger.audit('GIVEAWAY_REROLLED', userId, guildId, {
                giveawayId,
                rerollCount,
                newWinners: result.winners
            });
        } else {
            await interaction.editReply({
                embeds: [createErrorEmbed(
                    t('giveaway.reroll.error.failed.title', {}, 'Reroll Failed'),
                    result.message
                )]
            });
        }

    } catch (error) {
        logger.error('Error handling giveaway reroll confirmation', error as Error);
        
        if (interaction.deferred) {
            await interaction.editReply({
                content: 'An error occurred while rerolling the giveaway.'
            }).catch(() => {});
        }
    }
}

/**
 * Check if user has management permissions
 */
async function checkManagementPermissions(interaction: ButtonInteraction): Promise<boolean> {
    const member = interaction.member;
    
    if (!member) {
        await interaction.reply({
            content: 'Unable to verify your permissions.',
            ephemeral: true
        });
        return false;
    }

    // Check if user has administrator permissions or manage messages
    const hasPermissions = member.permissions instanceof Array 
        ? false 
        : member.permissions.has([PermissionFlagsBits.Administrator, PermissionFlagsBits.ManageMessages], false);

    if (!hasPermissions) {
        await interaction.reply({
            content: '❌ You do not have permission to manage giveaways. Required: Administrator or Manage Messages.',
            ephemeral: true
        });
        return false;
    }

    return true;
}