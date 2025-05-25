import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import { SlashCommand, ClientWithCommands } from '../../../types';

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('automod')
    .setDescription('Konfiguriert die automatische Moderation.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  enabled: true,
  category: 'moderation',
  async execute(interaction: ChatInputCommandInteraction, client: ClientWithCommands) {
    const guildSettings = await client.prisma.guild.findUnique({ where: { id: interaction.guildId! } });
    if (!guildSettings?.enableAutomod) {
        await interaction.reply({ content: 'Automod ist auf diesem Server deaktiviert.', ephemeral: true });
        return;
    }
    await interaction.reply({ content: 'Dieser Befehl (`/automod`) ist noch nicht vollständig implementiert.', ephemeral: true });
  }
};

export default command;