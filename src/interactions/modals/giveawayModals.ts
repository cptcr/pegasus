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
        
        // Create translator for this user/guild
        const t = i18n.createTranslator(userId, guildId);

        // Check permissions
        if (!await checkManagementPermissions(interaction)) {
            return;
        }

        await interaction.deferReply({ ephemeral: true });

        // Extract field values
        const title = interaction.fields.getTextInputValue('title')?.trim();
        const description = interaction.fields.getTextInputValue('description')?.trim() || undefined;
        const prize = interaction.fields.getTextInputValue('prize')?.trim();
        const winnerCountStr = interaction.fields.getTextInputValue('winner_count')?.trim();

        // Validate inputs
        if (!title || title.length < 3) {
            await interaction.editReply({
                embeds: [createErrorEmbed(
                    t('giveaway.edit.error.title', {}, 'Invalid Title'),
                    t('giveaway.edit.error.title_length', {}, 'Title must be at least 3 characters long.')
                )}
            });
            return;
        }

        if (!prize || prize.length < 1) {
            await interaction.editReply({
                embeds: [createErrorEmbed(
                    t('giveaway.edit.error.title', {}, 'Invalid Prize'),
                    t('giveaway.edit.error.prize_required', {}, 'Prize is required.')
                )}
            });
            return;
        }

        const winnerCount = parseInt(winnerCountStr);
        if (isNaN(winnerCount) || winnerCount < 1 || winnerCount > 100) {
            await interaction.editReply({
                embeds: [createErrorEmbed(
                    t('giveaway.edit.error.title', {}, 'Invalid Winner Count'),
                    t('giveaway.edit.error.winner_count', {}, 'Winner count must be between 1 and 100.')
                )}
            });
            return;
        }

        // Update giveaway
        const result = await giveawayHandler.updateGiveawayDetails(giveawayId, {
            title,
            description,
            prize,
            winnerCount
        });

        if (result.success) {
            await interaction.editReply({
                embeds: [createSuccessEmbed(
                    t('giveaway.edit.success.title', {}, '✅ Giveaway Updated'),
                    t('giveaway.edit.success.description', {}, result.message)
                )]
            });

            logger.info('Giveaway details updated', {
                giveawayId,
                userId,
                guildId,
                updates: { title, description, prize, winnerCount }
            });
        } else {
            await interaction.editReply({
                embeds: [createErrorEmbed(
                    t('giveaway.edit.error.title', {}, 'Update Failed'),
                    result.message
                )]
            });
        }

    } catch (error) {
        logger.error('Error handling giveaway edit modal', error as Error);
        
        if (interaction.deferred) {
            await interaction.editReply({
                content: 'An error occurred while updating the giveaway.'
            }).catch(() => {});
        } else if (!interaction.replied) {
            await interaction.reply({
                content: 'An error occurred while updating the giveaway.',
                ephemeral: true
            }).catch(() => {});
        }
    }
}

/**
 * Handle giveaway reroll modal submissions
 */
