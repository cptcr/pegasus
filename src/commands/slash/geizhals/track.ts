import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { SlashCommand, ClientWithCommands } from '../../../types';

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('geizhals-verfolgen')
    .setDescription('Verfolgt den Preis eines Produkts auf Geizhals.')
    .addStringOption(option => option.setName('produkt_url_oder_id').setDescription('URL oder ID des Produkts.').setRequired(true))
    .addIntegerOption(option => option.setName('zielpreis').setDescription('Der gewünschte Zielpreis (optional).').setRequired(false)),
  enabled: true,
  category: 'geizhals',
  async execute(interaction: ChatInputCommandInteraction, client: ClientWithCommands) {
    const guildSettings = await client.prisma.guild.findUnique({ where: { id: interaction.guildId! } });
    if (!guildSettings?.enableGeizhals) {
        await interaction.reply({ content: 'Die Geizhals-Integration ist auf diesem Server deaktiviert.', ephemeral: true });
        return;
    }
    await interaction.reply({ content: 'Dieser Befehl (`/geizhals-verfolgen`) ist noch nicht vollständig implementiert.', ephemeral: true });
  }
};

export default command;