import { 
  Events, 
  Interaction, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ChannelType,
  PermissionFlagsBits,
  MessageReaction,
  User as DiscordUser,
  GuildMember,
  Role
} from 'discord.js';
import { DatabaseService } from '../lib/database';

export const interactionCreate = {
  name: Events.InteractionCreate,
  async execute(interaction: Interaction) {
    if (interaction.isButton()) {
      await handleButtonInteraction(interaction);
    } else if (interaction.isModalSubmit()) {
      await handleModalSubmit(interaction);
    }
  },
};

// ReactionRole Event Handler
export const messageReactionAdd = {
  name: Events.MessageReactionAdd,
  async execute(reaction: MessageReaction, user: DiscordUser) {
    try {
      // Ignoriere Bot-Reaktionen
      if (user.bot) return;

      // DM-Channels ignorieren
      if (!reaction.message.guild) return;

      // Reaktion abrufen, falls nicht gecached
      if (reaction.partial) {
        await reaction.fetch();
      }

      // Nachricht abrufen, falls nicht gecached
      if (reaction.message.partial) {
        await reaction.message.fetch();
      }

      // Emoji-Name oder ID extrahieren
      const emoji = reaction.emoji.id || reaction.emoji.name;
      if (!emoji) return;

      // Prüfen, ob eine Reaktionsrolle für diese Nachricht und Emoji existiert
      const reactionRole = await DatabaseService.getReactionRole(reaction.message.id, emoji);
      if (!reactionRole) return;

      // Rolle abrufen
      const role = await reaction.message.guild.roles.fetch(reactionRole.roleId);
      if (!role) {
        console.warn(`Rolle mit ID ${reactionRole.roleId} wurde nicht gefunden.`);
        return;
      }

      // Mitglied abrufen
      const member = await reaction.message.guild.members.fetch(user.id);
      if (!member) return;

      // Rolle zuweisen
      if (!member.roles.cache.has(role.id)) {
        await member.roles.add(role);
        try {
          await user.send(`✅ Dir wurde die Rolle **${role.name}** auf dem Server **${reaction.message.guild.name}** zugewiesen.`);
        } catch (dmError) {
          // User hat DMs deaktiviert, ignorieren
        }
      }
    } catch (error) {
      console.error('Fehler beim Hinzufügen einer Reaktionsrolle:', error);
    }
  }
};

export const messageReactionRemove = {
  name: Events.MessageReactionRemove,
  async execute(reaction: MessageReaction, user: DiscordUser) {
    try {
      // Ignoriere Bot-Reaktionen
      if (user.bot) return;

      // DM-Channels ignorieren
      if (!reaction.message.guild) return;

      // Reaktion abrufen, falls nicht gecached
      if (reaction.partial) {
        await reaction.fetch();
      }

      // Nachricht abrufen, falls nicht gecached
      if (reaction.message.partial) {
        await reaction.message.fetch();
      }

      // Emoji-Name oder ID extrahieren
      const emoji = reaction.emoji.id || reaction.emoji.name;
      if (!emoji) return;

      // Prüfen, ob eine Reaktionsrolle für diese Nachricht und Emoji existiert
      const reactionRole = await DatabaseService.getReactionRole(reaction.message.id, emoji);
      if (!reactionRole) return;

      // Rolle abrufen
      const role = await reaction.message.guild.roles.fetch(reactionRole.roleId);
      if (!role) {
        console.warn(`Rolle mit ID ${reactionRole.roleId} wurde nicht gefunden.`);
        return;
      }

      // Mitglied abrufen
      const member = await reaction.message.guild.members.fetch(user.id);
      if (!member) return;

      // Rolle entfernen
      if (member.roles.cache.has(role.id)) {
        await member.roles.remove(role);
        try {
          await user.send(`❌ Dir wurde die Rolle **${role.name}** auf dem Server **${reaction.message.guild.name}** entfernt.`);
        } catch (dmError) {
          // User hat DMs deaktiviert, ignorieren
        }
      }
    } catch (error) {
      console.error('Fehler beim Entfernen einer Reaktionsrolle:', error);
    }
  }
};

