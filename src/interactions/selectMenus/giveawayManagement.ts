import { 
    StringSelectMenuInteraction, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    PermissionFlagsBits
} from 'discord.js';
import { giveawayHandler } from '../../handlers/giveaway';
import { i18n } from '../../i18n';
import { logger } from '../../utils/logger';
import { createErrorEmbed, createSuccessEmbed, createEmbed } from '../../utils/helpers';

/**
 * Handle giveaway management select menu interactions
 */
export async function handleGiveawayManagement(interaction: StringSelectMenuInteraction): Promise<void> {
    try {
        const giveawayId = interaction.customId.replace('giveaway_manage_', '');
        const userId = interaction.user.id;
        const guildId = interaction.guildId!;
        const action = interaction.values[0];
        
        // Create translator for this user/guild
        const t = i18n.createTranslator(userId, guildId);

        // Check permissions
        if (!await checkManagementPermissions(interaction)) {
            return;
        }

        // Get giveaway details
        const giveaway = await giveawayHandler.getGiveaway(giveawayId);
        if (!giveaway) {
            await interaction.reply({
                content: t('giveaway.not_found', {}, 'Giveaway not found.'),
                ephemeral: true
            });
            return;
        }

        switch (action) {
            case 'end_early':
                await handleEndEarly(interaction, giveaway, t);
                break;
            case 'reroll':
                await handleRerollOption(interaction, giveaway, t);
                break;
            case 'edit_details':
                await handleEditDetails(interaction, giveaway, t);
                break;
            case 'view_entries':
                await handleViewEntries(interaction, giveaway, t);
                break;
            case 'cancel_giveaway':
                await handleCancelGiveaway(interaction, giveaway, t);
                break;
            case 'edit_requirements':
                await handleEditRequirements(interaction, giveaway, t);
                break;
            case 'manage_entries':
                await handleManageEntries(interaction, giveaway, t);
                break;
            case 'export_data':
                await handleExportData(interaction, giveaway, t);
                break;
            default:
                await interaction.reply({
                    content: t('error.unknown_action', {}, 'Unknown action selected.'),
                    ephemeral: true
                });
        }

    } catch (error) {
        logger.error('Error handling giveaway management', error as Error);
        
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: 'An error occurred while processing your request.',
                ephemeral: true
            }).catch(() => {});
        }
    }
}

/**
 * Handle early ending of giveaway
 */
async function handleEndEarly(
    interaction: StringSelectMenuInteraction, 
    giveaway: any, 
    t: (key: string, vars?: any, fallback?: string) => string
): Promise<void> {
    if (giveaway.ended) {
        await interaction.reply({
            content: t('giveaway.already_ended', {}, 'This giveaway has already ended.'),
            ephemeral: true
        });
        return;
    }

    // Create confirmation buttons
    const confirmRow = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`giveaway_confirm_end_${giveaway.id}`)
                .setLabel(t('giveaway.confirm_end', {}, 'Confirm End'))
                .setStyle(ButtonStyle.Danger)
                .setEmoji('⚠️'),
            new ButtonBuilder()
                .setCustomId(`giveaway_cancel_action_${giveaway.id}`)
                .setLabel(t('common.cancel', {}, 'Cancel'))
                .setStyle(ButtonStyle.Secondary)
        );

    const embed = createEmbed(
        t('giveaway.end_confirmation.title', {}, '⚠️ End Giveaway Early'),
        t('giveaway.end_confirmation.description', { 
            title: giveaway.title 
        }, `Are you sure you want to end "${giveaway.title}" early?\n\nThis action cannot be undone and winners will be selected immediately.`),
        0xff6b6b
    );

    await interaction.reply({
        embeds: [embed],
        components: [confirmRow],
        ephemeral: true
    });
}

/**
 * Handle reroll option
 */
