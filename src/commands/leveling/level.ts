import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  EmbedBuilder,
  AttachmentBuilder 
} from 'discord.js';
import { DatabaseService } from '../../lib/database';
import { createLevelCard, createLeaderboardCard } from '../../utils/levelCard';

export const data = new SlashCommandBuilder()
  .setName('level')
  .setDescription('Level System Befehle')
  .addSubcommand(subcommand =>
    subcommand
      .setName('show')
      .setDescription('Zeige dein Level oder das eines anderen Benutzers')
      .addUserOption(option =>
        option
          .setName('user')
          .setDescription('Der Benutzer dessen Level angezeigt werden soll')
          .setRequired(false)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('leaderboard')
      .setDescription('Zeige das Server Leaderboard')
      .addIntegerOption(option =>
        option
          .setName('limit')
          .setDescription('Anzahl der Benutzer (max 20)')
          .setMinValue(5)
          .setMaxValue(20)
          .setRequired(false)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('monthly')
      .setDescription('Zeige das monatliche Leaderboard')
      .addIntegerOption(option =>
        option
          .setName('month')
          .setDescription('Monat (1-12)')
          .setMinValue(1)
          .setMaxValue(12)
          .setRequired(false)
      )
      .addIntegerOption(option =>
        option
          .setName('year')
          .setDescription('Jahr')
          .setMinValue(2020)
          .setMaxValue(2030)
          .setRequired(false)
      )
  );

export async function run({ interaction }: { interaction: ChatInputCommandInteraction }) {
  const subcommand = interaction.options.getSubcommand();

  switch (subcommand) {
    case 'show':
      await handleShowLevel(interaction);
      break;
    case 'leaderboard':
      await handleLeaderboard(interaction);
      break;
    case 'monthly':
      await handleMonthlyLeaderboard(interaction);
      break;
  }
}

async function handleShowLevel(interaction: ChatInputCommandInteraction) {
  const targetUser = interaction.options.getUser('user') || interaction.user;
  const guild = interaction.guild!;

  await interaction.deferReply();

  try {
    // Guild-Einstellungen prüfen
    const guildSettings = await DatabaseService.getGuildSettings(guild.id);
    if (!guildSettings.enableLeveling) {
      return interaction.editReply({
        content: '❌ Das Level-System ist auf diesem Server deaktiviert.',
      });
    }

    // User Level abrufen
    const userLevel = await DatabaseService.getUserLevel(targetUser.id, guild.id);
    
    // Rang im Server berechnen
    const leaderboard = await DatabaseService.getLeaderboard(guild.id, 1000);
    const userRank = leaderboard.findIndex((u: { userId: string; }) => u.userId === targetUser.id) + 1;

    // Level Card erstellen
    const levelCard = await createLevelCard(userLevel, targetUser);
    
    // XP für aktuelles und nächstes Level
    const currentLevelXP = DatabaseService.calculateXPForLevel(userLevel.level);
    const nextLevelXP = DatabaseService.calculateXPForLevel(userLevel.level + 1);
    const progressXP = userLevel.xp - currentLevelXP;
    const neededXP = nextLevelXP - currentLevelXP;

    const embed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle(`📊 Level von ${targetUser.username}`)
      .addFields(
        { name: '🏆 Level', value: userLevel.level.toString(), inline: true },
        { name: '⭐ XP', value: `${progressXP} / ${neededXP}`, inline: true },
        { name: '📊 Rang', value: userRank > 0 ? `#${userRank}` : 'Unbekannt', inline: true },
        { name: '💬 Nachrichten', value: userLevel.messages.toLocaleString(), inline: true },
        { name: '🎤 Voice Zeit', value: formatVoiceTime(userLevel.voiceTime), inline: true },
        { name: '🌟 Gesamt XP', value: userLevel.xp.toLocaleString(), inline: true }
      )
      .setTimestamp();

    // Check if levelCard is a string or Buffer
    if (typeof levelCard === 'string') {
      embed.setDescription(levelCard);
      await interaction.editReply({ embeds: [embed] });
    } else {
      embed.setImage('attachment://level-card.png');
      const attachment = new AttachmentBuilder(levelCard, { name: 'level-card.png' });
      await interaction.editReply({
        embeds: [embed],
        files: [attachment],
      });
    }

  } catch (error) {
    console.error('Fehler beim Anzeigen des Levels:', error);
    await interaction.editReply({
      content: '❌ Ein Fehler ist aufgetreten beim Laden der Level-Daten.',
    });
  }
}

async function handleLeaderboard(interaction: ChatInputCommandInteraction) {
  const limit = interaction.options.getInteger('limit') || 10;
  const guild = interaction.guild!;

  await interaction.deferReply();

  try {
    const guildSettings = await DatabaseService.getGuildSettings(guild.id);
    if (!guildSettings.enableLeveling) {
      return interaction.editReply({
        content: '❌ Das Level-System ist auf diesem Server deaktiviert.',
      });
    }

    const leaderboard = await DatabaseService.getLeaderboard(guild.id, limit);

    if (leaderboard.length === 0) {
      return interaction.editReply({
        content: '📊 Noch keine Level-Daten vorhanden.',
      });
    }

    // Leaderboard Card erstellen
    const leaderboardCard = await createLeaderboardCard(leaderboard, guild.name);

    const embed = new EmbedBuilder()
      .setColor(0xffd700)
      .setTitle(`🏆 ${guild.name} Leaderboard`)
      .setDescription(`Top ${leaderboard.length} Benutzer`)
      .setTimestamp();

    // Top 3 als Felder hinzufügen
    leaderboard.slice(0, 3).forEach((user: { user: { username: any; }; level: any; xp: { toLocaleString: () => any; }; }, index: string | number) => {
      const medals = ['🥇', '🥈', '🥉'];
      embed.addFields({
        name: `${medals[index]} ${user.user.username}`,
        value: `Level ${user.level} • ${user.xp.toLocaleString()} XP`,
        inline: true,
      });
    });

    // Check if leaderboardCard is a string or Buffer
    if (typeof leaderboardCard === 'string') {
      embed.setDescription(`${embed.data.description}\n\n${leaderboardCard}`);
      await interaction.editReply({ embeds: [embed] });
    } else {
      embed.setImage('attachment://leaderboard.png');
      const attachment = new AttachmentBuilder(leaderboardCard, { name: 'leaderboard.png' });
      await interaction.editReply({
        embeds: [embed],
        files: [attachment],
      });
    }

  } catch (error) {
    console.error('Fehler beim Laden des Leaderboards:', error);
    await interaction.editReply({
      content: '❌ Ein Fehler ist aufgetreten beim Laden des Leaderboards.',
    });
  }
}

async function handleMonthlyLeaderboard(interaction: ChatInputCommandInteraction) {
  const now = new Date();
  const month = interaction.options.getInteger('month') || now.getMonth() + 1;
  const year = interaction.options.getInteger('year') || now.getFullYear();
  const guild = interaction.guild!;

  await interaction.deferReply();

  try {
    const guildSettings = await DatabaseService.getGuildSettings(guild.id);
    if (!guildSettings.enableLeveling) {
      return interaction.editReply({
        content: '❌ Das Level-System ist auf diesem Server deaktiviert.',
      });
    }

    const monthlyLeaderboard = await DatabaseService.getMonthlyLeaderboard(guild.id, month, year, 10);

    if (monthlyLeaderboard.length === 0) {
      return interaction.editReply({
        content: `📊 Keine Daten für ${getMonthName(month)} ${year} vorhanden.`,
      });
    }

    const embed = new EmbedBuilder()
      .setColor(0x9b59b6)
      .setTitle(`🏆 Monatliches Leaderboard - ${getMonthName(month)} ${year}`)
      .setDescription(`Top ${monthlyLeaderboard.length} Benutzer`)
      .setTimestamp();

    monthlyLeaderboard.forEach((entry, index) => {
      const medals = ['🥇', '🥈', '🥉'];
      const medal = index < 3 ? medals[index] : `#${index + 1}`;
      
      embed.addFields({
        name: `${medal} Benutzer ${entry.userId}`,
        value: `${entry.xpGained.toLocaleString()} XP • ${entry.messages} Nachrichten • ${formatVoiceTime(entry.voiceTime)} Voice`,
        inline: false,
      });
    });

    await interaction.editReply({ embeds: [embed] });

  } catch (error) {
    console.error('Fehler beim Laden des monatlichen Leaderboards:', error);
    await interaction.editReply({
      content: '❌ Ein Fehler ist aufgetreten beim Laden des monatlichen Leaderboards.',
    });
  }
}

function formatVoiceTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
}

function getMonthName(month: number): string {
  const months = [
    'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
    'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
  ];
  return months[month - 1];
}

export const options = {
  botPermissions: ['SendMessages', 'AttachFiles'],
};