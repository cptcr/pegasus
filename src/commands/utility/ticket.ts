import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  ChannelType
} from 'discord.js';
import { DatabaseService } from '../../lib/database';

export const data = new SlashCommandBuilder()
  .setName('ticket')
  .setDescription('Ticket-System verwalten')
  .addSubcommand(subcommand =>
    subcommand
      .setName('list')
      .setDescription('Alle offenen Tickets anzeigen')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('claim')
      .setDescription('Ticket übernehmen')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('priority')
      .setDescription('Ticket-Priorität ändern')
      .addStringOption(option =>
        option
          .setName('level')
          .setDescription('Prioritätslevel')
          .setRequired(true)
          .addChoices(
            { name: 'Niedrig', value: 'LOW' },
            { name: 'Normal', value: 'MEDIUM' },
            { name: 'Hoch', value: 'HIGH' },
            { name: 'Dringend', value: 'URGENT' }
          )
      )
  );

export async function run({ interaction }: { interaction: ChatInputCommandInteraction }) {
  const subcommand = interaction.options.getSubcommand();

  switch (subcommand) {
    case 'setup':
      await handleSetup(interaction);
      break;
    case 'panel':
      await handlePanel(interaction);
      break;
    case 'close':
      await handleClose(interaction);
      break;
    case 'add':
      await handleAdd(interaction);
      break;
    case 'remove':
      await handleRemove(interaction);
      break;
    case 'list':
      await handleList(interaction);
      break;
    case 'claim':
      await handleClaim(interaction);
      break;
    case 'priority':
      await handlePriority(interaction);
      break;
  }
}

async function handleSetup(interaction: ChatInputCommandInteraction) {
  const category = interaction.options.getChannel('category', true);
  const channel = interaction.options.getChannel('channel', true);
  const guild = interaction.guild!;

  // Admin-Berechtigung prüfen
  const member = interaction.member as any;
  if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({
      content: '❌ Du benötigst Administrator-Berechtigung für diesen Befehl.',
      ephemeral: true,
    });
  }

  await interaction.deferReply();

  try {
    if (category.type !== ChannelType.GuildCategory) {
      return interaction.editReply({
        content: '❌ Du musst eine Kategorie auswählen.',
      });
    }

    // Guild-Einstellungen aktualisieren
    await DatabaseService.updateGuildSettings(guild.id, {
      enableTickets: true,
      name: guild.name
    });

    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle('✅ Ticket-System eingerichtet')
      .setDescription('Das Ticket-System wurde erfolgreich konfiguriert!')
      .addFields(
        { name: '📂 Ticket-Kategorie', value: category.name, inline: true },
        { name: '📢 Panel-Channel', value: channel.toString(), inline: true },
        { name: '🔧 Status', value: 'Aktiviert', inline: true }
      )
      .addFields({
        name: '📖 Nächste Schritte',
        value: `Verwende \`/ticket panel\` in ${channel} um das Ticket-Panel zu erstellen.`,
        inline: false
      })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

  } catch (error) {
    console.error('Fehler beim Einrichten des Ticket-Systems:', error);
    await interaction.editReply({
      content: '❌ Ein Fehler ist aufgetreten beim Einrichten des Systems.',
    });
  }
}

async function handlePanel(interaction: ChatInputCommandInteraction) {
  const targetChannel = interaction.options.getChannel('channel') || interaction.channel;
  const guild = interaction.guild!;

  // Moderator-Berechtigung prüfen
  const member = interaction.member as any;
  if (!member.permissions.has(PermissionFlagsBits.ManageChannels)) {
    return interaction.reply({
      content: '❌ Du benötigst die "Kanäle verwalten" Berechtigung.',
      ephemeral: true,
    });
  }

  await interaction.deferReply();

  try {
    const guildSettings = await DatabaseService.getGuildSettings(guild.id);
    if (!guildSettings.enableTickets) {
      return interaction.editReply({
        content: '❌ Das Ticket-System ist nicht aktiviert. Verwende `/ticket setup` zuerst.',
      });
    }

    // Ticket-Panel Embed erstellen
    const panelEmbed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle('🎫 Support-Tickets')
      .setDescription('Benötigst du Hilfe? Erstelle ein Support-Ticket!')
      .addFields(
        { name: '📋 Wie funktioniert es?', value: '1. Klicke auf "Ticket erstellen"\n2. Fülle das Formular aus\n3. Warte auf Antwort vom Support-Team', inline: false },
        { name: '⏰ Antwortzeit', value: 'Wir antworten normalerweise innerhalb von 24 Stunden', inline: true },
        { name: '🔒 Privatsphäre', value: 'Nur du und das Support-Team können dein Ticket sehen', inline: true }
      )
      .setFooter({ text: 'Support-Team • Hinko Bot' })
      .setTimestamp();

    // Buttons für verschiedene Ticket-Typen
    const row1 = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('ticket_create_general')
          .setLabel('🎫 Allgemeiner Support')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('ticket_create_bug')
          .setLabel('🐛 Bug Report')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('ticket_create_suggestion')
          .setLabel('💡 Vorschlag')
          .setStyle(ButtonStyle.Success)
      );

    const row2 = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('ticket_create_appeal')
          .setLabel('📋 Entbannungsantrag')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('ticket_create_other')
          .setLabel('❓ Sonstiges')
          .setStyle(ButtonStyle.Secondary)
      );

    const panelMessage = await (targetChannel as any).send({
      embeds: [panelEmbed],
      components: [row1, row2]
    });

    const confirmEmbed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle('✅ Ticket-Panel erstellt')
      .setDescription(`Das Ticket-Panel wurde in ${targetChannel} erstellt.`)
      .setTimestamp();

    await interaction.editReply({ embeds: [confirmEmbed] });

  } catch (error) {
    console.error('Fehler beim Erstellen des Ticket-Panels:', error);
    await interaction.editReply({
      content: '❌ Ein Fehler ist aufgetreten beim Erstellen des Panels.',
    });
  }
}