async function handleRerollOption(
    interaction: StringSelectMenuInteraction, 
    giveaway: any, 
    t: (key: string, vars?: any, fallback?: string) => string
): Promise<void> {
    if (!giveaway.ended) {
        await interaction.reply({
            content: t('giveaway.not_ended', {}, 'This giveaway has not ended yet.'),
            ephemeral: true
        });
        return;
    }

    // Show reroll options modal
    const modal = new ModalBuilder()
        .setCustomId(`giveaway_reroll_modal_${giveaway.id}`)
        .setTitle(t('giveaway.reroll.modal.title', {}, 'Reroll Giveaway'));

    const rerollCountInput = new TextInputBuilder()
        .setCustomId('reroll_count')
        .setLabel(t('giveaway.reroll.modal.count_label', {}, 'Number of Winners to Reroll'))
        .setStyle(TextInputStyle.Short)
        .setPlaceholder(t('giveaway.reroll.modal.count_placeholder', {}, 'Enter number (default: 1)'))
        .setValue('1')
        .setRequired(false);

    const reasonInput = new TextInputBuilder()
        .setCustomId('reroll_reason')
        .setLabel(t('giveaway.reroll.modal.reason_label', {}, 'Reason for Reroll'))
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder(t('giveaway.reroll.modal.reason_placeholder', {}, 'Optional: Explain why you are rerolling'))
        .setRequired(false);

    const firstRow = new ActionRowBuilder<TextInputBuilder>().addComponents(rerollCountInput);
    const secondRow = new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput);

    modal.addComponents(firstRow, secondRow);

    await interaction.showModal(modal);
}

/**
 * Handle edit details option
 */
async function handleEditDetails(
    interaction: StringSelectMenuInteraction, 
    giveaway: any, 
    t: (key: string, vars?: any, fallback?: string) => string
): Promise<void> {
    const modal = new ModalBuilder()
        .setCustomId(`giveaway_edit_modal_${giveaway.id}`)
        .setTitle(t('giveaway.edit.modal.title', {}, 'Edit Giveaway Details'));

    const titleInput = new TextInputBuilder()
        .setCustomId('title')
        .setLabel(t('giveaway.edit.modal.title_label', {}, 'Title'))
        .setStyle(TextInputStyle.Short)
        .setValue(giveaway.title)
        .setMaxLength(256)
        .setRequired(true);

    const descriptionInput = new TextInputBuilder()
        .setCustomId('description')
        .setLabel(t('giveaway.edit.modal.description_label', {}, 'Description'))
        .setStyle(TextInputStyle.Paragraph)
        .setValue(giveaway.description || '')
        .setMaxLength(2048)
        .setRequired(false);

    const prizeInput = new TextInputBuilder()
        .setCustomId('prize')
        .setLabel(t('giveaway.edit.modal.prize_label', {}, 'Prize'))
        .setStyle(TextInputStyle.Short)
        .setValue(giveaway.prize)
        .setMaxLength(512)
        .setRequired(true);

    const winnersInput = new TextInputBuilder()
        .setCustomId('winner_count')
        .setLabel(t('giveaway.edit.modal.winners_label', {}, 'Number of Winners'))
        .setStyle(TextInputStyle.Short)
        .setValue(giveaway.winnerCount.toString())
        .setMaxLength(3)
        .setRequired(true);

    const firstRow = new ActionRowBuilder<TextInputBuilder>().addComponents(titleInput);
    const secondRow = new ActionRowBuilder<TextInputBuilder>().addComponents(descriptionInput);
    const thirdRow = new ActionRowBuilder<TextInputBuilder>().addComponents(prizeInput);
    const fourthRow = new ActionRowBuilder<TextInputBuilder>().addComponents(winnersInput);

    modal.addComponents(firstRow, secondRow, thirdRow, fourthRow);

    await interaction.showModal(modal);
}

/**
 * Handle view entries option
 */
