import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} from 'discord.js';
import { DatabaseService } from '../../lib/database';

export const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription('Zeigt Hilfe zu allen Bot-Funktionen an')
  .addStringOption(option =>
    option
      .setName('category')
      .setDescription('Kategorie der Hilfe')
      .setRequired(false)
      .addChoices(
        { name: '🛡️ Moderation', value: 'moderation' },
        { name: '🎮 Community', value: 'community' },
        { name: '💰 Geizhals', value: 'geizhals' },
        { name: '📊 Level System', value: 'level' },
        { name: '🎫 Tickets', value: 'tickets' },
        { name: '🔧 Utility', value: 'utility' }
      )
  );

export async function run({ interaction }: { interaction: ChatInputCommandInteraction }) {
  const category = interaction.options.getString('category');
  const guild = interaction.guild!;

  // Guild-Einstellungen abrufen
  const guildSettings = await DatabaseService.getGuildSettings(guild.id);

  if (category) {
    // Spezifische Kategorie anzeigen
    await showCategoryHelp(interaction, category, guildSettings);
  } else {
    // Übersicht anzeigen
    await showOverview(interaction, guildSettings);
  }
}

async function showOverview(interaction: ChatInputCommandInteraction, guildSettings: any) {
  const embed = new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle('📚 Hinko Bot - Hilfe')
    .setDescription('Hier findest du eine Übersicht aller Bot-Features und ihre Befehle.\nWähle eine Kategorie für detaillierte Informationen mit `/help [kategorie]`.')
    .addFields(
      {
        name: '🛡️ Moderation',
        value: '`/warn`, `/quarantine`, `/automod`',
        inline: true
      },
      {
        name: '🎮 Community',
        value: '`/poll`, `/giveaway`',
        inline: true
      },
      {
        name: '📊 Level System',
        value: '`/level`, `/rank`',
        inline: true
      },
      {
        name: '💰 Geizhals',
        value: '`/geizhals`',
        inline: true
      },
      {
        name: '🎫 Tickets',
        value: '`/ticket`',
        inline: true
      },
      {
        name: '🔧 Utility',
        value: '`/joinToCreate`, `/help`',
        inline: true
      }
    )
    .setFooter({ text: 'Tipp: Benutze /help [kategorie] für mehr Informationen' });

  // Status der Funktionen anzeigen
  let statusText = '';
  statusText += `🛡️ Moderation: ${guildSettings.enableModeration ? '✅' : '❌'}\n`;
  statusText += `📊 Level System: ${guildSettings.enableLeveling ? '✅' : '❌'}\n`;
  statusText += `💰 Geizhals: ${guildSettings.enableGeizhals ? '✅' : '❌'}\n`;
  statusText += `📊 Polls: ${guildSettings.enablePolls ? '✅' : '❌'}\n`;
  statusText += `🎉 Giveaways: ${guildSettings.enableGiveaways ? '✅' : '❌'}\n`;
  statusText += `🤖 Automod: ${guildSettings.enableAutomod ? '✅' : '❌'}\n`;
  statusText += `🎫 Tickets: ${guildSettings.enableTickets ? '✅' : '❌'}\n`;
  statusText += `🔊 Join to Create: ${guildSettings.enableJoinToCreate ? '✅' : '❌'}`;

  embed.addFields({ name: '🔌 Aktivierte Features', value: statusText });

  // Buttons für jede Kategorie
  const row1 = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('help_moderation')
        .setLabel('🛡️ Moderation')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('help_community')
        .setLabel('🎮 Community')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('help_level')
        .setLabel('📊 Level System')
        .setStyle(ButtonStyle.Primary)
    );

  const row2 = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('help_geizhals')
        .setLabel('💰 Geizhals')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('help_tickets')
        .setLabel('🎫 Tickets')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('help_utility')
        .setLabel('🔧 Utility')
        .setStyle(ButtonStyle.Primary)
    );

  await interaction.reply({ embeds: [embed], components: [row1, row2] });
}

