import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits
} from 'discord.js';
import { DatabaseService } from '../../lib/database';

export const data = new SlashCommandBuilder()
  .setName('poll')
  .setDescription('Umfragen verwalten')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
  .addSubcommand(subcommand =>
    subcommand
      .setName('create')
      .setDescription('Erstellt eine neue Umfrage')
      .addStringOption(option =>
        option
          .setName('title')
          .setDescription('Titel der Umfrage')
          .setRequired(true)
      )
      .addStringOption(option =>
        option
          .setName('options')
          .setDescription('Optionen (mit Komma getrennt, max. 10)')
          .setRequired(true)
      )
      .addStringOption(option =>
        option
          .setName('emojis')
          .setDescription('Emojis für Optionen (mit Komma getrennt, gleiche Anzahl wie Optionen)')
          .setRequired(false)
      )
      .addStringOption(option =>
        option
          .setName('description')
          .setDescription('Beschreibung der Umfrage')
          .setRequired(false)
      )
      .addBooleanOption(option =>
        option
          .setName('multiple')
          .setDescription('Mehrfachauswahl erlauben')
          .setRequired(false)
      )
      .addBooleanOption(option =>
        option
          .setName('anonymous')
          .setDescription('Anonyme Abstimmung')
          .setRequired(false)
      )
      .addIntegerOption(option =>
        option
          .setName('duration')
          .setDescription('Dauer in Stunden (0 = kein Ende)')
          .setRequired(false)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('end')
      .setDescription('Beendet eine Umfrage vorzeitig')
      .addIntegerOption(option =>
        option
          .setName('id')
          .setDescription('ID der Umfrage')
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('list')
      .setDescription('Zeigt alle aktiven Umfragen an')
  );

export async function run({ interaction }: { interaction: ChatInputCommandInteraction }) {
  const subcommand = interaction.options.getSubcommand();

  // Prüfe ob Polls aktiviert sind
  const guildSettings = await DatabaseService.getGuildSettings(interaction.guild!.id);
  if (!guildSettings.enablePolls) {
    return interaction.reply({
      content: '❌ Polls sind auf diesem Server deaktiviert.',
      ephemeral: true,
    });
  }

  switch (subcommand) {
    case 'create':
      await handleCreatePoll(interaction);
      break;
    case 'end':
      await handleEndPoll(interaction);
      break;
    case 'list':
      await handleListPolls(interaction);
      break;
  }
}

async function handleCreatePoll(interaction: ChatInputCommandInteraction) {
  const title = interaction.options.getString('title', true);
  const optionsString = interaction.options.getString('options', true);
  const emojisString = interaction.options.getString('emojis');
  const description = interaction.options.getString('description');
  const multiple = interaction.options.getBoolean('multiple') || false;
  const anonymous = interaction.options.getBoolean('anonymous') || false;
  const duration = interaction.options.getInteger('duration') || 0;

  await interaction.deferReply();

  try {
    // Optionen verarbeiten
    const options = optionsString.split(',').map(option => option.trim());
    
    // Maximale Anzahl an Optionen überprüfen
    if (options.length > 10) {
      return interaction.editReply('❌ Maximal 10 Optionen erlaubt.');
    }

    if (options.length < 2) {
      return interaction.editReply('❌ Mindestens 2 Optionen benötigt.');
    }

    // Emojis verarbeiten
    let emojis: string[] = [];
    if (emojisString) {
      emojis = emojisString.split(',').map(emoji => emoji.trim());
      
      // Prüfen ob Anzahl der Emojis mit Anzahl der Optionen übereinstimmt
      if (emojis.length !== options.length) {
        return interaction.editReply('❌ Anzahl der Emojis muss mit Anzahl der Optionen übereinstimmen.');
      }
    } else {
      // Standard-Emojis verwenden
      const defaultEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
      emojis = defaultEmojis.slice(0, options.length);
    }

    // Endzeit berechnen, falls Dauer > 0
    let endTime: Date | undefined;
    if (duration > 0) {
      endTime = new Date();
      endTime.setHours(endTime.getHours() + duration);
    }

    // Poll erstellen
    const poll = await DatabaseService.createPoll({
      guildId: interaction.guild!.id,
      channelId: interaction.channel!.id,
      title,
      description: description || undefined,
      creatorId: interaction.user.id,
      multiple,
      anonymous,
      endTime,
      options: options.map((option, i) => `${emojis[i]} ${option}`)
    });

    // Embed erstellen
    const embed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle(`📊 ${poll.title}`)
      .setTimestamp();

    if (description) {
      embed.setDescription(description);
    }

    // Optionen als Felder hinzufügen
    embed.addFields(
      poll.options.map((option: any, index: number) => ({
        name: `${index + 1}. ${option.text}`,
        value: '0 Stimmen (0%)',
        inline: false
      }))
    );

    // Footer für Zusatzinfos
    let footerText = multiple ? 'Mehrfachauswahl möglich' : 'Nur eine Auswahl möglich';
    if (anonymous) {
      footerText += ' • Anonyme Abstimmung';
    }
    
    if (endTime) {
      embed.addFields({
        name: '⏰ Endet',
        value: `<t:${Math.floor(endTime.getTime() / 1000)}:R>`,
        inline: false
      });
    }

    embed.setFooter({ text: footerText });

    // Buttons für Abstimmung erstellen
    const rows: ActionRowBuilder<ButtonBuilder>[] = [];
    let currentRow = new ActionRowBuilder<ButtonBuilder>();
    let buttonCount = 0;

    for (let i = 0; i < poll.options.length; i++) {
      if (buttonCount === 5) {
        rows.push(currentRow);
        currentRow = new ActionRowBuilder<ButtonBuilder>();
        buttonCount = 0;
      }

      currentRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`poll_vote_${poll.id}_${i}`)
          .setLabel(options[i])
          .setEmoji(emojis[i])
          .setStyle(ButtonStyle.Primary)
      );

      buttonCount++;
    }

    // Letzte Reihe hinzufügen
    if (buttonCount > 0) {
      rows.push(currentRow);
    }

    // Ergebnisse-Button hinzufügen
    const resultsRow = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`poll_results_${poll.id}`)
          .setLabel('Ergebnisse anzeigen')
          .setEmoji('📊')
          .setStyle(ButtonStyle.Secondary)
      );

    rows.push(resultsRow);

    // Nachricht senden
    const message = await interaction.editReply({
      content: `${interaction.user} hat eine Umfrage erstellt!`,
      embeds: [embed],
      components: rows
    });

    // Message-ID in Datenbank speichern
    if ('id' in message) {
      await DatabaseService.updatePoll(poll.id, {
        messageId: message.id
      });
    }

  } catch (error) {
    console.error('Fehler beim Erstellen der Umfrage:', error);
    await interaction.editReply('❌ Es ist ein Fehler aufgetreten. Bitte versuche es erneut.');
  }
}

