import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  ComponentType
} from 'discord.js';
import { DatabaseService } from '../../lib/database';

export const data = new SlashCommandBuilder()
  .setName('poll')
  .setDescription('Umfrage-System')
  .addSubcommand(subcommand =>
    subcommand
      .setName('create')
      .setDescription('Eine neue Umfrage erstellen')
      .addStringOption(option =>
        option
          .setName('title')
          .setDescription('Titel der Umfrage')
          .setRequired(true)
      )
      .addStringOption(option =>
        option
          .setName('options')
          .setDescription('Optionen getrennt durch | (z.B. Option1|Option2|Option3)')
          .setRequired(true)
      )
      .addStringOption(option =>
        option
          .setName('description')
          .setDescription('Beschreibung der Umfrage')
          .setRequired(false)
      )
      .addIntegerOption(option =>
        option
          .setName('duration')
          .setDescription('Dauer in Minuten (0 = unbegrenzt)')
          .setMinValue(0)
          .setMaxValue(10080) // 1 Woche
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
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('end')
      .setDescription('Eine Umfrage beenden')
      .addIntegerOption(option =>
        option
          .setName('id')
          .setDescription('Umfrage-ID')
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('list')
      .setDescription('Aktive Umfragen anzeigen')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('results')
      .setDescription('Umfrage-Ergebnisse anzeigen')
      .addIntegerOption(option =>
        option
          .setName('id')
          .setDescription('Umfrage-ID')
          .setRequired(true)
      )
  );

export async function run({ interaction }: { interaction: ChatInputCommandInteraction }) {
  const subcommand = interaction.options.getSubcommand();

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
    case 'results':
      await handlePollResults(interaction);
      break;
  }
}

async function handleCreatePoll(interaction: ChatInputCommandInteraction) {
  const title = interaction.options.getString('title', true);
  const optionsString = interaction.options.getString('options', true);
  const description = interaction.options.getString('description');
  const duration = interaction.options.getInteger('duration') || 0;
  const multiple = interaction.options.getBoolean('multiple') || false;
  const anonymous = interaction.options.getBoolean('anonymous') || false;
  const guild = interaction.guild!;

  await interaction.deferReply();

  try {
    // Guild Settings prüfen
    const guildSettings = await DatabaseService.getGuildSettings(guild.id);
    if (!guildSettings.enablePolls) {
      return interaction.editReply({
        content: '❌ Das Umfrage-System ist auf diesem Server deaktiviert.',
      });
    }

    // Optionen parsen
    const options = optionsString.split('|').map(opt => opt.trim()).filter(opt => opt.length > 0);
    
    if (options.length < 2) {
      return interaction.editReply({
        content: '❌ Du benötigst mindestens 2 Optionen für eine Umfrage.',
      });
    }
    
    if (options.length > 10) {
      return interaction.editReply({
        content: '❌ Maximal 10 Optionen erlaubt.',
      });
    }

    // Endzeit berechnen
    const endTime = duration > 0 ? new Date(Date.now() + duration * 60 * 1000) : null;

    // Poll in Datenbank erstellen
    const poll = await DatabaseService.createPoll({
      guildId: guild.id,
      channelId: interaction.channelId,
      title,
      description,
      creatorId: interaction.user.id,
      multiple,
      anonymous,
      endTime,
      options
    });

    // Embed erstellen
    const embed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle(`📊 ${title}`)
      .setDescription(description || 'Stimme ab!')
      .setFooter({ 
        text: `ID: ${poll.id} | ${multiple ? 'Mehrfachauswahl' : 'Einfachauswahl'} | ${anonymous ? 'Anonym' : 'Öffentlich'}` 
      })
      .setTimestamp();

    if (endTime) {
      embed.addFields({
        name: '⏰ Endet',
        value: `<t:${Math.floor(endTime.getTime() / 1000)}:R>`,
        inline: true
      });
    }

    // Buttons für Optionen erstellen (max 5 pro Row)
    const rows: ActionRowBuilder<ButtonBuilder>[] = [];
    const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
    
    for (let i = 0; i < options.length; i += 5) {
      const row = new ActionRowBuilder<ButtonBuilder>();
      const rowOptions = options.slice(i, i + 5);
      
      rowOptions.forEach((option, index) => {
        const emoji = emojis[i + index];
        const button = new ButtonBuilder()
          .setCustomId(`poll_vote_${poll.id}_${i + index}`)
          .setLabel(option.length > 80 ? option.substring(0, 77) + '...' : option)
          .setStyle(ButtonStyle.Secondary)
          .setEmoji(emoji);
        
        row.addComponents(button);
      });
      
      rows.push(row);
    }

    // Results Button hinzufügen
    const controlRow = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`poll_results_${poll.id}`)
          .setLabel('Ergebnisse anzeigen')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('📊')
      );
    
    rows.push(controlRow);

    // Optionen zum Embed hinzufügen
    embed.addFields({
      name: '📋 Optionen',
      value: options.map((option, index) => `${emojis[index]} ${option}`).join('\n'),
      inline: false
    });

    const message = await interaction.editReply({
      embeds: [embed],
      components: rows
    });

    // Message ID in Datenbank speichern
    await DatabaseService.updatePoll(poll.id, { messageId: message.id });

  } catch (error) {
    console.error('Fehler beim Erstellen der Umfrage:', error);
    await interaction.editReply({
      content: '❌ Ein Fehler ist aufgetreten beim Erstellen der Umfrage.',
    });
  }
}

