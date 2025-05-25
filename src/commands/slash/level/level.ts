import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { SlashCommand, ClientWithCommands } from '../../../types';

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('level')
    .setDescription('Zeigt dein aktuelles Level und XP an oder das eines anderen Benutzers.')
    .addUserOption(option =>
      option.setName('benutzer')
        .setDescription('Der Benutzer, dessen Level angezeigt werden soll.')
        .setRequired(false)),
  enabled: true,
  category: 'level',
  async execute(interaction: ChatInputCommandInteraction, client: ClientWithCommands) {
    if (!interaction.guildId) {
      await interaction.reply({ content: 'Dieser Befehl kann nur auf einem Server verwendet werden.', ephemeral: true });
      return;
    }
    const guildSettings = await client.prisma.guild.findUnique({ where: { id: interaction.guildId } });
    if (!guildSettings?.enableLeveling) {
        await interaction.reply({ content: 'Das Levelsystem ist auf diesem Server deaktiviert.', ephemeral: true });
        return;
    }

    const targetUser = interaction.options.getUser('benutzer') || interaction.user;

    const userLevel = await client.prisma.userLevel.findUnique({
      where: {
        userId_guildId: {
          userId: targetUser.id,
          guildId: interaction.guildId,
        },
      },
    });

    if (!userLevel) {
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`Level für ${targetUser.username}`)
        .setDescription(`${targetUser.username} hat noch keine XP auf diesem Server gesammelt.`)
        .setThumbnail(targetUser.displayAvatarURL())
        .setTimestamp();
      await interaction.reply({ embeds: [embed] });
      return;
    }

    const xpForNextLevel = (userLevel.level + 1) * (userLevel.level + 1) * 100;
    const currentLevelBaseXp = userLevel.level * userLevel.level * 100;
    const progressXP = userLevel.xp - currentLevelBaseXp;
    const neededXPForNext = xpForNextLevel - currentLevelBaseXp;
    const percentage = Math.min((progressXP / neededXPForNext) * 100, 100);

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(`Level-Informationen für ${targetUser.username}`)
      .setThumbnail(targetUser.displayAvatarURL())
      .addFields(
        { name: 'Level', value: userLevel.level.toString(), inline: true },
        { name: 'XP', value: `${userLevel.xp.toLocaleString()} / ${xpForNextLevel.toLocaleString()}`, inline: true },
        { name: 'Nachrichten', value: userLevel.messages.toLocaleString(), inline: true },
        { name: 'Sprachzeit', value: `${Math.floor(userLevel.voiceTime / 60)} Minuten`, inline: true },
        { name: 'Fortschritt zum nächsten Level', value: `\`${'█'.repeat(Math.floor(percentage / 10))}${' '.repeat(10 - Math.floor(percentage / 10))}\` ${percentage.toFixed(1)}%` }
      )
      .setTimestamp()
      .setFooter({ text: `Angefordert von ${interaction.user.username}` });

    await interaction.reply({ embeds: [embed] });
  }
};

export default command;