async function handleEndPoll(interaction: ChatInputCommandInteraction) {
  const pollId = interaction.options.getInteger('id', true);
  
  await interaction.deferReply();

  try {
    // Poll abrufen und überprüfen
    const poll = await DatabaseService.getPoll(pollId, interaction.guild!.id);
    
    if (!poll) {
      return interaction.editReply('❌ Umfrage mit dieser ID nicht gefunden.');
    }
    
    if (!poll.active) {
      return interaction.editReply('❌ Diese Umfrage ist bereits beendet.');
    }

    // Poll beenden
    await DatabaseService.endPoll(pollId);

    // Ergebnisse abrufen
    const results = await DatabaseService.getPollResults(pollId);
    const totalVotes = results.reduce((sum: number, result: { votes: number }) => sum + result.votes, 0);

    // Ergebnis-Embed erstellen
    const embed = new EmbedBuilder()
      .setColor(0x95a5a6)
      .setTitle(`📊 Umfrage beendet: ${poll.title}`)
      .setDescription(poll.description || '')
      .setTimestamp();

    if (results.length === 0 || totalVotes === 0) {
      embed.addFields({
        name: '📊 Endergebnisse',
        value: 'Keine Stimmen abgegeben.',
        inline: false
      });
    } else {
      embed.addFields({
        name: '📊 Endergebnisse',
        value: results.map((result) => {
          const percentage = Math.round((result.votes / totalVotes) * 100);
          const bar = '█'.repeat(Math.floor(percentage / 10)) + '░'.repeat(10 - Math.floor(percentage / 10));
          return `${result.emoji || '📊'} **${result.text}**\n${bar} ${result.votes} (${percentage}%)`;
        }).join('\n\n'),
        inline: false
      });
    }

    embed.addFields({
      name: '📈 Statistiken',
      value: `Gesamtstimmen: ${totalVotes}`,
      inline: true
    });

    // Antwort senden
    await interaction.editReply({ embeds: [embed] });

    // Original Poll-Nachricht aktualisieren, falls vorhanden
    if (poll.messageId) {
      try {
        const channel = await interaction.guild!.channels.fetch(poll.channelId);
        if (channel && channel.isTextBased()) {
          const message = await channel.messages.fetch(poll.messageId);
          
          if (message) {
            const originalEmbed = EmbedBuilder.from(message.embeds[0])
              .setColor(0x95a5a6)
              .setTitle(`📊 ${poll.title} [BEENDET]`);
            
            await message.edit({
              embeds: [originalEmbed],
              components: []  // Entferne alle Buttons
            });
          }
        }
      } catch (error) {
        console.error('Fehler beim Aktualisieren der Poll-Nachricht:', error);
        // Fehler ignorieren, Hauptaktion wurde ausgeführt
      }
    }

  } catch (error) {
    console.error('Fehler beim Beenden der Umfrage:', error);
    await interaction.editReply('❌ Es ist ein Fehler aufgetreten. Bitte versuche es erneut.');
  }
}

