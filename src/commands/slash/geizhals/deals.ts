import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { SlashCommand, ClientWithCommands } from '../../../types';

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('geizhals-deals')
    .setDescription('Zeigt aktuelle Geizhals-Angebote an.')
    .addStringOption(option => option.setName('kategorie').setDescription('Optionale Kategorie für Deals.').setRequired(false)),
  enabled: true,
  category: 'geizhals',
  async execute(interaction: ChatInputCommandInteraction, client: ClientWithCommands) {
    const guildSettings = await client.prisma.guild.findUnique({ where: { id: interaction.guildId! } });
    if (!guildSettings?.enableGeizhals) {
        await interaction.reply({ content: 'Die Geizhals-Integration ist auf diesem Server deaktiviert.', ephemeral: true });
        return;
    }
    await interaction.reply({ content: 'Dieser Befehl (`/geizhals-deals`) ist noch nicht vollständig implementiert.', ephemeral: true });
  }
};

export default command;