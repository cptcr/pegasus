import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { SlashCommand, ClientWithCommands } from '../../../types';
import { getGuildSettings } from '../../../utils/guildSettings';

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('rang')
    .setDescription('Zeigt deinen aktuellen Rang auf dem Server oder den eines anderen Benutzers an.')
    .addUserOption(option =>
      option.setName('benutzer')
        .setDescription('Der Benutzer, dessen Rang angezeigt werden soll.')
        .setRequired(false)),
  enabled: true,
  category: 'level',
  async execute(interaction: ChatInputCommandInteraction, client: ClientWithCommands) {
    if (!interaction.guildId) {
        await interaction.reply({ content: 'Dieser Befehl kann nur auf einem Server verwendet werden.', ephemeral: true });
        return;
    }
    const guildSettings = await getGuildSettings(interaction.guildId, client);
    if (!guildSettings?.enableLeveling) {
        await interaction.reply({ content: 'Das Levelsystem ist auf diesem Server deaktiviert.', ephemeral: true });
        return;
    }

    const targetUser = interaction.options.getUser('benutzer') || interaction.user;

    const userLevelData = await client.prisma.userLevel.findUnique({
        where: {
            userId_guildId: {
                userId: targetUser.id,
                guildId: interaction.guildId,
            },
        },
    });

    if (!userLevelData) {
        await interaction.reply({ content: `${targetUser.username} hat noch keine XP auf diesem Server gesammelt.`, ephemeral: true });
        return;
    }

    const allUsers = await client.prisma.userLevel.findMany({
        where: { guildId: interaction.guildId },
        orderBy: [
            { level: 'desc' },
            { xp: 'desc' },
        ],
    });

    const rank = allUsers.findIndex(u => u.userId === targetUser.id) + 1;

    const xpForNextLevel = (userLevelData.level + 1) * (userLevelData.level + 1) * 100;
    const currentLevelBaseXp = userLevelData.level * userLevelData.level * 100;
    const progressXP = userLevelData.xp - currentLevelBaseXp;
    const neededXPForNext = xpForNextLevel - currentLevelBaseXp;
    const percentage = Math.min((progressXP / neededXPForNext) * 100, 100);

    const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`Rang für ${targetUser.username}`)
        .setThumbnail(targetUser.displayAvatarURL())
        .addFields(
            { name: 'Rang', value: `#${rank}`, inline: true },
            { name: 'Level', value: userLevelData.level.toString(), inline: true },
            { name: 'XP', value: `${userLevelData.xp.toLocaleString()} / ${xpForNextLevel.toLocaleString()}`, inline: true },
            { name: 'Fortschritt', value: `\`${'█'.repeat(Math.floor(percentage / 10))}${' '.repeat(10 - Math.floor(percentage / 10))}\` ${percentage.toFixed(1)}%`, inline: false }
        )
        .setTimestamp()
        .setFooter({ text: `Angefordert von ${interaction.user.username}` });

    await interaction.reply({ embeds: [embed] });
  }
};

export default command;