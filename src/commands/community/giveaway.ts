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
  .setName('giveaway')
  .setDescription('Gewinnspiele verwalten')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
  .addSubcommand(subcommand =>
    subcommand
      .setName('create')
      .setDescription('Erstellt ein neues Gewinnspiel')
      .addStringOption(option =>
        option
          .setName('prize')
          .setDescription('Was wird verlost')
          .setRequired(true)
      )
      .addStringOption(option =>
        option
          .setName('title')
          .setDescription('Titel des Gewinnspiels')
          .setRequired(true)
      )
      .addIntegerOption(option =>
        option
          .setName('winners')
          .setDescription('Anzahl der Gewinner')
          .setRequired(true)
          .setMinValue(1)
          .setMaxValue(10)
      )
      .addIntegerOption(option =>
        option
          .setName('duration')
          .setDescription('Dauer in Stunden')
          .setRequired(true)
          .setMinValue(1)
          .setMaxValue(720) // 30 Tage Maximum
      )
      .addStringOption(option =>
        option
          .setName('description')
          .setDescription('Beschreibung des Gewinnspiels')
          .setRequired(false)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('end')
      .setDescription('Beendet ein Gewinnspiel vorzeitig')
      .addIntegerOption(option =>
        option
          .setName('id')
          .setDescription('ID des Gewinnspiels')
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('reroll')
      .setDescription('Wählt neue Gewinner aus')
      .addIntegerOption(option =>
        option
          .setName('id')
          .setDescription('ID des Gewinnspiels')
          .setRequired(true)
      )
      .addIntegerOption(option =>
        option
          .setName('winners')
          .setDescription('Anzahl der neuen Gewinner')
          .setRequired(true)
          .setMinValue(1)
          .setMaxValue(10)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('list')
      .setDescription('Zeigt alle aktiven Gewinnspiele an')
  );

export async function run({ interaction }: { interaction: ChatInputCommandInteraction }) {
  const subcommand = interaction.options.getSubcommand();

  // Prüfe ob Giveaways aktiviert sind
  const guildSettings = await DatabaseService.getGuildSettings(interaction.guild!.id);
  if (!guildSettings.enableGiveaways) {
    return interaction.reply({
      content: '❌ Gewinnspiele sind auf diesem Server deaktiviert.',
      ephemeral: true,
    });
  }

  switch (subcommand) {
    case 'create':
      await handleCreateGiveaway(interaction);
      break;
    case 'end':
      await handleEndGiveaway(interaction);
      break;
    case 'reroll':
      await handleRerollGiveaway(interaction);
      break;
    case 'list':
      await handleListGiveaways(interaction);
      break;
  }
}

async function handleCreateGiveaway(interaction: ChatInputCommandInteraction) {
  const prize = interaction.options.getString('prize', true);
  const title = interaction.options.getString('title', true);
  const winnersCount = interaction.options.getInteger('winners', true);
  const duration = interaction.options.getInteger('duration', true);
  const description = interaction.options.getString('description');
  
  await interaction.deferReply();

  try {
    // Endzeit berechnen
    const endTime = new Date();
    endTime.setHours(endTime.getHours() + duration);

    // Gewinnspiel erstellen
    const giveaway = await DatabaseService.createGiveaway({
      guildId: interaction.guild!.id,
      channelId: interaction.channel!.id,
      title,
      description: description || undefined,
      prize,
      winners: winnersCount,
      creatorId: interaction.user.id,
      endTime
    });

    // Embed erstellen
    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle(`🎉 ${title}`)
      .setDescription(`**Preis:** ${prize}`)
      .addFields(
        { name: '🏆 Gewinner', value: `${winnersCount}`, inline: true },
        { name: '👥 Teilnehmer', value: '0', inline: true },
        { name: '⏰ Endet', value: `<t:${Math.floor(endTime.getTime() / 1000)}:R>`, inline: true }
      )
      .setFooter({ text: `Giveaway ID: ${giveaway.id} • Erstellt von ${interaction.user.tag}` })
      .setTimestamp();

    if (description) {
      embed.addFields({ name: '📝 Beschreibung', value: description, inline: false });
    }

    // Button für Teilnahme erstellen
    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`giveaway_join_${giveaway.id}`)
          .setLabel('🎁 Teilnehmen')
          .setStyle(ButtonStyle.Success)
      );

    // Nachricht senden
    const message = await interaction.editReply({
      content: '🎉 **GIVEAWAY GESTARTET** 🎉',
      embeds: [embed],
      components: [row]
    });

    // Message-ID in Datenbank speichern
    if ('id' in message) {
      await DatabaseService.updateGiveaway(giveaway.id, {
        messageId: message.id
      });
    }

  } catch (error) {
    console.error('Fehler beim Erstellen des Gewinnspiels:', error);
    await interaction.editReply('❌ Es ist ein Fehler aufgetreten. Bitte versuche es erneut.');
  }
}

async function handleEndGiveaway(interaction: ChatInputCommandInteraction) {
  const giveawayId = interaction.options.getInteger('id', true);
  
  await interaction.deferReply();

  try {
    // Giveaway abrufen und überprüfen
    const giveaway = await DatabaseService.getGiveaway(giveawayId, interaction.guild!.id);
    
    if (!giveaway) {
      return interaction.editReply('❌ Gewinnspiel mit dieser ID nicht gefunden.');
    }
    
    if (giveaway.ended) {
      return interaction.editReply('❌ Dieses Gewinnspiel ist bereits beendet.');
    }

    // Giveaway beenden
    await DatabaseService.endGiveaway(giveawayId);

    // Gewinner ziehen
    const winners = await DatabaseService.drawGiveawayWinners(giveawayId);

    // Ergebnis-Embed erstellen
    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle(`🎉 Gewinnspiel beendet: ${giveaway.title}`)
      .setDescription(`**Preis:** ${giveaway.prize}`)
      .setTimestamp();

    if (winners.length > 0) {
      embed.addFields({
        name: '🏆 Gewinner',
        value: winners.map((winner: { userId: string }) => `<@${winner.userId}>`).join('\n'),
        inline: false
      });
      
      embed.addFields({
        name: '📊 Statistiken',
        value: `Teilnehmer: ${giveaway.entries?.length || 0}\nGewinner: ${winners.length}`,
        inline: true
      });

      // Gewinner benachrichtigen
      for (const winner of winners) {
        try {
          const user = await interaction.client.users.fetch(winner.userId);
          const guild = interaction.guild!;
          
          const dmEmbed = new EmbedBuilder()
            .setColor(0x00ff00)
            .setTitle('🎉 Glückwunsch!')
            .setDescription(`Du hast das Gewinnspiel **${giveaway.title}** auf **${guild.name}** gewonnen!`)
            .addFields({
              name: '🎁 Gewinn',
              value: giveaway.prize,
              inline: true
            })
            .setTimestamp();

          await user.send({ embeds: [dmEmbed] }).catch(() => {
            // Ignorieren, falls DMs deaktiviert sind
          });
        } catch (error) {
          console.error(`Fehler beim Benachrichtigen von Gewinner ${winner.userId}:`, error);
        }
      }

    } else {
      embed.addFields({
        name: '😔 Keine Gewinner',
        value: 'Es gab nicht genügend gültige Teilnehmer.',
        inline: false
      });
    }

    // Antwort senden
    await interaction.editReply({ embeds: [embed] });

    // Original Giveaway-Nachricht aktualisieren, falls vorhanden
    if (giveaway.messageId) {
      try {
        const channel = await interaction.guild!.channels.fetch(giveaway.channelId);
        if (channel && channel.isTextBased()) {
          const message = await channel.messages.fetch(giveaway.messageId);
          
          if (message) {
            const originalEmbed = EmbedBuilder.from(message.embeds[0])
              .setColor(0x95a5a6)
              .setTitle(`🎉 ${giveaway.title} [BEENDET]`);

            if (winners.length > 0) {
              originalEmbed.addFields({
                name: '🏆 Gewinner',
                value: winners.map((winner: { userId: string }) => `<@${winner.userId}>`).join('\n'),
                inline: false
              });
            }
            
            await message.edit({
              content: '🎉 **GIVEAWAY BEENDET** 🎉',
              embeds: [originalEmbed],
              components: []  // Entferne alle Buttons
            });
          }
        }
      } catch (error) {
        console.error('Fehler beim Aktualisieren der Giveaway-Nachricht:', error);
        // Fehler ignorieren, Hauptaktion wurde ausgeführt
      }
    }

  } catch (error) {
    console.error('Fehler beim Beenden des Gewinnspiels:', error);
    await interaction.editReply('❌ Es ist ein Fehler aufgetreten. Bitte versuche es erneut.');
  }
}

async function handleRerollGiveaway(interaction: ChatInputCommandInteraction) {
  const giveawayId = interaction.options.getInteger('id', true);
  const newWinnersCount = interaction.options.getInteger('winners', true);
  
  await interaction.deferReply();

  try {
    // Giveaway abrufen und überprüfen
    const giveaway = await DatabaseService.getGiveaway(giveawayId, interaction.guild!.id);
    
    if (!giveaway) {
      return interaction.editReply('❌ Gewinnspiel mit dieser ID nicht gefunden.');
    }
    
    if (!giveaway.ended) {
      return interaction.editReply('❌ Dieses Gewinnspiel ist noch nicht beendet. Benutze `/giveaway end` zuerst.');
    }

    // Neue Gewinner ziehen
    const winners = await DatabaseService.rerollGiveaway(giveawayId, newWinnersCount);

    // Ergebnis-Embed erstellen
    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle(`🎲 Gewinnspiel neu ausgelost: ${giveaway.title}`)
      .setDescription(`**Preis:** ${giveaway.prize}`)
      .setTimestamp();

    if (winners.length > 0) {
      embed.addFields({
        name: '🏆 Neue Gewinner',
        value: winners.map((winner: { userId: string }) => `<@${winner.userId}>`).join('\n'),
        inline: false
      });
      
      embed.addFields({
        name: '📊 Statistiken',
        value: `Teilnehmer: ${giveaway.entries?.length || 0}\nNeue Gewinner: ${winners.length}`,
        inline: true
      });

      // Gewinner benachrichtigen
      for (const winner of winners) {
        try {
          const user = await interaction.client.users.fetch(winner.userId);
          const guild = interaction.guild!;
          
          const dmEmbed = new EmbedBuilder()
            .setColor(0x00ff00)
            .setTitle('🎉 Glückwunsch!')
            .setDescription(`Du hast bei der Neuauslosung des Gewinnspiels **${giveaway.title}** auf **${guild.name}** gewonnen!`)
            .addFields({
              name: '🎁 Gewinn',
              value: giveaway.prize,
              inline: true
            })
            .setTimestamp();

          await user.send({ embeds: [dmEmbed] }).catch(() => {
            // Ignorieren, falls DMs deaktiviert sind
          });
        } catch (error) {
          console.error(`Fehler beim Benachrichtigen von Gewinner ${winner.userId}:`, error);
        }
      }

    } else {
      embed.addFields({
        name: '😔 Keine Gewinner',
        value: 'Es gab nicht genügend gültige Teilnehmer für eine Neuauslosung.',
        inline: false
      });
    }

    // Antwort senden
    await interaction.editReply({ embeds: [embed] });

    // Original Giveaway-Nachricht aktualisieren, falls vorhanden
    if (giveaway.messageId) {
      try {
        const channel = await interaction.guild!.channels.fetch(giveaway.channelId);
        if (channel && channel.isTextBased()) {
          const message = await channel.messages.fetch(giveaway.messageId);
          
          if (message) {
            const originalEmbed = EmbedBuilder.from(message.embeds[0]);

            // Update Gewinner-Feld falls vorhanden
            const fields = originalEmbed.data.fields || [];
            const updatedFields = fields.filter(field => field.name !== '🏆 Gewinner');
            
            if (winners.length > 0) {
              updatedFields.push({
                name: '🏆 Gewinner (Neu ausgelost)',
                value: winners.map((winner: { userId: string }) => `<@${winner.userId}>`).join('\n'),
                inline: false
              });
            }
            
            originalEmbed.setFields(updatedFields);
            
            await message.edit({
              embeds: [originalEmbed]
            });
          }
        }
      } catch (error) {
        console.error('Fehler beim Aktualisieren der Giveaway-Nachricht:', error);
        // Fehler ignorieren, Hauptaktion wurde ausgeführt
      }
    }

  } catch (error) {
    console.error('Fehler beim Neuauslosen des Gewinnspiels:', error);
    await interaction.editReply('❌ Es ist ein Fehler aufgetreten. Bitte versuche es erneut.');
  }
}

async function handleListGiveaways(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  try {
    // Aktive Giveaways abrufen
    const activeGiveaways = await DatabaseService.getActiveGiveaways(interaction.guild!.id);

    if (activeGiveaways.length === 0) {
      return interaction.editReply('❌ Keine aktiven Gewinnspiele gefunden.');
    }

    // Embed erstellen
    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle('🎉 Aktive Gewinnspiele')
      .setDescription(`Es gibt ${activeGiveaways.length} aktive Gewinnspiel(e) auf diesem Server.`)
      .setTimestamp();

    // Gewinnspiele hinzufügen
    for (const giveaway of activeGiveaways) {
      let fieldValue = '';
      
      // Link zur Nachricht hinzufügen, falls vorhanden
      if (giveaway.messageId) {
        fieldValue += `[Zum Gewinnspiel springen](https://discord.com/channels/${interaction.guild!.id}/${giveaway.channelId}/${giveaway.messageId})\n`;
      }
      
      // Ersteller hinzufügen
      fieldValue += `👤 Ersteller: <@${giveaway.creatorId}>\n`;
      
      // Preis hinzufügen
      fieldValue += `🎁 Preis: ${giveaway.prize}\n`;
      
      // Gewinner und Teilnehmer
      fieldValue += `🏆 Gewinner: ${giveaway.winners} | 👥 Teilnehmer: ${giveaway.entries?.length || 0}\n`;
      
      // Endzeitpunkt hinzufügen
      fieldValue += `⏰ Endet: <t:${Math.floor(giveaway.endTime.getTime() / 1000)}:R>`;

      embed.addFields({
        name: `ID ${giveaway.id}: ${giveaway.title}`,
        value: fieldValue,
        inline: false
      });
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Fehler beim Auflisten der Gewinnspiele:', error);
    await interaction.editReply('❌ Es ist ein Fehler aufgetreten. Bitte versuche es erneut.');
  }
} 