async function handleViewEntries(
    interaction: StringSelectMenuInteraction, 
    giveaway: any, 
    t: (key: string, vars?: any, fallback?: string) => string
): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    try {
        const entries = await giveawayHandler.getGiveawayEntries(giveaway.id);
        const entryCount = entries.length;
        const totalEntries = entries.reduce((sum, entry) => sum + entry.entryCount, 0);

        if (entryCount === 0) {
            const embed = createEmbed(
                t('giveaway.entries.no_entries.title', {}, '📊 No Entries'),
                t('giveaway.entries.no_entries.description', {}, 'This giveaway has no entries yet.'),
                0x95a5a6
            );

            await interaction.editReply({ embeds: [embed] });
            return;
        }

        // Sort entries by entry count (highest first)
        entries.sort((a, b) => b.entryCount - a.entryCount);

        const embed = new EmbedBuilder()
            .setTitle(t('giveaway.entries.title', { title: giveaway.title }, `📊 Entries for ${giveaway.title}`))
            .setDescription(t('giveaway.entries.stats', { 
                participants: entryCount, 
                totalEntries 
            }, `**Participants:** ${entryCount}\n**Total Entries:** ${totalEntries}`))
            .setColor(0x3498db)
            .setTimestamp();

        // Show top entries (up to 20)
        const topEntries = entries.slice(0, 20);
        let entryList = '';

        for (let i = 0; i < topEntries.length; i++) {
            const entry = topEntries[i];
            const user = await interaction.client.users.fetch(entry.userId).catch(() => null);
            const userName = user ? user.displayName : `User ${entry.userId}`;
            
            entryList += `**${i + 1}.** ${userName} - ${entry.entryCount} ${entry.entryCount === 1 ? 'entry' : 'entries'}`;
            if (entry.bonusReason) {
                entryList += ` *(${entry.bonusReason})*`;
            }
            entryList += '\n';
        }

        embed.addFields([{
            name: t('giveaway.entries.top_participants', {}, '🏆 Top Participants'),
            value: entryList || t('giveaway.entries.none', {}, 'None'),
            inline: false
        }]);

        if (entryCount > 20) {
            embed.setFooter({ 
                text: t('giveaway.entries.showing_top', { shown: 20, total: entryCount }, `Showing top 20 of ${entryCount} participants`)
            });
        }

        // Add navigation buttons for pagination if needed
        const components = [];
        if (entryCount > 20) {
            const navRow = new ActionRowBuilder<ButtonBuilder>()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`giveaway_entries_export_${giveaway.id}`)
                        .setLabel(t('giveaway.entries.export', {}, 'Export All'))
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('📥')
                );
            components.push(navRow);
        }

        await interaction.editReply({ 
            embeds: [embed], 
            components 
        });

    } catch (error) {
        logger.error('Error viewing giveaway entries', error as Error);
        await interaction.editReply({
            content: t('error.loading_entries', {}, 'Error loading giveaway entries.')
        });
    }
}

/**
 * Handle cancel giveaway option
 */
async function handleCancelGiveaway(
    interaction: StringSelectMenuInteraction, 
    giveaway: any, 
    t: (key: string, vars?: any, fallback?: string) => string
): Promise<void> {
    if (giveaway.ended || giveaway.cancelled) {
        await interaction.reply({
            content: t('giveaway.already_ended_or_cancelled', {}, 'This giveaway has already ended or been cancelled.'),
            ephemeral: true
        });
        return;
    }

    // Create confirmation buttons
    const confirmRow = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`giveaway_confirm_cancel_${giveaway.id}`)
                .setLabel(t('giveaway.confirm_cancel', {}, 'Confirm Cancel'))
                .setStyle(ButtonStyle.Danger)
                .setEmoji('🗑️'),
            new ButtonBuilder()
                .setCustomId(`giveaway_cancel_action_${giveaway.id}`)
                .setLabel(t('common.cancel', {}, 'Cancel'))
                .setStyle(ButtonStyle.Secondary)
        );

    const embed = createEmbed(
        t('giveaway.cancel_confirmation.title', {}, '🗑️ Cancel Giveaway'),
        t('giveaway.cancel_confirmation.description', { 
            title: giveaway.title 
        }, `Are you sure you want to cancel "${giveaway.title}"?\n\nThis action cannot be undone and no winners will be selected.`),
        0xff6b6b
    );

    await interaction.reply({
        embeds: [embed],
        components: [confirmRow],
        ephemeral: true
    });
}

/**
 * Handle edit requirements option
 */