export async function handleGiveawayRerollModal(interaction: ModalSubmitInteraction): Promise<void> {
    try {
        const giveawayId = interaction.customId.replace('giveaway_reroll_modal_', '');
        const userId = interaction.user.id;
        const guildId = interaction.guildId!;
        
        // Create translator for this user/guild
        const t = i18n.createTranslator(userId, guildId);

        // Check permissions
        if (!await checkManagementPermissions(interaction)) {
            return;
        }

        await interaction.deferReply({ ephemeral: true });

        // Extract field values
        const rerollCountStr = interaction.fields.getTextInputValue('reroll_count')?.trim() || '1';
        const reason = interaction.fields.getTextInputValue('reroll_reason')?.trim();

        // Validate reroll count
        const rerollCount = parseInt(rerollCountStr);
        if (isNaN(rerollCount) || rerollCount < 1 || rerollCount > 20) {
            await interaction.editReply({
                embeds: [createErrorEmbed(
                    t('giveaway.reroll.error.title', {}, 'Invalid Reroll Count'),
                    t('giveaway.reroll.error.count_range', {}, 'Reroll count must be between 1 and 20.')
                )}
            });
            return;
        }

        // Perform reroll
        const result = await giveawayHandler.rerollGiveaway(giveawayId, rerollCount);

        if (result.success) {
            const winnerList = result.winners?.map(id => `<@${id}>`).join(', ') || 'None';
            
            await interaction.editReply({
                embeds: [createSuccessEmbed(
                    t('giveaway.reroll.success.title', {}, '🔄 Giveaway Rerolled'),
                    t('giveaway.reroll.success.description', { 
                        count: result.winners?.length || 0,
                        winners: winnerList,
                        reason: reason || 'No reason provided'
                    }, `**New Winners (${result.winners?.length}):** ${winnerList}\n\n${reason ? `**Reason:** ${reason}` : ''}`)
                )]
            });

            logger.audit('GIVEAWAY_REROLLED', userId, guildId, {
                giveawayId,
                rerollCount,
                newWinners: result.winners,
                reason
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
        logger.error('Error handling giveaway reroll modal', error as Error);
        
        if (interaction.deferred) {
            await interaction.editReply({
                content: 'An error occurred while rerolling the giveaway.'
            }).catch(() => {});
        }
    }
}

/**
 * Handle giveaway requirements modal submissions
 */
export async function handleGiveawayRequirementsModal(interaction: ModalSubmitInteraction): Promise<void> {
    try {
        const giveawayId = interaction.customId.replace('giveaway_requirements_modal_', '');
        const userId = interaction.user.id;
        const guildId = interaction.guildId!;
        
        // Create translator for this user/guild
        const t = i18n.createTranslator(userId, guildId);

        // Check permissions
        if (!await checkManagementPermissions(interaction)) {
            return;
        }

        await interaction.deferReply({ ephemeral: true });

        // Extract field values
        const minLevelStr = interaction.fields.getTextInputValue('min_level')?.trim() || '0';
        const minAccountAgeStr = interaction.fields.getTextInputValue('min_account_age')?.trim() || '0';
        const minJoinAgeStr = interaction.fields.getTextInputValue('min_join_age')?.trim() || '0';

        // Validate and parse values
        const minLevel = parseInt(minLevelStr);
        const minAccountAgeDays = parseInt(minAccountAgeStr);
        const minJoinAgeDays = parseInt(minJoinAgeStr);

        if (isNaN(minLevel) || minLevel < 0 || minLevel > 1000) {
            await interaction.editReply({
                embeds: [createErrorEmbed(
                    t('giveaway.requirements.error.title', {}, 'Invalid Requirements'),
                    t('giveaway.requirements.error.level', {}, 'Minimum level must be between 0 and 1000.')
                )}
            });
            return;
        }

        if (isNaN(minAccountAgeDays) || minAccountAgeDays < 0 || minAccountAgeDays > 3650) {
            await interaction.editReply({
                embeds: [createErrorEmbed(
                    t('giveaway.requirements.error.title', {}, 'Invalid Requirements'),
                    t('giveaway.requirements.error.account_age', {}, 'Account age must be between 0 and 3650 days.')
                )}
            });
            return;
        }

        if (isNaN(minJoinAgeDays) || minJoinAgeDays < 0 || minJoinAgeDays > 3650) {
            await interaction.editReply({
                embeds: [createErrorEmbed(
                    t('giveaway.requirements.error.title', {}, 'Invalid Requirements'),
                    t('giveaway.requirements.error.join_age', {}, 'Join age must be between 0 and 3650 days.')
                )}
            });
            return;
        }

        // Build requirements object
        const requirements: any = {};
        
        if (minLevel > 0) {
            requirements.minLevel = minLevel;
        }
        
        if (minAccountAgeDays > 0) {
            requirements.minAccountAge = minAccountAgeDays * 24 * 60 * 60 * 1000; // Convert to milliseconds
        }
        
        if (minJoinAgeDays > 0) {
            requirements.minJoinAge = minJoinAgeDays * 24 * 60 * 60 * 1000; // Convert to milliseconds
        }

        // Update giveaway requirements
        const result = await giveawayHandler.updateGiveawayRequirements(giveawayId, requirements);

        if (result.success) {
            const requirementsList = [];
            if (requirements.minLevel) requirementsList.push(`Level ${requirements.minLevel}+`);
            if (requirements.minAccountAge) requirementsList.push(`Account ${minAccountAgeDays}+ days old`);
            if (requirements.minJoinAge) requirementsList.push(`Joined ${minJoinAgeDays}+ days ago`);
            
            await interaction.editReply({
                embeds: [createSuccessEmbed(
                    t('giveaway.requirements.success.title', {}, '✅ Requirements Updated'),
                    t('giveaway.requirements.success.description', { 
                        requirements: requirementsList.length > 0 ? requirementsList.join('\n') : 'No requirements'
                    }, `**New Requirements:**\n${requirementsList.length > 0 ? requirementsList.join('\n') : 'No requirements'}`)
                )]
            });

            logger.info('Giveaway requirements updated', {
                giveawayId,
                userId,
                guildId,
                requirements
            });
        } else {
            await interaction.editReply({
                embeds: [createErrorEmbed(
                    t('giveaway.requirements.error.failed.title', {}, 'Update Failed'),
                    result.message
                )]
            });
        }

    } catch (error) {
        logger.error('Error handling giveaway requirements modal', error as Error);
        
        if (interaction.deferred) {
            await interaction.editReply({
                content: 'An error occurred while updating requirements.'
            }).catch(() => {});
        }
    }
}

/**
 * Handle giveaway manage entries modal submissions
 */
export async function handleGiveawayManageEntriesModal(interaction: ModalSubmitInteraction): Promise<void> {
    try {
        const giveawayId = interaction.customId.replace('giveaway_manage_entries_modal_', '');
        const userId = interaction.user.id;
        const guildId = interaction.guildId!;
        
        // Create translator for this user/guild
        const t = i18n.createTranslator(userId, guildId);

        // Check permissions
        if (!await checkManagementPermissions(interaction)) {
            return;
        }

        await interaction.deferReply({ ephemeral: true });

        // Extract field values
        const action = interaction.fields.getTextInputValue('action')?.trim().toLowerCase();
        const targetUserId = interaction.fields.getTextInputValue('user_id')?.trim();
        const entryCountStr = interaction.fields.getTextInputValue('entry_count')?.trim() || '1';
        const reason = interaction.fields.getTextInputValue('reason')?.trim();

        // Validate action
        if (!action || !['add', 'remove'].includes(action)) {
            await interaction.editReply({
                embeds: [createErrorEmbed(
                    t('giveaway.manage_entries.error.title', {}, 'Invalid Action'),
                    t('giveaway.manage_entries.error.action', {}, 'Action must be either "add" or "remove".')
                )}
            });
            return;
        }

        // Validate user ID
        if (!targetUserId || !/^\d{17,19}$/.test(targetUserId)) {
            await interaction.editReply({
                embeds: [createErrorEmbed(
                    t('giveaway.manage_entries.error.title', {}, 'Invalid User ID'),
                    t('giveaway.manage_entries.error.user_id', {}, 'User ID must be a valid Discord user ID.')
                )}
            });
            return;
        }

        // Validate entry count for add action
        let entryCount = 1;
        if (action === 'add') {
            entryCount = parseInt(entryCountStr);
            if (isNaN(entryCount) || entryCount < 1 || entryCount > 100) {
                await interaction.editReply({
                    embeds: [createErrorEmbed(
                        t('giveaway.manage_entries.error.title', {}, 'Invalid Entry Count'),
                        t('giveaway.manage_entries.error.entry_count', {}, 'Entry count must be between 1 and 100.')
                    )}
                ]);
                return;
            }
        }

        // Check if user exists
        try {
            await interaction.client.users.fetch(targetUserId);
        } catch {
            await interaction.editReply({
                embeds: [createErrorEmbed(
                    t('giveaway.manage_entries.error.title', {}, 'User Not Found'),
                    t('giveaway.manage_entries.error.user_not_found', {}, 'The specified user could not be found.')
                )}
            });
            return;
        }

        // Perform the action
        let result;
        if (action === 'add') {
            result = await giveawayHandler.addUserEntry(giveawayId, targetUserId, entryCount, reason);
        } else {
            result = await giveawayHandler.removeUserEntry(giveawayId, targetUserId);
        }

        if (result.success) {
            await interaction.editReply({
                embeds: [createSuccessEmbed(
                    t('giveaway.manage_entries.success.title', {}, '✅ Entry Management'),
                    t('giveaway.manage_entries.success.description', { 
                        action,
                        user: `<@${targetUserId}>`,
                        result: result.message,
                        reason: reason || 'No reason provided'
                    }, `**Action:** ${action}\n**User:** <@${targetUserId}>\n**Result:** ${result.message}\n${reason ? `**Reason:** ${reason}` : ''}`)
                )]
            });

            logger.audit('GIVEAWAY_ENTRY_MANAGED', userId, guildId, {
                giveawayId,
                action,
                targetUserId,
                entryCount: action === 'add' ? entryCount : undefined,
                reason
            });
        } else {
            await interaction.editReply({
                embeds: [createErrorEmbed(
                    t('giveaway.manage_entries.error.failed.title', {}, 'Action Failed'),
                    result.message
                )]
            });
        }

    } catch (error) {
        logger.error('Error handling giveaway manage entries modal', error as Error);
        
        if (interaction.deferred) {
            await interaction.editReply({
                content: 'An error occurred while managing entries.'
            }).catch(() => {});
        }
    }
}

/**
 * Check if user has management permissions
 */
async function checkManagementPermissions(interaction: ModalSubmitInteraction): Promise<boolean> {
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