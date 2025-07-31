import { ButtonInteraction, GuildMember, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { giveawayHandler } from '../../handlers/giveaway';
import { i18n } from '../../i18n';
import { logger } from '../../utils/logger';
import { createErrorEmbed, createSuccessEmbed } from '../../utils/helpers';

// Anti-spam protection
const interactionCooldowns = new Map<string, number>();
const COOLDOWN_DURATION = 5000; // 5 seconds
const MAX_INTERACTIONS_PER_MINUTE = 10;
const userInteractionCounts = new Map<string, { count: number; resetTime: number }>();

/**
 * Handle giveaway entry button interactions
 */
export async function handleGiveawayEnter(interaction: ButtonInteraction): Promise<void> {
    try {
        const giveawayId = interaction.customId.replace('giveaway_enter_', '');
        const userId = interaction.user.id;
        const guildId = interaction.guildId!;
        
        // Create translator for this user/guild
        const t = i18n.createTranslator(userId, guildId);

        // Anti-spam check
        if (!await checkSpamProtection(userId, interaction)) {
            return;
        }

        // Defer the reply to allow for longer processing
        await interaction.deferReply({ ephemeral: true });

        // Attempt to enter the giveaway
        const result = await giveawayHandler.enterGiveaway(giveawayId, userId, guildId);

        if (result.success) {
            const embed = createSuccessEmbed(
                t('giveaway.entered.title', {}, '🎉 Entry Successful!'),
                t('giveaway.entered.description', { 
                    entryCount: result.entryCount 
                }, result.message)
            );

            await interaction.editReply({ embeds: [embed] });

            // Log successful entry
            logger.info('User entered giveaway', {
                giveawayId,
                userId,
                guildId,
                entryCount: result.entryCount
            });
        } else {
            const embed = createErrorEmbed(
                t('giveaway.entry_failed.title', {}, '❌ Entry Failed'),
                t('giveaway.entry_failed.description', {}, result.message)
            );

            await interaction.editReply({ embeds: [embed] });
        }

    } catch (error) {
        logger.error('Error handling giveaway entry', error as Error);
        
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: 'An error occurred while processing your entry. Please try again later.',
                ephemeral: true
            }).catch(() => {});
        } else if (interaction.deferred) {
            await interaction.editReply({
                content: 'An error occurred while processing your entry. Please try again later.'
            }).catch(() => {});
        }
    }
}

/**
 * Handle giveaway leave button interactions
 */
export async function handleGiveawayLeave(interaction: ButtonInteraction): Promise<void> {
    try {
        const giveawayId = interaction.customId.replace('giveaway_leave_', '');
        const userId = interaction.user.id;
        const guildId = interaction.guildId!;
        
        // Create translator for this user/guild
        const t = i18n.createTranslator(userId, guildId);

        // Anti-spam check
        if (!await checkSpamProtection(userId, interaction)) {
            return;
        }

        // Defer the reply
        await interaction.deferReply({ ephemeral: true });

        // Attempt to leave the giveaway
        const result = await giveawayHandler.leaveGiveaway(giveawayId, userId);

        if (result.success) {
            const embed = createSuccessEmbed(
                t('giveaway.left.title', {}, '👋 Left Giveaway'),
                t('giveaway.left.description', {}, result.message)
            );

            await interaction.editReply({ embeds: [embed] });

            // Log successful leave
            logger.info('User left giveaway', {
                giveawayId,
                userId,
                guildId
            });
        } else {
            const embed = createErrorEmbed(
                t('giveaway.leave_failed.title', {}, '❌ Failed to Leave'),
                t('giveaway.leave_failed.description', {}, result.message)
            );

            await interaction.editReply({ embeds: [embed] });
        }

    } catch (error) {
        logger.error('Error handling giveaway leave', error as Error);
        
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: 'An error occurred while processing your request. Please try again later.',
                ephemeral: true
            }).catch(() => {});
        } else if (interaction.deferred) {
            await interaction.editReply({
                content: 'An error occurred while processing your request. Please try again later.'
            }).catch(() => {});
        }
    }
}

/**
 * Enhanced giveaway button with both enter and leave options
 */