async function handleButtonInteraction(interaction: any) {
  const customId = interaction.customId;

  try {
    // Poll Voting
    if (customId.startsWith('poll_vote_')) {
      await handlePollVote(interaction);
    }
    // Poll Results
    else if (customId.startsWith('poll_results_')) {
      await handlePollResults(interaction);
    }
    // Giveaway Join
    else if (customId.startsWith('giveaway_join_')) {
      await handleGiveawayJoin(interaction);
    }
    // Ticket Creation
    else if (customId.startsWith('ticket_create_')) {
      await handleTicketCreate(interaction);
    }
    // Help Commands
    else if (customId.startsWith('help_')) {
      await handleHelpButtonClick(interaction);
    }

  } catch (error) {
    console.error('Fehler beim Button-Interaction:', error);
    
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: '❌ Ein Fehler ist aufgetreten.',
        ephemeral: true,
      });
    }
  }
}

async function handlePollVote(interaction: any) {
  const [, , pollId, optionIndex] = interaction.customId.split('_');
  const userId = interaction.user.id;
  const guildId = interaction.guild.id;

  await interaction.deferReply({ ephemeral: true });

  try {
    // Poll abrufen
    const poll = await DatabaseService.getPoll(parseInt(pollId), guildId);
    
    if (!poll) {
      return interaction.editReply({
        content: '❌ Umfrage nicht gefunden.',
      });
    }

    if (!poll.active) {
      return interaction.editReply({
        content: '❌ Diese Umfrage ist bereits beendet.',
      });
    }

    // Prüfen ob Umfrage abgelaufen
    if (poll.endTime && poll.endTime < new Date()) {
      await DatabaseService.endPoll(poll.id);
      return interaction.editReply({
        content: '❌ Diese Umfrage ist abgelaufen.',
      });
    }

    const optionId = poll.options[parseInt(optionIndex)]?.id;
    if (!optionId) {
      return interaction.editReply({
        content: '❌ Ungültige Option.',
      });
    }

    // Vorherige Stimmen prüfen
    const existingVotes = await DatabaseService.getUserVotes(poll.id, userId);

    // Wenn nicht Mehrfachauswahl und User hat bereits gestimmt
    if (!poll.multiple && existingVotes.length > 0) {
      // Prüfen ob für dieselbe Option gestimmt
      const existingVote = existingVotes.find(v => v.optionId === optionId);
      if (existingVote) {
        // Vote entfernen
        await DatabaseService.removeVote(poll.id, optionId, userId);
        await interaction.editReply({
          content: '✅ Deine Stimme wurde entfernt.',
        });
      } else {
        // Alte Stimme entfernen, neue hinzufügen
        for (const vote of existingVotes) {
          await DatabaseService.removeVote(poll.id, vote.optionId, userId);
        }
        await DatabaseService.votePoll(poll.id, optionId, userId);
        await interaction.editReply({
          content: '✅ Deine Stimme wurde geändert.',
        });
      }
    } else {
      // Prüfen ob bereits für diese Option gestimmt
      const existingVote = existingVotes.find(v => v.optionId === optionId);
      if (existingVote) {
        // Vote entfernen
        await DatabaseService.removeVote(poll.id, optionId, userId);
        await interaction.editReply({
          content: '✅ Deine Stimme wurde entfernt.',
        });
      } else {
        // Neue Stimme hinzufügen
        await DatabaseService.votePoll(poll.id, optionId, userId);
        await interaction.editReply({
          content: '✅ Deine Stimme wurde abgegeben.',
        });
      }
    }

    // Original Message mit aktuellen Ergebnissen aktualisieren
    await updatePollMessage(interaction, poll);

  } catch (error) {
    console.error('Fehler beim Poll-Voting:', error);
    await interaction.editReply({
      content: '❌ Fehler beim Abstimmen.',
    });
  }
}

