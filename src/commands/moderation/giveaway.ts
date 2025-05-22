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
  .setDescription('Giveaway-System')
  .addSubcommand(subcommand =>
    subcommand
      .setName('create')
      .setDescription('Ein neues Giveaway erstellen')
      .addStringOption(option =>
        option
          .setName('prize')
          .setDescription('Was wird verlost?')
          .setRequired(true)
      )
      .addIntegerOption(option =>
        option
          .setName('duration')
          .setDescription('Dauer in Minuten')
          .setMinValue(1)
          .setMaxValue(43200) // 30 Tage
          .setRequired(true)
      )
      .addIntegerOption(option =>
        option
          .setName('winners')
          .setDescription('Anzahl der Gewinner')
          .setMinValue(1)
          .setMaxValue(20)
          .setRequired(true)
      )
      .addStringOption(option =>
        option
          .setName('title')
          .setDescription('Titel des Giveaways')
          .setRequired(false)
      )
      .addStringOption(option =>
        option
          .setName('description')
          .setDescription('Beschreibung des Giveaways')
          .setRequired(false)
      )
      .addRoleOption(option =>
        option
          .setName('required_role')
          .setDescription('Erforderliche Rolle für Teilnahme')
          .setRequired(false)
      )
      .addIntegerOption(option =>
        option
          .setName('min_level')
          .setDescription('Mindest-Level für Teilnahme')
          .setMinValue(0)
          .setMaxValue(100)
          .setRequired(false)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('end')
      .setDescription('Ein Giveaway beenden')
      .addIntegerOption(option =>
        option
          .setName('id')
          .setDescription('Giveaway-ID')
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('reroll')
      .setDescription('Neue Gewinner auslosen')
      .addIntegerOption(option =>
        option
          .setName('id')
          .setDescription('Giveaway-ID')
          .setRequired(true)
      )
      .addIntegerOption(option =>
        option
          .setName('winners')
          .setDescription('Anzahl neuer Gewinner')
          .setMinValue(1)
          .setMaxValue(10)
          .setRequired(false)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('list')
      .setDescription('Aktive Giveaways anzeigen')
  );

export async function run({ interaction }: { interaction: ChatInputCommandInteraction }) {
  const subcommand = interaction.options.getSubcommand();

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
  const duration = interaction.options.getInteger('duration', true);
  const winners = interaction.options.getInteger('winners', true);
  const title = interaction.options.getString('title') || `🎉 Giveaway: ${prize}`;
  const description = interaction.options.getString('description');
  const requiredRole = interaction.options.getRole('required_role');
  const minLevel = interaction.options.getInteger('min_level');
  const guild = interaction.guild!;

  // Berechtigung prüfen
  const member = interaction.member as any;
  if (!member.permissions.has(PermissionFlagsBits.ManageEvents)) {
    return interaction.reply({
      content: '❌ Du benötigst die "Events verwalten" Berechtigung.',
      ephemeral: true,
    });
  }

  await interaction.deferReply();

  try {
    // Guild Settings prüfen
    const guildSettings = await DatabaseService.getGuildSettings(guild.id);
    if (!guildSettings.enableGiveaways) {
      return interaction.editReply({
        content: '❌ Das Giveaway-System ist auf diesem Server deaktiviert.',
      });
    }

    // Endzeit berechnen
    const endTime = new Date(Date.now() + duration * 60 * 1000);

    // Requirements für Giveaway
    const requirements: any = {};
    if (requiredRole) {
      requirements.requiredRole = requiredRole.id;
    }
    if (minLevel) {
      requirements.minLevel = minLevel;
    }

    // Giveaway in Datenbank erstellen
    const giveaway = await DatabaseService.createGiveaway({
      guildId: guild.id,
      channelId: interaction.channelId,
      title,
      description,
      prize,
      winners,
      creatorId: interaction.user.id,
      endTime,
      requirements: Object.keys(requirements).length > 0 ? requirements : null
    });

    // Embed erstellen
    const embed = new EmbedBuilder()
      .setColor(0xff6b35)
      .setTitle(title)
      .setDescription(description || `Gewinne **${prize}**!`)
      .addFields(
        { name: '🎁 Preis', value: prize, inline: true },
        { name: '👑 Gewinner', value: winners.toString(), inline: true },
        { name: '⏰ Endet', value: `<t:${Math.floor(endTime.getTime() / 1000)}:R>`, inline: true },
        { name: '🎯 Teilnehmer', value: '0', inline: true }
      )
      .setFooter({ text: `Giveaway-ID: ${giveaway.id}` })
      .setTimestamp(endTime);

    // Requirements anzeigen
    if (Object.keys(requirements).length > 0) {
      let reqText = '';
      if (requirements.requiredRole) {
        reqText += `• Rolle: <@&${requirements.requiredRole}>\n`;
      }
      if (requirements.minLevel) {
        reqText += `• Mindest-Level: ${requirements.minLevel}\n`;
      }
      
      embed.addFields({
        name: '📋 Teilnahme-Voraussetzungen',
        value: reqText,
        inline: false
      });
    }

    // Button für Teilnahme
    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`giveaway_join_${giveaway.id}`)
          .setLabel('🎉 Teilnehmen')
          .setStyle(ButtonStyle.Success)
          .setEmoji('🎉')
      );

    const message = await interaction.editReply({
      embeds: [embed],
      components: [row]
    });

    // Message ID in Datenbank speichern
    await DatabaseService.updateGiveaway(giveaway.id, { messageId: message.id });

  } catch (error) {
    console.error('Fehler beim Erstellen des Giveaways:', error);
    await interaction.editReply({
      content: '❌ Ein Fehler ist aufgetreten beim Erstellen des Giveaways.',
    });
  }
}

async function handleEndGiveaway(interaction: ChatInputCommandInteraction) {
  const giveawayId = interaction.options.getInteger('id', true);
  const guild = interaction.guild!;

  // Berechtigung prüfen
  const member = interaction.member as any;
  if (!member.permissions.has(PermissionFlagsBits.ManageEvents)) {
    return interaction.reply({
      content: '❌ Du benötigst die "Events verwalten" Berechtigung.',
      ephemeral: true,
    });
  }

  await interaction.deferReply();

  try {
    const giveaway = await DatabaseService.getGiveaway(giveawayId, guild.id);
    
    if (!giveaway) {
      return interaction.editReply({
        content: '❌ Giveaway nicht gefunden.',
      });
    }

    if (giveaway.ended) {
      return interaction.editReply({
        content: '❌ Dieses Giveaway ist bereits beendet.',
      });
    }

    // Gewinner auslosen
    const winners = await DatabaseService.drawGiveawayWinners(giveawayId);
    
    // Giveaway beenden
    await DatabaseService.endGiveaway(giveawayId);

    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle('🎉 Giveaway beendet!')
      .setDescription(`Das Giveaway für **${giveaway.prize}** wurde beendet.`)
      .setTimestamp();

    if (winners.length > 0) {
      embed.addFields({
        name: '🏆 Gewinner',
        value: winners.map(winner => `<@${winner.userId}>`).join('\n'),
        inline: false
      });
      
      embed.addFields({
        name: '📊 Statistiken',
        value: `Teilnehmer: ${await DatabaseService.getGiveawayParticipants(giveawayId)}\nGewinner: ${winners.length}`,
        inline: true
      });
    } else {
      embed.addFields({
        name: '😔 Keine Gewinner',
        value: 'Es gab nicht genügend gültige Teilnehmer.',
        inline: false
      });
    }

    await interaction.editReply({ embeds: [embed] });

    // Gewinner benachrichtigen
    for (const winner of winners) {
      try {
        const user = await interaction.client.users.fetch(winner.userId);
        const dmEmbed = new EmbedBuilder()
          .setColor(0x00ff00)
          .setTitle('🎉 Glückwunsch!')
          .setDescription(`Du hast das Giveaway auf **${guild.name}** gewonnen!`)
          .addFields({
            name: '🎁 Gewinn',
            value: giveaway.prize,
            inline: true
          })
          .setTimestamp();

        await user.send({ embeds: [dmEmbed] });
      } catch (error) {
        console.error(`Fehler beim Benachrichtigen von Gewinner ${winner.userId}:`, error);
      }
    }

    // Original Giveaway Message aktualisieren
    if (giveaway.messageId && giveaway.channelId) {
      try {
        const channel = await interaction.guild!.channels.fetch(giveaway.channelId) as any;
        const message = await channel.messages.fetch(giveaway.messageId);
        
        const updatedEmbed = EmbedBuilder.from(message.embeds[0])
          .setColor(0x95a5a6)
          .setTitle(`${giveaway.title} [BEENDET]`);

        if (winners.length > 0) {
          updatedEmbed.addFields({
            name: '🏆 Gewinner',
            value: winners.map(winner => `<@${winner.userId}>`).join('\n'),
            inline: false
          });
        }
        
        await message.edit({
          embeds: [updatedEmbed],
          components: [] // Buttons entfernen
        });
      } catch (error) {
        console.error('Fehler beim Aktualisieren der Giveaway-Nachricht:', error);
      }
    }

  } catch (error) {
    console.error('Fehler beim Beenden des Giveaways:', error);
    await interaction.editReply({
      content: '❌ Ein Fehler ist aufgetreten beim Beenden des Giveaways.',
    });
  }
}

async function handleRerollGiveaway(interaction: ChatInputCommandInteraction) {
  const giveawayId = interaction.options.getInteger('id', true);
  const newWinners = interaction.options.getInteger('winners') || 1;
  const guild = interaction.guild!;

  // Berechtigung prüfen
  const member = interaction.member as any;
  if (!member.permissions.has(PermissionFlagsBits.ManageEvents)) {
    return interaction.reply({
      content: '❌ Du benötigst die "Events verwalten" Berechtigung.',
      ephemeral: true,
    });
  }

  await interaction.deferReply();

  try {
    const giveaway = await DatabaseService.getGiveaway(giveawayId, guild.id);
    
    if (!giveaway) {
      return interaction.editReply({
        content: '❌ Giveaway nicht gefunden.',
      });
    }

    if (!giveaway.ended) {
      return interaction.editReply({
        content: '❌ Das Giveaway ist noch nicht beendet.',
      });
    }

    // Neue Gewinner auslosen (ausgenommen bisherige Gewinner)
    const newWinnersList = await DatabaseService.rerollGiveaway(giveawayId, newWinners);

    const embed = new EmbedBuilder()
      .setColor(0xff6b35)
      .setTitle('🔄 Giveaway Reroll')
      .setDescription(`Neue Gewinner für **${giveaway.prize}** ausgelost!`)
      .setTimestamp();

    if (newWinnersList.length > 0) {
      embed.addFields({
        name: '🏆 Neue Gewinner',
        value: newWinnersList.map(winner => `<@${winner.userId}>`).join('\n'),
        inline: false
      });

      // Neue Gewinner benachrichtigen
      for (const winner of newWinnersList) {
        try {
          const user = await interaction.client.users.fetch(winner.userId);
          const dmEmbed = new EmbedBuilder()
            .setColor(0x00ff00)
            .setTitle('🎉 Glückwunsch!')
            .setDescription(`Du wurdest als neuer Gewinner für das Giveaway auf **${guild.name}** ausgelost!`)
            .addFields({
              name: '🎁 Gewinn',
              value: giveaway.prize,
              inline: true
            })
            .setTimestamp();

          await user.send({ embeds: [dmEmbed] });
        } catch (error) {
          console.error(`Fehler beim Benachrichtigen von neuem Gewinner ${winner.userId}:`, error);
        }
      }
    } else {
      embed.addFields({
        name: '😔 Keine neuen Gewinner',
        value: 'Es konnten keine neuen Gewinner gefunden werden.',
        inline: false
      });
    }

    await interaction.editReply({ embeds: [embed] });

  } catch (error) {
    console.error('Fehler beim Reroll des Giveaways:', error);
    await interaction.editReply({
      content: '❌ Ein Fehler ist aufgetreten beim Reroll des Giveaways.',
    });
  }
}

async function handleListGiveaways(interaction: ChatInputCommandInteraction) {
  const guild = interaction.guild!;

  await interaction.deferReply({ ephemeral: true });

  try {
    const giveaways = await DatabaseService.getActiveGiveaways(guild.id);

    if (giveaways.length === 0) {
      return interaction.editReply({
        content: '🎉 Keine aktiven Giveaways vorhanden.',
      });
    }

    const embed = new EmbedBuilder()
      .setColor(0xff6b35)
      .setTitle('🎉 Aktive Giveaways')
      .setDescription(`${giveaways.length} aktive Giveaway(s) gefunden`)
      .setTimestamp();

    giveaways.slice(0, 10).forEach((giveaway, index) => {
      const endTime = `<t:${Math.floor(giveaway.endTime.getTime() / 1000)}:R>`;
      embed.addFields({
        name: `${index + 1}. ${giveaway.title}`,
        value: `**ID:** ${giveaway.id}\n**Preis:** ${giveaway.prize}\n**Kanal:** <#${giveaway.channelId}>\n**Endet:** ${endTime}\n**Gewinner:** ${giveaway.winners}`,
        inline: true
      });
    });

    await interaction.editReply({ embeds: [embed] });

  } catch (error) {
    console.error('Fehler beim Laden der Giveaways:', error);
    await interaction.editReply({
      content: '❌ Ein Fehler ist aufgetreten beim Laden der Giveaways.',
    });
  }
}

export const options = {
  userPermissions: [PermissionFlagsBits.ManageEvents],
  botPermissions: ['SendMessages', 'EmbedLinks'],
};