export async function handleGiveawayToggle(interaction: ButtonInteraction): Promise<void> {
    try {
        const giveawayId = interaction.customId.replace('giveaway_toggle_', '');
        const userId = interaction.user.id;
        const guildId = interaction.guildId!;
        
        // Create translator for this user/guild
        const t = i18n.createTranslator(userId, guildId);

        // Anti-spam check
        if (!await checkSpamProtection(userId, interaction)) {
            return;
        }

        // Get giveaway details and user entry status
        const giveaway = await giveawayHandler.getGiveaway(giveawayId);
        if (!giveaway) {
            await interaction.reply({
                content: t('giveaway.not_found', {}, 'Giveaway not found.'),
                ephemeral: true
            });
            return;
        }

        const isEntered = await giveawayHandler.isUserEntered(giveawayId, userId);

        // Create action buttons
        const actionRow = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`giveaway_${isEntered ? 'leave' : 'enter'}_${giveawayId}`)
                    .setLabel(isEntered 
                        ? t('giveaway.button.leave', {}, 'Leave Giveaway') 
                        : t('giveaway.button.enter', {}, 'Enter Giveaway')
                    )
                    .setStyle(isEntered ? ButtonStyle.Danger : ButtonStyle.Success)
                    .setEmoji(isEntered ? '👋' : '🎉'),
                new ButtonBuilder()
                    .setCustomId(`giveaway_info_${giveawayId}`)
                    .setLabel(t('giveaway.button.info', {}, 'Info'))
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('ℹ️')
            );

        // Create status embed
        const embed = new EmbedBuilder()
            .setTitle(`${isEntered ? '✅' : '❌'} ${t('giveaway.status.title', {}, 'Entry Status')}`)
            .setDescription(isEntered 
                ? t('giveaway.status.entered', {}, 'You are currently entered in this giveaway.')
                : t('giveaway.status.not_entered', {}, 'You are not entered in this giveaway.')
            )
            .setColor(isEntered ? 0x00ff00 : 0xff6b6b)
            .addFields([
                {
                    name: t('giveaway.fields.prize', {}, '🎁 Prize'),
                    value: giveaway.prize,
                    inline: true
                },
                {
                    name: t('giveaway.fields.ends', {}, '⏰ Ends'),
                    value: `<t:${Math.floor(giveaway.endTime.getTime() / 1000)}:R>`,
                    inline: true
                }
            ]);

        await interaction.reply({
            embeds: [embed],
            components: [actionRow],
            ephemeral: true
        });

    } catch (error) {
        logger.error('Error handling giveaway toggle', error as Error);
        
        await interaction.reply({
            content: 'An error occurred while processing your request. Please try again later.',
            ephemeral: true
        }).catch(() => {});
    }
}

/**
 * Handle giveaway info button interactions
 */