async function handleListPolls(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  try {
    // Aktive Polls abrufen
    const activePolls = await DatabaseService.getActivePolls(interaction.guild!.id);

    if (activePolls.length === 0) {
      return interaction.editReply('❌ Keine aktiven Umfragen gefunden.');
    }

    // Embed erstellen
    const embed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle('📊 Aktive Umfragen')
      .setDescription(`Es gibt ${activePolls.length} aktive Umfrage(n) auf diesem Server.`)
      .setTimestamp();

    // Umfragen hinzufügen
    for (const poll of activePolls) {
      let fieldValue = '';
      
      // Link zur Nachricht hinzufügen, falls vorhanden
      if (poll.messageId) {
        fieldValue += `[Zur Umfrage springen](https://discord.com/channels/${interaction.guild!.id}/${poll.channelId}/${poll.messageId})\n`;
      }
      
      // Ersteller hinzufügen
      fieldValue += `👤 Ersteller: <@${poll.creatorId}>\n`;
      
      // Optionsanzahl hinzufügen
      fieldValue += `📊 ${poll.options.length} Optionen\n`;
      
      // Ende hinzufügen, falls vorhanden
      if (poll.endTime) {
        fieldValue += `⏰ Endet: <t:${Math.floor(poll.endTime.getTime() / 1000)}:R>`;
      } else {
        fieldValue += `⏰ Kein Endzeitpunkt`;
      }

      embed.addFields({
        name: `ID ${poll.id}: ${poll.title}`,
        value: fieldValue,
        inline: false
      });
    }

    await interaction.editReply({ embeds: [embed] });

  } catch (error) {
    console.error('Fehler beim Laden der Umfragen:', error);
    await interaction.editReply('❌ Es ist ein Fehler aufgetreten. Bitte versuche es erneut.');
  }
}