async function handlePollResults(interaction: any) {
  const pollId = parseInt(interaction.customId.split('_')[2]);

  await interaction.deferReply({ ephemeral: true });

  try {
    const poll = await DatabaseService.getPoll(pollId, interaction.guild.id);
    
    if (!poll) {
      return interaction.editReply({
        content: '❌ Umfrage nicht gefunden.',
      });
    }

    const results = await DatabaseService.getPollResults(pollId);
    const totalVotes = results.reduce((sum, result) => sum + result.votes, 0);

    const embed = new EmbedBuilder()
      .setColor(poll.active ? 0x3498db : 0x95a5a6)
      .setTitle(`📊 Ergebnisse: ${poll.title}`)
      .setDescription(poll.description || '')
      .setTimestamp();

    if (results.length === 0 || totalVotes === 0) {
      embed.addFields({
        name: '📊 Ergebnisse',
        value: 'Noch keine Stimmen abgegeben.',
        inline: false
      });
    } else {
      embed.addFields({
        name: '📊 Ergebnisse',
        value: results.map(result => {
          const percentage = totalVotes > 0 ? Math.round((result.votes / totalVotes) * 100) : 0;
          const bar = '█'.repeat(Math.floor(percentage / 10)) + '░'.repeat(10 - Math.floor(percentage / 10));
          return `${result.emoji} **${result.text}**\n${bar} ${result.votes} (${percentage}%)`;
        }).join('\n\n'),
        inline: false
      });
    }

    embed.addFields(
      { name: '📈 Gesamtstimmen', value: totalVotes.toString(), inline: true },
      { name: '📅 Status', value: poll.active ? '🟢 Aktiv' : '🔴 Beendet', inline: true }
    );

    if (poll.endTime) {
      embed.addFields({
        name: '⏰ Endet/Endete',
        value: `<t:${Math.floor(poll.endTime.getTime() / 1000)}:R>`,
        inline: true
      });
    }

    await interaction.editReply({ embeds: [embed] });

  } catch (error) {
    console.error('Fehler beim Laden der Poll-Ergebnisse:', error);
    await interaction.editReply({
      content: '❌ Fehler beim Laden der Ergebnisse.',
    });
  }
}

async function handleGiveawayJoin(interaction: any) {
  const giveawayId = parseInt(interaction.customId.split('_')[2]);
  const userId = interaction.user.id;
  const guildId = interaction.guild.id;

  await interaction.deferReply({ ephemeral: true });

  try {
    // Giveaway abrufen
    const giveaway = await DatabaseService.getGiveaway(giveawayId, guildId);
    
    if (!giveaway) {
      return interaction.editReply({
        content: '❌ Gewinnspiel nicht gefunden.',
      });
    }

    if (giveaway.ended) {
      return interaction.editReply({
        content: '❌ Dieses Gewinnspiel ist bereits beendet.',
      });
    }

    // Prüfen ob Giveaway abgelaufen
    if (giveaway.endTime < new Date()) {
      await DatabaseService.endGiveaway(giveaway.id);
      return interaction.editReply({
        content: '❌ Dieses Gewinnspiel ist abgelaufen.',
      });
    }

    // Teilnehmen oder Teilnahme entfernen
    const isParticipating = giveaway.entries.some((entry: any) => entry.userId === userId);
    
    if (isParticipating) {
      // Wir können Teilnahme entfernen, aber das ist nicht immer gewünscht
      return interaction.editReply({
        content: '✅ Du nimmst bereits an diesem Gewinnspiel teil!',
      });
    } else {
      // Teilnehmen
      await DatabaseService.enterGiveaway(giveawayId, userId);
      
      await interaction.editReply({
        content: '✅ Du nimmst nun an diesem Gewinnspiel teil! Viel Glück!',
      });
      
      // Nachricht aktualisieren mit neuer Teilnehmerzahl
      await updateGiveawayMessage(interaction, giveaway);
    }

  } catch (error) {
    console.error('Fehler beim Giveaway-Teilnehmen:', error);
    await interaction.editReply({
      content: '❌ Fehler beim Teilnehmen am Gewinnspiel.',
    });
  }
}

async function handleTicketCreate(interaction: any) {
  const ticketType = interaction.customId.split('_')[2];
  const guildId = interaction.guild.id;
  const userId = interaction.user.id;

  // Modal für Ticket-Details anzeigen
  const modal = new ModalBuilder()
    .setCustomId(`ticket_modal_${ticketType}`)
    .setTitle('Support-Ticket erstellen');

  const subjectInput = new TextInputBuilder()
    .setCustomId('ticket_subject')
    .setLabel('Betreff')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Kurze Beschreibung deines Anliegens')
    .setRequired(true)
    .setMaxLength(100);

  const descriptionInput = new TextInputBuilder()
    .setCustomId('ticket_description')
    .setLabel('Beschreibung')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('Detaillierte Beschreibung deines Problems oder Anliegens')
    .setRequired(true)
    .setMaxLength(1000);

  const row1 = new ActionRowBuilder<TextInputBuilder>().addComponents(subjectInput);
  const row2 = new ActionRowBuilder<TextInputBuilder>().addComponents(descriptionInput);

  modal.addComponents(row1, row2);

  await interaction.showModal(modal);
}

