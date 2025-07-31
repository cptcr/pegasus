import { ModalSubmitInteraction, PermissionFlagsBits } from 'discord.js';
import { giveawayHandler } from '../../handlers/giveaway';
import { i18n } from '../../i18n';
import { logger } from '../../utils/logger';
import { createErrorEmbed, createSuccessEmbed } from '../../utils/helpers';

/**
 * Handle giveaway edit modal submissions
 */
export async function handleGiveawayEditModal(interaction: ModalSubmitInteraction): Promise<void> {
    try {
        const giveawayId = interaction.customId.replace('giveaway_edit_modal_', '');
        const userId = interaction.user.id;
        const guildId = interaction.guildId!;
        
        const t = i18n.createTranslator(userId, guildId);

        if (!await checkManagementPermissions(interaction)) {
            return;
        }

        await interaction.deferReply({ ephemeral: true });

        const title = interaction.fields.getTextInputValue('title')?.trim();
        const description = interaction.fields.getTextInputValue('description')?.trim() || undefined;
        const prize = interaction.fields.getTextInputValue('prize')?.trim();
        const winnerCountStr = interaction.fields.getTextInputValue('winner_count')?.trim();

        if (!title || title.length < 3) {
            await interaction.editReply({
                embeds: [createErrorEmbed(
                    t('giveaway.edit.error.title', {}, 'Invalid Title'),
                    t('giveaway.edit.error.title_length', {}, 'Title must be at least 3 characters long.')
                )]
            });
            return;
        }

        if (!prize || prize.length < 1) {
            await interaction.editReply({
                embeds: [createErrorEmbed(
                    t('giveaway.edit.error.title', {}, 'Invalid Prize'),
                    t('giveaway.edit.error.prize_required', {}, 'Prize is required.')
                )]
            });
            return;
        }

        const winnerCount = parseInt(winnerCountStr);
        if (isNaN(winnerCount) || winnerCount < 1 || winnerCount > 20) {
            await interaction.editReply({
                embeds: [createErrorEmbed(
                    t('giveaway.edit.error.title', {}, 'Invalid Winner Count'),
                    t('giveaway.edit.error.winner_count', {}, 'Winner count must be between 1 and 20.')
                )]
            });
            return;
        }

        const success = await giveawayHandler.updateGiveaway(giveawayId, {
            title,
            description,
            prize,
            winnerCount
        });

        if (success) {
            await interaction.editReply({
                embeds: [createSuccessEmbed(
                    t('giveaway.edit.success.title', {}, 'Giveaway Updated'),
                    t('giveaway.edit.success.description', {}, 'The giveaway has been updated successfully.')
                )]
            });
        } else {
            await interaction.editReply({
                embeds: [createErrorEmbed(
                    t('giveaway.edit.error.title', {}, 'Update Failed'),
                    t('giveaway.edit.error.update_failed', {}, 'Failed to update the giveaway.')
                )]
            });
        }

    } catch (error) {
        logger.error('Error handling giveaway edit modal', error as Error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                embeds: [createErrorEmbed('Error', 'An unexpected error occurred.')],
                ephemeral: true
            });
        }
    }
}

/**
 * Check if user has management permissions
 */
async function checkManagementPermissions(interaction: ModalSubmitInteraction): Promise<boolean> {
    const member = interaction.guild?.members.cache.get(interaction.user.id);
    
    if (!member?.permissions.has(PermissionFlagsBits.ManageMessages)) {
        await interaction.reply({
            embeds: [createErrorEmbed('Permission Denied', 'You need Manage Messages permission to manage giveaways.')],
            ephemeral: true
        });
        return false;
    }
    
    return true;
}