async function handleEditRequirements(
    interaction: StringSelectMenuInteraction, 
    giveaway: any, 
    t: (key: string, vars?: any, fallback?: string) => string
): Promise<void> {
    // This would show a complex modal or separate interface for editing requirements
    // For now, we'll show a simplified version
    
    const modal = new ModalBuilder()
        .setCustomId(`giveaway_requirements_modal_${giveaway.id}`)
        .setTitle(t('giveaway.requirements.modal.title', {}, 'Edit Requirements'));

    const minLevelInput = new TextInputBuilder()
        .setCustomId('min_level')
        .setLabel(t('giveaway.requirements.modal.min_level', {}, 'Minimum Level (0 = no requirement)'))
        .setStyle(TextInputStyle.Short)
        .setValue((giveaway.requirements?.minLevel || 0).toString())
        .setPlaceholder('0')
        .setRequired(false);

    const minAccountAgeInput = new TextInputBuilder()
        .setCustomId('min_account_age')
        .setLabel(t('giveaway.requirements.modal.account_age', {}, 'Min Account Age (days, 0 = no requirement)'))
        .setStyle(TextInputStyle.Short)
        .setValue(giveaway.requirements?.minAccountAge ? Math.floor(giveaway.requirements.minAccountAge / (1000 * 60 * 60 * 24)).toString() : '0')
        .setPlaceholder('0')
        .setRequired(false);

    const minJoinAgeInput = new TextInputBuilder()
        .setCustomId('min_join_age')
        .setLabel(t('giveaway.requirements.modal.join_age', {}, 'Min Join Age (days, 0 = no requirement)'))
        .setStyle(TextInputStyle.Short)
        .setValue(giveaway.requirements?.minJoinAge ? Math.floor(giveaway.requirements.minJoinAge / (1000 * 60 * 60 * 24)).toString() : '0')
        .setPlaceholder('0')
        .setRequired(false);

    const firstRow = new ActionRowBuilder<TextInputBuilder>().addComponents(minLevelInput);
    const secondRow = new ActionRowBuilder<TextInputBuilder>().addComponents(minAccountAgeInput);
    const thirdRow = new ActionRowBuilder<TextInputBuilder>().addComponents(minJoinAgeInput);

    modal.addComponents(firstRow, secondRow, thirdRow);

    await interaction.showModal(modal);
}

/**
 * Handle manage entries option (add/remove specific users)
 */
async function handleManageEntries(
    interaction: StringSelectMenuInteraction, 
    giveaway: any, 
    t: (key: string, vars?: any, fallback?: string) => string
): Promise<void> {
    const modal = new ModalBuilder()
        .setCustomId(`giveaway_manage_entries_modal_${giveaway.id}`)
        .setTitle(t('giveaway.manage_entries.modal.title', {}, 'Manage Entries'));

    const actionInput = new TextInputBuilder()
        .setCustomId('action')
        .setLabel(t('giveaway.manage_entries.modal.action', {}, 'Action (add/remove)'))
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('add or remove')
        .setRequired(true);

    const userIdInput = new TextInputBuilder()
        .setCustomId('user_id')
        .setLabel(t('giveaway.manage_entries.modal.user_id', {}, 'User ID'))
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('123456789012345678')
        .setRequired(true);

    const entryCountInput = new TextInputBuilder()
        .setCustomId('entry_count')
        .setLabel(t('giveaway.manage_entries.modal.entry_count', {}, 'Entry Count (for add action)'))
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('1')
        .setValue('1')
        .setRequired(false);

    const reasonInput = new TextInputBuilder()
        .setCustomId('reason')
        .setLabel(t('giveaway.manage_entries.modal.reason', {}, 'Reason'))
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Why are you adding/removing this entry?')
        .setRequired(false);

    const firstRow = new ActionRowBuilder<TextInputBuilder>().addComponents(actionInput);
    const secondRow = new ActionRowBuilder<TextInputBuilder>().addComponents(userIdInput);
    const thirdRow = new ActionRowBuilder<TextInputBuilder>().addComponents(entryCountInput);
    const fourthRow = new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput);

    modal.addComponents(firstRow, secondRow, thirdRow, fourthRow);

    await interaction.showModal(modal);
}

/**
 * Handle export data option
 */
async function handleExportData(
    interaction: StringSelectMenuInteraction, 
    giveaway: any, 
    t: (key: string, vars?: any, fallback?: string) => string
): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    try {
        const entries = await giveawayHandler.getGiveawayEntries(giveaway.id);
        const winners = await giveawayHandler.getGiveawayWinners(giveaway.id);
        
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

    } catch (error) {
        logger.error('Error exporting giveaway data', error as Error);
        await interaction.editReply({
            content: t('error.export_failed', {}, 'Failed to export giveaway data.')
        });
    }
}

/**
 * Check if user has management permissions
 */
async function checkManagementPermissions(interaction: StringSelectMenuInteraction): Promise<boolean> {
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