async function showCategoryHelp(interaction: ChatInputCommandInteraction, category: string, guildSettings: any) {
  const embed = new EmbedBuilder()
    .setTimestamp()
    .setFooter({ text: 'Hinko Bot Help' });

  switch (category) {
    case 'moderation':
      embed
        .setColor(0xff3333)
        .setTitle('🛡️ Moderation-Befehle')
        .setDescription('Befehle zur Moderation deines Servers')
        .addFields(
          {
            name: '/warn add <user> <reason>',
            value: 'Verwarnt einen Benutzer',
            inline: false
          },
          {
            name: '/warn list <user>',
            value: 'Zeigt alle Verwarnungen eines Benutzers an',
            inline: false
          },
          {
            name: '/warn remove <id>',
            value: 'Entfernt eine Verwarnung',
            inline: false
          },
          {
            name: '/warn clear <user>',
            value: 'Entfernt alle Verwarnungen eines Benutzers',
            inline: false
          },
          {
            name: '/quarantine setup <role>',
            value: 'Richtet das Quarantäne-System ein',
            inline: false
          },
          {
            name: '/quarantine user <user> <reason>',
            value: 'Setzt einen Benutzer unter Quarantäne',
            inline: false
          },
          {
            name: '/quarantine channel <channel> <reason>',
            value: 'Setzt einen Channel unter Quarantäne',
            inline: false
          },
          {
            name: '/quarantine list',
            value: 'Zeigt alle aktiven Quarantäne-Einträge an',
            inline: false
          },
          {
            name: '/quarantine release <id>',
            value: 'Hebt eine Quarantäne auf',
            inline: false
          },
          {
            name: '/automod setup',
            value: 'Richtet das Automod-System ein',
            inline: false
          }
        );
      break;

    case 'community':
      embed
        .setColor(0x00ff00)
        .setTitle('🎮 Community-Befehle')
        .setDescription('Befehle für Community-Interaktionen')
        .addFields(
          {
            name: '/poll create <title> <options>',
            value: 'Erstellt eine Umfrage',
            inline: false
          },
          {
            name: '/poll end <id>',
            value: 'Beendet eine Umfrage vorzeitig',
            inline: false
          },
          {
            name: '/giveaway create <prize> <duration> <winners>',
            value: 'Erstellt ein Gewinnspiel',
            inline: false
          },
          {
            name: '/giveaway end <id>',
            value: 'Beendet ein Gewinnspiel vorzeitig',
            inline: false
          },
          {
            name: '/giveaway reroll <id> <winners>',
            value: 'Wählt neue Gewinner aus',
            inline: false
          }
        );
      break;

    case 'level':
      embed
        .setColor(0xff9900)
        .setTitle('📊 Level System-Befehle')
        .setDescription('Befehle für das Level-System')
        .addFields(
          {
            name: '/level show [user]',
            value: 'Zeigt das Level eines Benutzers an',
            inline: false
          },
          {
            name: '/level leaderboard [limit]',
            value: 'Zeigt die Server-Rangliste an',
            inline: false
          },
          {
            name: '/level monthly [month] [year]',
            value: 'Zeigt die monatliche Rangliste an',
            inline: false
          },
          {
            name: '/level rewards',
            value: 'Zeigt alle Level-Belohnungen an',
            inline: false
          },
          {
            name: '/level rewards add <level> <role> [description]',
            value: 'Fügt eine neue Level-Belohnung hinzu (nur Admin)',
            inline: false
          },
          {
            name: '/level rewards remove <level>',
            value: 'Entfernt eine Level-Belohnung (nur Admin)',
            inline: false
          }
        );
      break;

    case 'geizhals':
      embed
        .setColor(0x9b59b6)
        .setTitle('💰 Geizhals-Befehle')
        .setDescription('Befehle für die Geizhals-Integration')
        .addFields(
          {
            name: '/geizhals search <query> [category]',
            value: 'Sucht nach Produkten',
            inline: false
          },
          {
            name: '/geizhals track <productid> <targetprice>',
            value: 'Verfolgt den Preis eines Produkts',
            inline: false
          },
          {
            name: '/geizhals list',
            value: 'Zeigt alle deine Preis-Tracker an',
            inline: false
          },
          {
            name: '/geizhals deals [category]',
            value: 'Zeigt aktuelle Deals an',
            inline: false
          },
          {
            name: '/geizhals setup <channel>',
            value: 'Richtet das Geizhals-System ein (nur Admin)',
            inline: false
          },
          {
            name: '/geizhals remove <id>',
            value: 'Entfernt einen Preis-Tracker',
            inline: false
          }
        );
      break;

    case 'tickets':
      embed
        .setColor(0xe74c3c)
        .setTitle('🎫 Ticket-Befehle')
        .setDescription('Befehle für das Ticket-System')
        .addFields(
          {
            name: '/ticket setup <category> <channel>',
            value: 'Richtet das Ticket-System ein',
            inline: false
          },
          {
            name: '/ticket category <action> [name] [description] [emoji]',
            value: 'Verwaltet Ticket-Kategorien',
            inline: false
          },
          {
            name: '/ticket panel [channel]',
            value: 'Erstellt ein Ticket-Panel',
            inline: false
          },
          {
            name: '/ticket close [reason]',
            value: 'Schließt ein Ticket',
            inline: false
          },
          {
            name: '/ticket add <user>',
            value: 'Fügt einen Benutzer zum Ticket hinzu',
            inline: false
          },
          {
            name: '/ticket remove <user>',
            value: 'Entfernt einen Benutzer aus dem Ticket',
            inline: false
          },
          {
            name: '/ticket claim',
            value: 'Übernimmt ein Ticket',
            inline: false
          },
          {
            name: '/ticket priority <level>',
            value: 'Ändert die Priorität eines Tickets',
            inline: false
          }
        );
      break;

    case 'utility':
      embed
        .setColor(0x3498db)
        .setTitle('🔧 Utility-Befehle')
        .setDescription('Nützliche Befehle')
        .addFields(
          {
            name: '/help [category]',
            value: 'Zeigt diese Hilfe an',
            inline: false
          },
          {
            name: '/joinToCreate setup <category> <channel>',
            value: 'Richtet das Join-to-Create Voice System ein',
            inline: false
          },
          {
            name: '/joinToCreate limit <limit>',
            value: 'Setzt ein Limit für deinen Voice-Channel',
            inline: false
          },
          {
            name: '/joinToCreate kick <user>',
            value: 'Kickt einen Benutzer aus deinem Voice-Channel',
            inline: false
          },
          {
            name: '/joinToCreate lock',
            value: 'Sperrt deinen Voice-Channel',
            inline: false
          },
          {
            name: '/joinToCreate unlock',
            value: 'Entsperrt deinen Voice-Channel',
            inline: false
          }
        );
      break;

    default:
      // Sollte nicht vorkommen, da wir die Optionen eingeschränkt haben
      return interaction.reply('❌ Ungültige Kategorie. Benutze `/help` für eine Übersicht.');
  }

  await interaction.reply({ embeds: [embed] });
} 