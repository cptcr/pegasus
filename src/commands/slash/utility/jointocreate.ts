import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, ChannelType, EmbedBuilder, CategoryChannel, VoiceChannel } from 'discord.js';
import { SlashCommand, ClientWithCommands } from '../../../types';
import { getGuildSettings, updateGuildSettings, invalidateGuildSettingsCache } from '../../../utils/guildSettings';

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
    if (!interaction.guildId) {
        await interaction.reply({ content: 'Dieser Befehl kann nur auf einem Server verwendet werden.', ephemeral: true });
        return;
    }
    const guildSettings = await getGuildSettings(interaction.guildId, client);
    if (!guildSettings?.enableJoinToCreate) {
        await interaction.reply({ content: 'Das Join-to-Create Feature ist auf diesem Server deaktiviert. Aktiviere es zuerst im Dashboard.', ephemeral: true });
        return;
    }

    const triggerChannel = interaction.options.getChannel('trigger-kanal', true) as VoiceChannel;
    const category = interaction.options.getChannel('kategorie', true) as CategoryChannel;

    if (triggerChannel.parentId === category.id) {
        await interaction.reply({ content: 'Der Trigger-Kanal darf sich nicht in der Zielkategorie befinden.', ephemeral: true});
        return;
    }

    try {
        await updateGuildSettings(interaction.guildId, client, {
            joinToCreateChannelId: triggerChannel.id,
            joinToCreateCategoryId: category.id
        });
        invalidateGuildSettingsCache(interaction.guildId);

        const embed = new EmbedBuilder()
            .setColor(0x57F287) // Grün
            .setTitle('🔊 Join-to-Create Konfiguriert')
            .setDescription('Das Join-to-Create Feature wurde erfolgreich eingerichtet.')
            .addFields(
                { name: 'Trigger-Kanal', value: `${triggerChannel.name} (${triggerChannel.id})`},
                { name: 'Zielkategorie', value: `${category.name} (${category.id})`}
            )
            .setTimestamp()
            .setFooter({ text: `Konfiguriert von ${interaction.user.tag}`});
        
        await interaction.reply({ embeds: [embed] });

    } catch (error) {
        console.error("Fehler beim Aktualisieren der JoinToCreate Einstellungen:", error);
        await interaction.reply({ content: 'Ein Fehler ist beim Speichern der Einstellungen aufgetreten.', ephemeral: true });
    }
  }
};

export default command;