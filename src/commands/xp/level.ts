import { Command } from '../../types/command';
import { EmbedBuilder, SlashCommandBuilder, GuildMember } from 'discord.js';
import { getI18n } from '../../utils/i18n';

export const level: Command = {
    data: new SlashCommandBuilder()
        .setName('level')
        .setDescription('Check your or another user\'s level and XP')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to check (leave empty for yourself)')
                .setRequired(false)
        ),
    
    async execute(interaction) {
        if (!interaction.guild) return;
        
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const i18n = getI18n(interaction.locale);
        
        try {
            const xpHandler = interaction.client.xpHandler;
            const userData = await xpHandler.getUserData(targetUser.id, interaction.guild.id);
            const rank = await xpHandler.getUserRank(targetUser.id, interaction.guild.id);
            
            const currentLevelXP = xpHandler.calculateXPForLevel(userData.level);
            const nextLevelXP = xpHandler.calculateXPForLevel(userData.level + 1);
            const progressXP = userData.xp - currentLevelXP;
            const neededXP = nextLevelXP - currentLevelXP;
            const progressPercentage = Math.round((progressXP / neededXP) * 100);
            
            const embed = new EmbedBuilder()
                .setColor(0x00AE86)
                .setTitle(i18n.t('xp.levelTitle', { user: targetUser.username }))
                .setThumbnail(targetUser.displayAvatarURL())
                .addFields(
                    { name: i18n.t('xp.level'), value: userData.level.toString(), inline: true },
                    { name: i18n.t('xp.rank'), value: `#${rank}`, inline: true },
                    { name: i18n.t('xp.totalXP'), value: userData.xp.toLocaleString(), inline: true },
                    { name: i18n.t('xp.progress'), value: `${progressXP.toLocaleString()} / ${neededXP.toLocaleString()} (${progressPercentage}%)`, inline: false },
                    { name: i18n.t('xp.messages'), value: userData.messageCount.toLocaleString(), inline: true },
                    { name: i18n.t('xp.voiceTime'), value: `${userData.voiceMinutes} ${i18n.t('xp.minutes')}`, inline: true },
                    { name: i18n.t('xp.streak'), value: `${userData.streakDays} ${i18n.t('xp.days')}`, inline: true }
                )
                .setFooter({ text: i18n.t('xp.nextLevel', { xp: (neededXP - progressXP).toLocaleString() }) })
                .setTimestamp();
            
            await interaction.reply({ embeds: [embed] });
            
        } catch (error) {
            console.error('Error in level command:', error);
            await interaction.reply({
                content: i18n.t('errors.generic'),
                ephemeral: true
            });
        }
    }
};