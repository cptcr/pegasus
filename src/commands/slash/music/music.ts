import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { SlashCommand, ClientWithCommands } from '../../../types';

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('musik')
    .setDescription('Musikbefehle (Platzhalter).')
    .addStringOption(option => option.setName('aktion').setDescription('z.B. play, stop, skip, queue').setRequired(true))
    .addStringOption(option => option.setName('query').setDescription('Songtitel oder URL (für Play).').setRequired(false)),
  enabled: true,
  category: 'music',
  async execute(interaction: ChatInputCommandInteraction, client: ClientWithCommands) {
    const guildSettings = await client.prisma.guild.findUnique({ where: { id: interaction.guildId! } });
    if (!guildSettings?.enableMusic) {
        await interaction.reply({ content: 'Die Musikfunktion ist auf diesem Server deaktiviert.', ephemeral: true });
        return;
    }
    await interaction.reply({ content: 'Dieser Befehl (`/musik`) ist noch nicht vollständig implementiert.', ephemeral: true });
  }
};

export default command;