async function handleModalSubmit(interaction: any) {
  if (interaction.customId.startsWith('ticket_modal_')) {
    await handleTicketModalSubmit(interaction);
  }
}

async function handleTicketModalSubmit(interaction: any) {
  const ticketType = interaction.customId.split('_')[2];
  const subject = interaction.fields.getTextInputValue('ticket_subject');
  const description = interaction.fields.getTextInputValue('ticket_description');
  const guild = interaction.guild;
  const user = interaction.user;

  await interaction.deferReply({ ephemeral: true });

  try {
    // Guild Settings prüfen
    const guildSettings = await DatabaseService.getGuildSettings(guild.id);
    if (!guildSettings.enableTickets) {
      return interaction.editReply({
        content: '❌ Das Ticket-System ist auf diesem Server nicht aktiviert.',
      });
    }

    // Prüfen ob User bereits ein offenes Ticket hat
    const existingTickets = await DatabaseService.prisma.ticket.findMany({
      where: {
        guildId: guild.id,
        userId: user.id,
        status: { not: 'CLOSED' }
      }
    });

    if (existingTickets.length >= 3) {
      return interaction.editReply({
        content: '❌ Du hast bereits die maximale Anzahl offener Tickets erreicht.',
      });
    }

    // Ticket-Kategorie finden
    const ticketCategories = await DatabaseService.getTicketCategories(guild.id);
    let ticketCategory = ticketCategories.find(cat => 
      cat.name.toLowerCase() === ticketType || 
      cat.name.toLowerCase().includes(ticketType)
    );

    // Default Kategorie wenn keine spezifische gefunden
    if (!ticketCategory && ticketCategories.length > 0) {
      ticketCategory = ticketCategories[0];
    }

    // Ticket Channel erstellen
    const categoryNames: { [key: string]: string } = {
      general: 'Allgemeiner Support',
      bug: 'Bug Report',
      suggestion: 'Vorschlag',
      appeal: 'Entbannungsantrag',
      other: 'Sonstiges'
    };

    const channelName = `ticket-${user.username}-${Date.now().toString().slice(-4)}`;
    
    // Kategorie für Ticket-Channels
    const parentCategory = ticketCategory?.categoryId || 
      guildSettings.joinToCreateCategoryId; // Fallback

    const ticketChannel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: parentCategory,
      permissionOverwrites: [
        {
          id: guild.roles.everyone.id,
          deny: [PermissionFlagsBits.ViewChannel],
        },
        {
          id: user.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AttachFiles,
          ],
        },
        {
          id: guild.members.me!.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.ManageChannels,
          ],
        },
      ],
      reason: `Ticket erstellt von ${user.tag}`,
    });

    // Ticket in Datenbank erstellen
    const ticket = await DatabaseService.createTicket({
      guildId: guild.id,
      channelId: ticketChannel.id,
      userId: user.id,
      categoryId: ticketCategory?.id,
      category: categoryNames[ticketType] || ticketType,
      subject,
    });

    // Ticket-Embed erstellen
    const ticketEmbed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle(`🎫 ${categoryNames[ticketType] || ticketType}`)
      .setDescription(`**Betreff:** ${subject}\n\n**Beschreibung:**\n${description}`)
      .addFields(
        { name: '👤 Erstellt von', value: user.toString(), inline: true },
        { name: '📋 Kategorie', value: categoryNames[ticketType] || ticketType, inline: true },
        { name: '🆔 Ticket-ID', value: ticket.id.toString(), inline: true }
      )
      .setTimestamp()
      .setFooter({ text: 'Support-Team wird sich bald melden' });

    // Control Buttons
    const controlRow = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`ticket_claim_${ticket.id}`)
          .setLabel('🙋‍♂️ Übernehmen')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`ticket_close_${ticket.id}`)
          .setLabel('🔒 Schließen')
          .setStyle(ButtonStyle.Danger)
      );

    await ticketChannel.send({
      content: `${user} Willkommen! Ein Support-Mitarbeiter wird sich bald um dein Anliegen kümmern.`,
      embeds: [ticketEmbed],
      components: [controlRow]
    });

    await interaction.editReply({
      content: `✅ Dein Ticket wurde erstellt: ${ticketChannel}`,
    });

    // Log in Moderations-Channel
    if (guildSettings.modLogChannelId) {
      try {
        const logChannel = await guild.channels.fetch(guildSettings.modLogChannelId);
        if (logChannel && logChannel.isTextBased()) {
          const logEmbed = new EmbedBuilder()
            .setColor(0x3498db)
            .setTitle('🎫 Neues Ticket erstellt')
            .addFields(
              { name: 'Benutzer', value: user.toString(), inline: true },
              { name: 'Kategorie', value: categoryNames[ticketType] || ticketType, inline: true },
              { name: 'Channel', value: ticketChannel.toString(), inline: true },
              { name: 'Betreff', value: subject, inline: false }
            )
            .setTimestamp();

          await logChannel.send({ embeds: [logEmbed] });
        }
      } catch (error) {
        console.error('Fehler beim Senden des Ticket-Logs:', error);
      }
    }

  } catch (error) {
    console.error('Fehler beim Erstellen des Tickets:', error);
    await interaction.editReply({
      content: '❌ Ein Fehler ist aufgetreten beim Erstellen des Tickets.',
    });
  }
}

