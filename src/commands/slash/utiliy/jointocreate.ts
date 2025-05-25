import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, ChannelType } from 'discord.js';
import { SlashCommand, ClientWithCommands } from '../../../types';

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('jointocreate')
    .setDescription('Konfiguriert das Join-to-Create Feature.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption(option =>
        option.setName('trigger-kanal')
            .setDescription('Der Sprachkanal, bei dessen Betreten ein neuer Kanal erstellt wird.')
            .addChannelTypes(ChannelType.GuildVoice)
            .setRequired(true))
    .addChannelOption(option =>
        option.setName('kategorie')
            .setDescription('Die Kategorie, in der neue Sprachkanäle erstellt werden.')
            .addChannelTypes(ChannelType.GuildCategory)
            .setRequired(true)),
  enabled: true,
  category: 'utility',
  async execute(interaction: ChatInputCommandInteraction, client: ClientWithCommands) {
    const guildSettings = await client.prisma.guild.findUnique({ where: { id: interaction.guildId! } });
    if (!guildSettings?.enableJoinToCreate) {
        await interaction.reply({ content: 'Das Join-to-Create Feature ist auf diesem Server deaktiviert.', ephemeral: true });
        return;
    }
    await interaction.reply({ content: 'Dieser Befehl (`/jointocreate`) ist noch nicht vollständig implementiert.', ephemeral: true });
  }
};

export default command;