async function handleClose(interaction: ChatInputCommandInteraction) {
  const reason = interaction.options.getString('reason') || 'Kein Grund angegeben';
  const guild = interaction.guild!;
  const channel = interaction.channel!;

  await interaction.deferReply();

  try {
    // Prüfen ob aktueller Channel ein Ticket ist
    const tickets = await DatabaseService.getOpenTickets(guild.id);
    const currentTicket = tickets.find(ticket => ticket.channelId === channel.id);

    if (!currentTicket) {
      return interaction.editReply({
        content: '❌ Dies ist kein Ticket-Channel.',
      });
    }

    // Berechtigung prüfen
    const member = interaction.member as any;
    const isTicketOwner = currentTicket.userId === interaction.user.id;
    const isModerator = member.permissions.has(PermissionFlagsBits.ManageChannels);

    if (!isTicketOwner && !isModerator) {
      return interaction.editReply({
        content: '❌ Du kannst nur deine eigenen Tickets schließen.',
      });
    }

    // Ticket schließen
    await DatabaseService.closeTicket(currentTicket.id, interaction.user.id);

    const embed = new EmbedBuilder()
      .setColor(0xff6b35)
      .setTitle('🔒 Ticket wird geschlossen')
      .setDescription(`Dieses Ticket wird in 10 Sekunden geschlossen.`)
      .addFields(
        { name: '👤 Geschlossen von', value: interaction.user.toString(), inline: true },
        { name: '📝 Grund', value: reason, inline: true },
        { name: '⏰ Geschlossen am', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    // Channel nach 10 Sekunden löschen
    setTimeout(async () => {
      try {
        await channel.delete(`Ticket geschlossen von ${interaction.user.tag}: ${reason}`);
      } catch (error) {
        console.error('Fehler beim Löschen des Ticket-Channels:', error);
      }
    }, 10000);

    // Ticket-Ersteller benachrichtigen
    try {
      const user = await guild.members.fetch(currentTicket.userId);
      const dmEmbed = new EmbedBuilder()
        .setColor(0xff6b35)
        .setTitle('🔒 Ticket geschlossen')
        .setDescription(`Dein Ticket auf **${guild.name}** wurde geschlossen.`)
        .addFields(
          { name: '🎫 Betreff', value: currentTicket.subject, inline: true },
          { name: '📝 Grund', value: reason, inline: true }
        )
        .setTimestamp();

      await user.send({ embeds: [dmEmbed] });
    } catch (error) {
      // DM konnte nicht gesendet werden
    }

  } catch (error) {
    console.error('Fehler beim Schließen des Tickets:', error);
    await interaction.editReply({
      content: '❌ Ein Fehler ist aufgetreten beim Schließen des Tickets.',
    });
  }
}

async function handleAdd(interaction: ChatInputCommandInteraction) {
  const user = interaction.options.getUser('user', true);
  const guild = interaction.guild!;
  const channel = interaction.channel!;

  // Moderator-Berechtigung prüfen
  const member = interaction.member as any;
  if (!member.permissions.has(PermissionFlagsBits.ManageChannels)) {
    return interaction.reply({
      content: '❌ Du benötigst die "Kanäle verwalten" Berechtigung.',
      ephemeral: true,
    });
  }

  await interaction.deferReply();

  try {
    // Prüfen ob aktueller Channel ein Ticket ist
    const tickets = await DatabaseService.getOpenTickets(guild.id);
    const currentTicket = tickets.find(ticket => ticket.channelId === channel.id);

    if (!currentTicket) {
      return interaction.editReply({
        content: '❌ Dies ist kein Ticket-Channel.',
      });
    }

    // Benutzer zum Channel hinzufügen
    await (channel as any).permissionOverwrites.edit(user.id, {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true
    });

    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle('✅ Benutzer hinzugefügt')
      .setDescription(`${user} wurde zu diesem Ticket hinzugefügt.`)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

  } catch (error) {
    console.error('Fehler beim Hinzufügen des Benutzers:', error);
    await interaction.editReply({
      content: '❌ Ein Fehler ist aufgetreten beim Hinzufügen des Benutzers.',
    });
  }
}

async function handleRemove(interaction: ChatInputCommandInteraction) {
  const user = interaction.options.getUser('user', true);
  const guild = interaction.guild!;
  const channel = interaction.channel!;

  // Moderator-Berechtigung prüfen
  const member = interaction.member as any;
  if (!member.permissions.has(PermissionFlagsBits.ManageChannels)) {
    return interaction.reply({
      content: '❌ Du benötigst die "Kanäle verwalten" Berechtigung.',
      ephemeral: true,
    });
  }

  await interaction.deferReply();

  try {
    // Prüfen ob aktueller Channel ein Ticket ist
    const tickets = await DatabaseService.getOpenTickets(guild.id);
    const currentTicket = tickets.find(ticket => ticket.channelId === channel.id);

    if (!currentTicket) {
      return interaction.editReply({
        content: '❌ Dies ist kein Ticket-Channel.',
      });
    }

    // Ticket-Ersteller kann nicht entfernt werden
    if (user.id === currentTicket.userId) {
      return interaction.editReply({
        content: '❌ Der Ticket-Ersteller kann nicht entfernt werden.',
      });
    }

    // Benutzer aus Channel entfernen
    await (channel as any).permissionOverwrites.delete(user.id);

    const embed = new EmbedBuilder()
      .setColor(0xff6b35)
      .setTitle('✅ Benutzer entfernt')
      .setDescription(`${user} wurde aus diesem Ticket entfernt.`)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

  } catch (error) {
    console.error('Fehler beim Entfernen des Benutzers:', error);
    await interaction.editReply({
      content: '❌ Ein Fehler ist aufgetreten beim Entfernen des Benutzers.',
    });
  }
}

async function handleList(interaction: ChatInputCommandInteraction) {
  const guild = interaction.guild!;

  // Moderator-Berechtigung prüfen
  const member = interaction.member as any;
  if (!member.permissions.has(PermissionFlagsBits.ManageChannels)) {
    return interaction.reply({
      content: '❌ Du benötigst die "Kanäle verwalten" Berechtigung.',
      ephemeral: true,
    });
  }

  await interaction.deferReply();

  try {
    const tickets = await DatabaseService.getOpenTickets(guild.id);

    if (tickets.length === 0) {
      return interaction.editReply({
        content: '🎫 Keine offenen Tickets vorhanden.',
      });
    }

    const embed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle('🎫 Offene Tickets')
      .setDescription(`${tickets.length} offene(s) Ticket(s) gefunden`)
      .setTimestamp();

    tickets.slice(0, 10).forEach((ticket, index) => {
      const priorityEmoji = {
        LOW: '🟢',
        MEDIUM: '🟡',
        HIGH: '🟠',
        URGENT: '🔴'
      }[ticket.priority];

      const statusEmoji = {
        OPEN: '🆕',
        IN_PROGRESS: '⚠️',
        WAITING: '⏳'
      }[ticket.status];

      embed.addFields({
        name: `${index + 1}. Ticket #${ticket.id}`,
        value: `**Betreff:** ${ticket.subject}\n**Ersteller:** <@${ticket.userId}>\n**Status:** ${statusEmoji} ${ticket.status}\n**Priorität:** ${priorityEmoji} ${ticket.priority}\n**Channel:** <#${ticket.channelId}>`,
        inline: true
      });
    });

    if (tickets.length > 10) {
      embed.setFooter({ text: `Zeige die ersten 10 von ${tickets.length} Tickets` });
    }

    await interaction.editReply({ embeds: [embed] });

  } catch (error) {
    console.error('Fehler beim Laden der Tickets:', error);
    await interaction.editReply({
      content: '❌ Ein Fehler ist aufgetreten beim Laden der Tickets.',
    });
  }
}

async function handleClaim(interaction: ChatInputCommandInteraction) {
  const guild = interaction.guild!;
  const channel = interaction.channel!;

  // Moderator-Berechtigung prüfen
  const member = interaction.member as any;
  if (!member.permissions.has(PermissionFlagsBits.ManageChannels)) {
    return interaction.reply({
      content: '❌ Du benötigst die "Kanäle verwalten" Berechtigung.',
      ephemeral: true,
    });
  }

  await interaction.deferReply();

  try {
    // Prüfen ob aktueller Channel ein Ticket ist
    const tickets = await DatabaseService.getOpenTickets(guild.id);
    const currentTicket = tickets.find(ticket => ticket.channelId === channel.id);

    if (!currentTicket) {
      return interaction.editReply({
        content: '❌ Dies ist kein Ticket-Channel.',
      });
    }

    if (currentTicket.moderatorId) {
      return interaction.editReply({
        content: `❌ Dieses Ticket wurde bereits von <@${currentTicket.moderatorId}> übernommen.`,
      });
    }

    // Ticket übernehmen
    await DatabaseService.updateTicket(currentTicket.id, {
      moderatorId: interaction.user.id,
      status: 'IN_PROGRESS'
    });

    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle('✅ Ticket übernommen')
      .setDescription(`${interaction.user} hat dieses Ticket übernommen und arbeitet daran.`)
      .addFields(
        { name: '🎫 Ticket-ID', value: currentTicket.id.toString(), inline: true },
        { name: '📋 Status', value: 'In Bearbeitung', inline: true },
        { name: '👤 Moderator', value: interaction.user.toString(), inline: true }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

  } catch (error) {
    console.error('Fehler beim Übernehmen des Tickets:', error);
    await interaction.editReply({
      content: '❌ Ein Fehler ist aufgetreten beim Übernehmen des Tickets.',
    });
  }
}

async function handlePriority(interaction: ChatInputCommandInteraction) {
  const priority = interaction.options.getString('level', true) as 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  const guild = interaction.guild!;
  const channel = interaction.channel!;

  // Moderator-Berechtigung prüfen
  const member = interaction.member as any;
  if (!member.permissions.has(PermissionFlagsBits.ManageChannels)) {
    return interaction.reply({
      content: '❌ Du benötigst die "Kanäle verwalten" Berechtigung.',
      ephemeral: true,
    });
  }

  await interaction.deferReply();

  try {
    // Prüfen ob aktueller Channel ein Ticket ist
    const tickets = await DatabaseService.getOpenTickets(guild.id);
    const currentTicket = tickets.find(ticket => ticket.channelId === channel.id);

    if (!currentTicket) {
      return interaction.editReply({
        content: '❌ Dies ist kein Ticket-Channel.',
      });
    }

    // Priorität aktualisieren
    await DatabaseService.updateTicket(currentTicket.id, { priority });

    const priorityEmoji = {
      LOW: '🟢',
      MEDIUM: '🟡',
      HIGH: '🟠',
      URGENT: '🔴'
    }[priority];

    const priorityName = {
      LOW: 'Niedrig',
      MEDIUM: 'Normal',
      HIGH: 'Hoch',
      URGENT: 'Dringend'
    }[priority];

    const embed = new EmbedBuilder()
      .setColor(priority === 'URGENT' ? 0xff0000 : priority === 'HIGH' ? 0xff6b35 : priority === 'MEDIUM' ? 0xffeb3b : 0x4caf50)
      .setTitle('🏷️ Priorität geändert')
      .setDescription(`Die Priorität dieses Tickets wurde geändert.`)
      .addFields(
        { name: '🎫 Ticket-ID', value: currentTicket.id.toString(), inline: true },
        { name: '🏷️ Neue Priorität', value: `${priorityEmoji} ${priorityName}`, inline: true },
        { name: '👤 Geändert von', value: interaction.user.toString(), inline: true }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

  } catch (error) {
    console.error('Fehler beim Ändern der Priorität:', error);
    await interaction.editReply({
      content: '❌ Ein Fehler ist aufgetreten beim Ändern der Priorität.',
    });
  }
}

export const options = {
  botPermissions: ['SendMessages', 'ManageChannels', 'ManageRoles'],
};d =>
    subcommand
      .setName('setup')
      .setDescription('Ticket-System einrichten')
      .addChannelOption(option =>
        option
          .setName('category')
          .setDescription('Kategorie für Ticket-Channels')
          .setRequired(true)
      )
      .addChannelOption(option =>
        option
          .setName('channel')
          .setDescription('Channel für Ticket-Panel')
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('panel')
      .setDescription('Ticket-Panel in einem Channel erstellen')
      .addChannelOption(option =>
        option
          .setName('channel')
          .setDescription('Channel für das Panel')
          .setRequired(false)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('close')
      .setDescription('Aktuelles Ticket schließen')
      .addStringOption(option =>
        option
          .setName('reason')
          .setDescription('Grund für das Schließen')
          .setRequired(false)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('add')
      .setDescription('Benutzer zum Ticket hinzufügen')
      .addUserOption(option =>
        option
          .setName('user')
          .setDescription('Benutzer')
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('remove')
      .setDescription('Benutzer aus Ticket entfernen')
      .addUserOption(option =>
        option
          .setName('user')
          .setDescription('Benutzer')
          .setRequired(true)
      )
  )
  .addSubcommand(subcomman