async function updatePollMessage(interaction: any, poll: any) {
  if (!poll.messageId || !poll.channelId) return;

  try {
    const channel = await interaction.guild.channels.fetch(poll.channelId);
    if (!channel || !channel.isTextBased()) return;

    const message = await channel.messages.fetch(poll.messageId);
    if (!message) return;

    const results = await DatabaseService.getPollResults(poll.id);
    const totalVotes = results.reduce((sum, result) => sum + result.votes, 0);

    // Embed aktualisieren
    const embed = EmbedBuilder.from(message.embeds[0])
      .setDescription(poll.description || `Stimme ab! (${totalVotes} Stimmen)`);

    await message.edit({ embeds: [embed] });

  } catch (error) {
    console.error('Fehler beim Aktualisieren der Poll-Message:', error);
  }
}

async function updateGiveawayMessage(interaction: any, giveaway: any) {
  try {
    const channel = await interaction.guild.channels.fetch(giveaway.channelId);
    if (!channel) return;
    
    const message = await channel.messages.fetch(giveaway.messageId);
    if (!message) return;
    
    const embed = message.embeds[0];
    if (!embed) return;
    
    // Anzahl der Teilnehmer aktualisieren
    const updatedEmbed = EmbedBuilder.from(embed);
    
    // Entferne das vorherige Teilnehmerfeld
    const fields = updatedEmbed.data.fields || [];
    const updatedFields = fields.map(field => {
      if (field.name === '👥 Teilnehmer') {
        return {
          name: '👥 Teilnehmer',
          value: `${giveaway.entries.length + 1}`, // +1 für die neue Teilnahme
          inline: field.inline
        };
      }
      return field;
    });
    
    updatedEmbed.setFields(updatedFields);
    
    await message.edit({
      embeds: [updatedEmbed]
    });
  } catch (error) {
    console.error('Fehler beim Aktualisieren der Giveaway-Message:', error);
  }
}

// Handle help button clicks
async function handleHelpButtonClick(interaction: any) {
  const category = interaction.customId.split('_')[1];
  
  // Lade Guild Settings
  const guildSettings = await DatabaseService.getGuildSettings(interaction.guild.id);
  
  // Erstellen des temporären Funktionsaufrufs
  const tempInteraction = {
    ...interaction,
    options: {
      getString: () => category
    }
  };
  
  // Importiere die Help-Funktion
  const { run } = require('../commands/utility/help');
  
  // Führe die Funktion aus
  try {
    await run({ interaction: tempInteraction });
  } catch (error) {
    console.error('Fehler beim Anzeigen der Hilfe:', error);
    await interaction.reply({
      content: '❌ Ein Fehler ist aufgetreten beim Laden der Hilfe.',
      ephemeral: true
    });
  }
}