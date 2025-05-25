import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { SlashCommand, ClientWithCommands } from '../../../types';

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('rangliste')
    .setDescription('Zeigt die Top-Benutzer des Servers nach Level und XP an.'),
  enabled: true,
  category: 'level',
  async execute(interaction: ChatInputCommandInteraction, client: ClientWithCommands) {
    const guildSettings = await client.prisma.guild.findUnique({ where: { id: interaction.guildId! } });
    if (!guildSettings?.enableLeveling) {
        await interaction.reply({ content: 'Das Levelsystem ist auf diesem Server deaktiviert.', ephemeral: true });
        return;
    }
    await interaction.reply({ content: 'Dieser Befehl (`/rangliste`) ist noch nicht vollständig implementiert.', ephemeral: true });
  }
};

export default command;