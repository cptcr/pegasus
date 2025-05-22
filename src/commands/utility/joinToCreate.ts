import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  EmbedBuilder,
  PermissionFlagsBits,
  ChannelType
} from 'discord.js';
import { DatabaseService } from '../../lib/database';

export const data = new SlashCommandBuilder()
  .setName('jointocreate')
  .setDescription('Join-To-Create Voice Channel System')
  .addSubcommand(subcommand =>
    subcommand
      .setName('setup')
      .setDescription('Join-To-Create System einrichten')
      .addChannelOption(option =>
        option
          .setName('trigger_channel')
          .setDescription('Voice Channel der temporäre Channels erstellt')
          .setRequired(true)
      )
      .addChannelOption(option =>
        option
          .setName('category')
          .setDescription('Kategorie für temporäre Channels')
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('disable')
      .setDescription('Join-To-Create System deaktivieren')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('list')
      .setDescription('Aktive temporäre Channels anzeigen')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('delete')
      .setDescription('Temporären Channel löschen')
      .addChannelOption(option =>
        option
          .setName('channel')
          .setDescription('Channel zum Löschen')
          .setRequired(true)
      )
  );

export async function run({ interaction }: { interaction: ChatInputCommandInteraction }) {
  const subcommand = interaction.options.getSubcommand();

  // Admin-Berechtigung prüfen
  const member = interaction.member as any;
  if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({
      content: '❌ Du benötigst Administrator-Berechtigung für diesen Befehl.',
      ephemeral: true,
    });
  }

  switch (subcommand) {
    case 'setup':
      await handleSetup(interaction);
      break;
    case 'disable':
      await handleDisable(interaction);
      break;
    case 'list':
      await handleList(interaction);
      break;
    case 'delete':
      await handleDelete(interaction);
      break;
  }
}

async function handleSetup(interaction: ChatInputCommandInteraction) {
  const triggerChannel = interaction.options.getChannel('trigger_channel', true);
  const category = interaction.options.getChannel('category', true);
  const guild = interaction.guild!;

  await interaction.deferReply();

  try {
    // Validierung
    if (triggerChannel.type !== ChannelType.GuildVoice) {
      return interaction.editReply({
        content: '❌ Der Trigger-Channel muss ein Voice Channel sein.',
      });
    }

    if (category.type !== ChannelType.GuildCategory) {
      return interaction.editReply({
        content: '❌ Du musst eine Kategorie auswählen.',
      });
    }

    // Guild-Einstellungen aktualisieren
    await DatabaseService.updateGuildSettings(guild.id, {
      enableJoinToCreate: true,
      joinToCreateChannelId: triggerChannel.id,
      joinToCreateCategoryId: category.id,
      name: guild.name
    });

    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle('✅ Join-To-Create System eingerichtet')
      .setDescription('Das Join-To-Create System wurde erfolgreich konfiguriert!')
      .addFields([
        { name: '🎤 Trigger Channel', value: triggerChannel ? triggerChannel.toString() : 'Nicht gesetzt', inline: true },
        { name: '📂 Kategorie', value: category?.name || 'Nicht gesetzt', inline: true },
        { name: '🔧 Status', value: 'Aktiviert', inline: true }
      ])
      .addFields({
        name: '📖 Funktionsweise',
        value: 'Benutzer können dem Trigger-Channel beitreten, um automatisch einen eigenen temporären Voice Channel zu erstellen.',
        inline: false
      })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

  } catch (error) {
    console.error('Fehler beim Einrichten des Join-To-Create Systems:', error);
    await interaction.editReply({
      content: '❌ Ein Fehler ist aufgetreten beim Einrichten des Systems.',
    });
  }
}