async function handleEndPoll(interaction: ChatInputCommandInteraction) {
  const pollId = interaction.options.getInteger('id', true);
  const guild = interaction.guild!;

  // Berechtigung prüfen
  const member = interaction.member as any;
  if (!member.permissions.has(PermissionFlagsBits.ManageMessages)) {
    return interaction.reply({
      content: '❌ Du benötigst die "Nachrichten verwalten" Berechtigung.',
      ephemeral: true,
    });
  }

  await interaction.deferReply();

  try {
    const poll = await DatabaseService.getPoll(pollId, guild.id);
    
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

    // Poll beenden
    await DatabaseService.endPoll(pollId);

    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle('✅ Umfrage beendet')
      .setDescription(`Die Umfrage "${poll.title}" wurde erfolgreich beendet.`)
      .setTimestamp();

    // Ergebnisse laden und anzeigen
    const results = await DatabaseService.getPollResults(pollId);
    
    if (results.length > 0) {
      const totalVotes = results.reduce((sum, result) => sum + result.votes, 0);
      
      embed.addFields({
        name: '📊 Endergebnisse',
        value: results.map(result => {
          const percentage = totalVotes > 0 ? Math.round((result.votes / totalVotes) * 100) : 0;
          const bar = '█'.repeat(Math.floor(percentage / 10)) + '░'.repeat(10 - Math.floor(percentage / 10));
          return `${result.emoji} **${result.text}**\n${bar} ${result.votes} (${percentage}%)`;
        }).join('\n\n'),
        inline: false
      });
      
      embed.addFields({
        name: '📈 Statistiken',
        value: `Gesamtstimmen: ${totalVotes}`,
        inline: true
      });
    }

    await interaction.editReply({ embeds: [embed] });

    // Original Poll Message aktualisieren
    if (poll.messageId && poll.channelId) {
      try {
        const channel = await interaction.guild!.channels.fetch(poll.channelId) as any;
        const message = await channel.messages.fetch(poll.messageId);
        
        const updatedEmbed = EmbedBuilder.from(message.embeds[0])
          .setColor(0x95a5a6)
          .setTitle(`📊 ${poll.title} [BEENDET]`);
        
        await message.edit({
          embeds: [updatedEmbed],
          components: [] // Buttons entfernen
        });
      } catch (error) {
        console.error('Fehler beim Aktualisieren der Poll-Nachricht:', error);
      }
    }

  } catch (error) {
    console.error('Fehler beim Beenden der Umfrage:', error);
    await interaction.editReply({
      content: '❌ Ein Fehler ist aufgetreten beim Beenden der Umfrage.',
    });
  }
}

async function handleListPolls(interaction: ChatInputCommandInteraction) {
  const guild = interaction.guild!;

  await interaction.deferReply({ ephemeral: true });

  try {
    const polls = await DatabaseService.getActivePolls(guild.id);

    if (polls.length === 0) {
      return interaction.editReply({
        content: '📊 Keine aktiven Umfragen vorhanden.',
      });
    }

    const embed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle('📊 Aktive Umfragen')
      .setDescription(`${polls.length} aktive Umfrage(n) gefunden`)
      .setTimestamp();

    polls.slice(0, 10).forEach((poll, index) => {
      const endTime = poll.endTime ? `<t:${Math.floor(poll.endTime.getTime() / 1000)}:R>` : 'Unbegrenzt';
      embed.addFields({
        name: `${index + 1}. ${poll.title}`,
        value: `**ID:** ${poll.id}\n**Kanal:** <#${poll.channelId}>\n**Endet:** ${endTime}\n**Optionen:** ${poll.options.length}`,
        inline: true
      });
    });

    await interaction.editReply({ embeds: [embed] });

  } catch (error) {
    console.error('Fehler beim Laden der Umfragen:', error);
    await interaction.editReply({
      content: '❌ Ein Fehler ist aufgetreten beim Laden der Umfragen.',
    });
  }
}

async function handlePollResults(interaction: ChatInputCommandInteraction) {
  const pollId = interaction.options.getInteger('id', true);
  const guild = interaction.guild!;

  await interaction.deferReply({ ephemeral: true });

  try {
    const poll = await DatabaseService.getPoll(pollId, guild.id);
    
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

    if (results.length === 0) {
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
      { name: '👤 Ersteller', value: `<@${poll.creatorId}>`, inline: true },
      { name: '📅 Erstellt', value: `<t:${Math.floor(poll.createdAt.getTime() / 1000)}:R>`, inline: true }
    );

    if (poll.endTime) {
      embed.addFields({
        name: '⏰ Endet/Endete',
        value: `<t:${Math.floor(poll.endTime.getTime() / 1000)}:R>`,
        inline: true
      });
    }

    embed.addFields({
      name: 'ℹ️ Einstellungen',
      value: `${poll.multiple ? '✅' : '❌'} Mehrfachauswahl\n${poll.anonymous ? '✅' : '❌'} Anonym\n${poll.active ? '🟢' : '🔴'} ${poll.active ? 'Aktiv' : 'Beendet'}`,
      inline: true
    });

    await interaction.editReply({ embeds: [embed] });

  } catch (error) {
    console.error('Fehler beim Laden der Umfrage-Ergebnisse:', error);
    await interaction.editReply({
      content: '❌ Ein Fehler ist aufgetreten beim Laden der Ergebnisse.',
    });
  }
}

export const options = {
  userPermissions: [],
  botPermissions: ['SendMessages', 'EmbedLinks'],
};