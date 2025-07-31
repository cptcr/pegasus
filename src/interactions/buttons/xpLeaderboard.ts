import { ButtonInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { getI18n } from '../../utils/i18n';

export async function handleLeaderboardButton(interaction: ButtonInteraction): Promise<void> {
    const [action, direction, currentPageStr] = interaction.customId.split('_');
    const currentPage = parseInt(currentPageStr);
    const newPage = direction === 'prev' ? currentPage - 1 : currentPage + 1;
    
    const i18n = getI18n(interaction.locale);
    const itemsPerPage = 10;
    const offset = (newPage - 1) * itemsPerPage;
    
    try {
        const xpHandler = interaction.client.xpHandler;
        const leaderboardData = await xpHandler.getLeaderboard(interaction.guild!.id, itemsPerPage, offset);
        
        if (leaderboardData.length === 0) {
            return await interaction.reply({
                content: i18n.t('xp.noMorePages'),
                ephemeral: true
            });
        }
        
        // Build leaderboard description
        const description = await Promise.all(
            leaderboardData.map(async (entry, index) => {
                const user = await interaction.client.users.fetch(entry.user_id).catch(() => null);
                const username = user ? user.username : i18n.t('xp.unknownUser');
                const rank = offset + index + 1;
                const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `**${rank}.**`;
                
                return `${medal} ${username} - ${i18n.t('xp.level')} ${entry.level} (${entry.xp.toLocaleString()} XP)`;
            })
        );
        
        const embed = new EmbedBuilder()
            .setColor(0x00AE86)
            .setTitle(i18n.t('xp.leaderboardTitle', { guild: interaction.guild!.name }))
            .setDescription(description.join('\n'))
            .setFooter({ text: i18n.t('xp.page', { page: newPage }) })
            .setTimestamp();
        
        // Add user's rank if not on current page
        const userRank = await xpHandler.getUserRank(interaction.user.id, interaction.guild!.id);
        if (userRank > 0 && (userRank <= offset || userRank > offset + itemsPerPage)) {
            embed.addFields({
                name: i18n.t('xp.yourRank'),
                value: i18n.t('xp.rankPosition', { rank: userRank }),
                inline: false
            });
        }
        
        // Create navigation buttons
        const row = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`leaderboard_prev_${newPage}`)
                    .setLabel(i18n.t('xp.previous'))
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(newPage === 1),
                new ButtonBuilder()
                    .setCustomId(`leaderboard_next_${newPage}`)
                    .setLabel(i18n.t('xp.next'))
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(leaderboardData.length < itemsPerPage)
            );
        
        await interaction.update({ embeds: [embed], components: [row] });
        
    } catch (error) {
        console.error('Error handling leaderboard button:', error);
        await interaction.reply({
            content: i18n.t('errors.generic'),
            ephemeral: true
        });
    }
}