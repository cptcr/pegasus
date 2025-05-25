import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { SlashCommand, ClientWithCommands } from '../../../types';

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
    const guildSettings = await client.prisma.guild.findUnique({ where: { id: interaction.guildId! } });
    if (!guildSettings?.enableLeveling) {
        await interaction.reply({ content: 'Das Levelsystem ist auf diesem Server deaktiviert.', ephemeral: true });
        return;
    }
    await interaction.reply({ content: 'Dieser Befehl (\`/rang\`) ist noch nicht vollständig implementiert.', ephemeral: true });
  }
};

export default command;