async function handleDisable(interaction: ChatInputCommandInteraction) {
  const guild = interaction.guild!;

  await interaction.deferReply();

  try {
    // Alle aktiven temporären Channels löschen
    const tempChannels = await DatabaseService.prisma.tempVoiceChannel.findMany({
      where: { guildId: guild.id }
    });

    for (const tempChannel of tempChannels) {
      try {
        const channel = await guild.channels.fetch(tempChannel.channelId);
        if (channel) {
          await channel.delete('Join-To-Create System deaktiviert');
        }
      } catch (error) {
        console.error(`Fehler beim Löschen von Channel ${tempChannel.channelId}:`, error);
      }
      
      await DatabaseService.deleteTempChannel(tempChannel.channelId);
    }

    // System deaktivieren
    await DatabaseService.updateGuildSettings(guild.id, {
      enableJoinToCreate: false,
      joinToCreateChannelId: null,
      joinToCreateCategoryId: null
    });

    const embed = new EmbedBuilder()
      .setColor(0xff6b35)
      .setTitle('✅ Join-To-Create System deaktiviert')
      .setDescription(`Das System wurde deaktiviert und ${tempChannels.length} temporäre Channels wurden gelöscht.`)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

  } catch (error) {
    console.error('Fehler beim Deaktivieren des Join-To-Create Systems:', error);
    await interaction.editReply({
      content: '❌ Ein Fehler ist aufgetreten beim Deaktivieren des Systems.',
    });
  }
}

async function handleList(interaction: ChatInputCommandInteraction) {
  const guild = interaction.guild!;

  await interaction.deferReply({ ephemeral: true });

  try {
    const tempChannels = await DatabaseService.prisma.tempVoiceChannel.findMany({
      where: { guildId: guild.id },
      include: { owner: true },
      orderBy: { createdAt: 'desc' }
    });

    if (tempChannels.length === 0) {
      return interaction.editReply({
        content: '🎤 Keine aktiven temporären Voice Channels vorhanden.',
      });
    }

    const embed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle('🎤 Aktive temporäre Voice Channels')
      .setDescription(`${tempChannels.length} aktive Channel(s) gefunden`)
      .setTimestamp();

    for (let i = 0; i < Math.min(tempChannels.length, 10); i++) {
      const tempChannel = tempChannels[i];
      try {
        const channel = await guild.channels.fetch(tempChannel.channelId);
        const memberCount = channel && 'members' in channel && 'size' in channel.members ? channel.members.size : 0;
        
        embed.addFields({
          name: `${i + 1}. ${channel?.name || 'Unbekannter Channel'}`,
          value: `**Besitzer:** <@${tempChannel.ownerId}>\n**Mitglieder:** ${memberCount}\n**Erstellt:** <t:${Math.floor(tempChannel.createdAt.getTime() / 1000)}:R>`,
          inline: true
        });
      } catch (error) {
        // Channel existiert nicht mehr - aus DB entfernen
        await DatabaseService.deleteTempChannel(tempChannel.channelId);
      }
    }

    if (tempChannels.length > 10) {
      embed.setFooter({ text: `Zeige die ersten 10 von ${tempChannels.length} Channels` });
    }

    await interaction.editReply({ embeds: [embed] });

  } catch (error) {
    console.error('Fehler beim Laden der temporären Channels:', error);
    await interaction.editReply({
      content: '❌ Ein Fehler ist aufgetreten beim Laden der Channels.',
    });
  }
}

async function handleDelete(interaction: ChatInputCommandInteraction) {
  const channel = interaction.options.getChannel('channel', true);
  const guild = interaction.guild!;

  await interaction.deferReply();

  try {
    // Prüfen ob es ein temporärer Channel ist
    const tempChannel = await DatabaseService.getTempChannel(channel.id);

    if (!tempChannel) {
      return interaction.editReply({
        content: '❌ Dieser Channel ist kein temporärer Voice Channel.',
      });
    }

    // Channel löschen
    await guild.channels.delete(channel.id, `Temporärer Channel gelöscht von ${interaction.user.tag}`);
    await DatabaseService.deleteTempChannel(channel.id);

    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle('✅ Temporärer Channel gelöscht')
      .setDescription(`Der temporäre Voice Channel wurde erfolgreich gelöscht.`)
      .addFields([
        { name: '🎤 Channel', value: channel?.name || 'Unbekannt', inline: true },
        { name: '👤 Besitzer', value: `<@${tempChannel.ownerId}>`, inline: true },
        { name: '👮 Gelöscht von', value: interaction.user.toString(), inline: true }
      ])
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

  } catch (error) {
    console.error('Fehler beim Löschen des temporären Channels:', error);
    await interaction.editReply({
      content: '❌ Ein Fehler ist aufgetreten beim Löschen des Channels.',
    });
  }
}

export const options = {
  userPermissions: [PermissionFlagsBits.Administrator],
  botPermissions: ['ManageChannels', 'Connect', 'Speak'],
};