export async function handleGiveawayInfo(interaction: ButtonInteraction): Promise<void> {
    try {
        const giveawayId = interaction.customId.replace('giveaway_info_', '');
        const userId = interaction.user.id;
        const guildId = interaction.guildId!;
        
        // Create translator for this user/guild
        const t = i18n.createTranslator(userId, guildId);

        const giveaway = await giveawayHandler.getGiveaway(giveawayId);
        if (!giveaway) {
            await interaction.reply({
                content: t('giveaway.not_found', {}, 'Giveaway not found.'),
                ephemeral: true
            });
            return;
        }

        // Get entry statistics
        const entryCount = await giveawayHandler.getGiveawayEntryCount(giveawayId);
        const userEntry = await giveawayHandler.getUserEntry(giveawayId, userId);
        
        const embed = new EmbedBuilder()
            .setTitle(`ℹ️ ${giveaway.title}`)
            .setDescription(giveaway.description || t('giveaway.no_description', {}, 'No description provided.'))
            .setColor(0x3498db)
            .addFields([
                {
                    name: t('giveaway.fields.prize', {}, '🎁 Prize'),
                    value: giveaway.prize,
                    inline: true
                },
                {
                    name: t('giveaway.fields.winners', {}, '👑 Winners'),
                    value: giveaway.winnerCount.toString(),
                    inline: true
                },
                {
                    name: t('giveaway.fields.entries', {}, '📊 Entries'),
                    value: entryCount.toString(),
                    inline: true
                },
                {
                    name: t('giveaway.fields.ends', {}, '⏰ Ends'),
                    value: giveaway.ended 
                        ? t('giveaway.status.ended', {}, 'Ended')
                        : `<t:${Math.floor(giveaway.endTime.getTime() / 1000)}:R>`,
                    inline: true
                },
                {
                    name: t('giveaway.fields.host', {}, '👤 Host'),
                    value: `<@${giveaway.hostId}>`,
                    inline: true
                },
                {
                    name: t('giveaway.fields.your_entries', {}, '🎯 Your Entries'),
                    value: userEntry ? userEntry.entryCount.toString() : '0',
                    inline: true
                }
            ])
            .setFooter({ 
                text: t('giveaway.footer', { id: giveaway.id }, `ID: ${giveaway.id}`)
            })
            .setTimestamp();

        // Add requirements if any
        if (giveaway.requirements && Object.keys(giveaway.requirements).length > 0) {
            const requirements = [];
            
            if (giveaway.requirements.minLevel) {
                requirements.push(t('giveaway.requirements.min_level', { level: giveaway.requirements.minLevel }, `Level ${giveaway.requirements.minLevel}+`));
            }
            
            if (giveaway.requirements.minAccountAge) {
                const days = Math.floor(giveaway.requirements.minAccountAge / (1000 * 60 * 60 * 24));
                requirements.push(t('giveaway.requirements.account_age', { days }, `Account ${days}+ days old`));
            }
            
            if (giveaway.requirements.minJoinAge) {
                const days = Math.floor(giveaway.requirements.minJoinAge / (1000 * 60 * 60 * 24));
                requirements.push(t('giveaway.requirements.join_age', { days }, `Joined ${days}+ days ago`));
            }
            
            if (giveaway.requirements.requiredRoles && giveaway.requirements.requiredRoles.length > 0) {
                requirements.push(t('giveaway.requirements.roles', {}, 'Specific roles required'));
            }

            if (requirements.length > 0) {
                embed.addFields([{
                    name: t('giveaway.fields.requirements', {}, '📋 Requirements'),
                    value: requirements.join('\n'),
                    inline: false
                }]);
            }
        }

        await interaction.reply({
            embeds: [embed],
            ephemeral: true
        });

    } catch (error) {
        logger.error('Error handling giveaway info', error as Error);
        
        await interaction.reply({
            content: 'An error occurred while fetching giveaway information.',
            ephemeral: true
        }).catch(() => {});
    }
}

/**
 * Anti-spam protection for giveaway interactions
 */
async function checkSpamProtection(userId: string, interaction: ButtonInteraction): Promise<boolean> {
    const now = Date.now();
    const userKey = `${userId}_${interaction.guildId}`;
    
    // Check cooldown
    const lastInteraction = interactionCooldowns.get(userKey);
    if (lastInteraction && now - lastInteraction < COOLDOWN_DURATION) {
        const remainingTime = Math.ceil((COOLDOWN_DURATION - (now - lastInteraction)) / 1000);
        
        await interaction.reply({
            content: `⏰ Please wait ${remainingTime} seconds before interacting again.`,
            ephemeral: true
        });
        return false;
    }

    // Check rate limit
    const userStats = userInteractionCounts.get(userKey);
    if (userStats) {
        if (now > userStats.resetTime) {
            // Reset counter
            userInteractionCounts.set(userKey, { count: 1, resetTime: now + 60000 });
        } else {
            userStats.count++;
            if (userStats.count > MAX_INTERACTIONS_PER_MINUTE) {
                await interaction.reply({
                    content: '🚫 You are interacting too frequently. Please wait a minute before trying again.',
                    ephemeral: true
                });
                return false;
            }
        }
    } else {
        userInteractionCounts.set(userKey, { count: 1, resetTime: now + 60000 });
    }

    // Update cooldown
    interactionCooldowns.set(userKey, now);
    
    return true;
}

// Clean up old entries periodically
setInterval(() => {
    const now = Date.now();
    
    // Clean cooldowns older than 10 minutes
    for (const [key, timestamp] of interactionCooldowns.entries()) {
        if (now - timestamp > 600000) {
            interactionCooldowns.delete(key);
        }
    }
    
    // Clean expired rate limit counters
    for (const [key, stats] of userInteractionCounts.entries()) {
        if (now > stats.resetTime) {
            userInteractionCounts.delete(key);
        }
    }
}, 300000); // Clean every 5 minutes