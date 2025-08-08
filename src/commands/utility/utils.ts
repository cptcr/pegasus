import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  User,
  Role,
  ChannelType,
  MessageFlags,
} from 'discord.js';
import { Command, CommandCategory } from '../../types/command';
import { t, getGuildLocale } from '../../i18n';
// import { SteamService } from '../../services/steamService';
import { SteamService } from '../../services/steamServiceMock';
import { HelpService } from '../../services/helpService';
import { logger } from '../../utils/logger';
import * as os from 'os';
import { version as djsVersion } from 'discord.js';

// const steamService = new SteamService();
const helpService = new HelpService();

export const data = new SlashCommandBuilder()
  .setName('utils')
  .setDescription('Utility commands for various information')
  .setDescriptionLocalizations({
    'es-ES': 'Comandos de utilidad para obtener información variada',
    fr: 'Commandes utilitaires pour diverses informations',
    de: 'Utility-Befehle für verschiedene Informationen',
  })
  .addSubcommand(subcommand =>
    subcommand
      .setName('avatar')
      .setDescription("Get a user's avatar")
      .setDescriptionLocalizations({
        'es-ES': 'Obtener el avatar de un usuario',
        fr: "Obtenir l'avatar d'un utilisateur",
        de: 'Avatar eines Benutzers abrufen',
      })
      .addUserOption(option =>
        option
          .setName('user')
          .setDescription('The user to get avatar for')
          .setDescriptionLocalizations({
            'es-ES': 'El usuario del que obtener el avatar',
            fr: "L'utilisateur dont obtenir l'avatar",
            de: 'Der Benutzer, dessen Avatar abgerufen werden soll',
          })
          .setRequired(false)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('banner')
      .setDescription("Get a user's banner")
      .setDescriptionLocalizations({
        'es-ES': 'Obtener el banner de un usuario',
        fr: "Obtenir la bannière d'un utilisateur",
        de: 'Banner eines Benutzers abrufen',
      })
      .addUserOption(option =>
        option
          .setName('user')
          .setDescription('The user to get banner for')
          .setDescriptionLocalizations({
            'es-ES': 'El usuario del que obtener el banner',
            fr: "L'utilisateur dont obtenir la bannière",
            de: 'Der Benutzer, dessen Banner abgerufen werden soll',
          })
          .setRequired(false)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('steam')
      .setDescription('Get Steam profile information')
      .setDescriptionLocalizations({
        'es-ES': 'Obtener información del perfil de Steam',
        fr: 'Obtenir les informations du profil Steam',
        de: 'Steam-Profilinformationen abrufen',
      })
      .addStringOption(option =>
        option
          .setName('username')
          .setDescription('Steam username or profile URL')
          .setDescriptionLocalizations({
            'es-ES': 'Nombre de usuario o URL del perfil de Steam',
            fr: "Nom d'utilisateur ou URL du profil Steam",
            de: 'Steam-Benutzername oder Profil-URL',
          })
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('userinfo')
      .setDescription('Get detailed user information')
      .setDescriptionLocalizations({
        'es-ES': 'Obtener información detallada del usuario',
        fr: "Obtenir des informations détaillées sur l'utilisateur",
        de: 'Detaillierte Benutzerinformationen abrufen',
      })
      .addUserOption(option =>
        option
          .setName('user')
          .setDescription('The user to get information for')
          .setDescriptionLocalizations({
            'es-ES': 'El usuario del que obtener información',
            fr: "L'utilisateur dont obtenir les informations",
            de: 'Der Benutzer, für den Informationen abgerufen werden sollen',
          })
          .setRequired(false)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('whois')
      .setDescription('Look up user by ID')
      .setDescriptionLocalizations({
        'es-ES': 'Buscar usuario por ID',
        fr: 'Rechercher un utilisateur par ID',
        de: 'Benutzer nach ID suchen',
      })
      .addStringOption(option =>
        option
          .setName('user_id')
          .setDescription('The user ID to look up')
          .setDescriptionLocalizations({
            'es-ES': 'El ID de usuario a buscar',
            fr: "L'ID utilisateur à rechercher",
            de: 'Die zu suchende Benutzer-ID',
          })
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('roleinfo')
      .setDescription('Get role information')
      .setDescriptionLocalizations({
        'es-ES': 'Obtener información del rol',
        fr: 'Obtenir des informations sur le rôle',
        de: 'Rolleninformationen abrufen',
      })
      .addRoleOption(option =>
        option
          .setName('role')
          .setDescription('The role to get information for')
          .setDescriptionLocalizations({
            'es-ES': 'El rol del que obtener información',
            fr: 'Le rôle dont obtenir les informations',
            de: 'Die Rolle, für die Informationen abgerufen werden sollen',
          })
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('serverinfo')
      .setDescription('Get server information')
      .setDescriptionLocalizations({
        'es-ES': 'Obtener información del servidor',
        fr: 'Obtenir des informations sur le serveur',
        de: 'Serverinformationen abrufen',
      })
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('help')
      .setDescription('Get help for commands')
      .setDescriptionLocalizations({
        'es-ES': 'Obtener ayuda para los comandos',
        fr: "Obtenir de l'aide pour les commandes",
        de: 'Hilfe zu Befehlen erhalten',
      })
      .addStringOption(option =>
        option
          .setName('command')
          .setDescription('The command to get help for')
          .setDescriptionLocalizations({
            'es-ES': 'El comando para obtener ayuda',
            fr: "La commande pour laquelle obtenir de l'aide",
            de: 'Der Befehl, für den Hilfe benötigt wird',
          })
          .setRequired(false)
          .setAutocomplete(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('support')
      .setDescription('Get support server link')
      .setDescriptionLocalizations({
        'es-ES': 'Obtener enlace del servidor de soporte',
        fr: 'Obtenir le lien du serveur de support',
        de: 'Support-Server-Link erhalten',
      })
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('stats')
      .setDescription('View bot statistics and system information')
      .setDescriptionLocalizations({
        'es-ES': 'Ver estadísticas del bot e información del sistema',
        fr: 'Voir les statistiques du bot et les informations système',
        de: 'Bot-Statistiken und Systeminformationen anzeigen',
      })
  );

export const category = CommandCategory.Utility;
export const cooldown = 3;

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const subcommand = interaction.options.getSubcommand();
  const locale = getGuildLocale(interaction.guildId!);

  try {
    switch (subcommand) {
      case 'avatar':
        await handleAvatar(interaction, locale);
        break;
      case 'banner':
        await handleBanner(interaction, locale);
        break;
      case 'steam':
        await handleSteam(interaction, locale);
        break;
      case 'userinfo':
        await handleUserInfo(interaction, locale);
        break;
      case 'whois':
        await handleWhois(interaction, locale);
        break;
      case 'roleinfo':
        await handleRoleInfo(interaction, locale);
        break;
      case 'serverinfo':
        await handleServerInfo(interaction, locale);
        break;
      case 'help':
        await handleHelp(interaction, locale);
        break;
      case 'support':
        await handleSupport(interaction, locale);
        break;
      case 'stats':
        await handleStats(interaction, locale);
        break;
    }
  } catch (error) {
    logger.error('Error in utils command:', error);
    const errorMessage = t('common.error', { lng: locale });

    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: errorMessage });
    } else {
      await interaction.reply({ content: errorMessage, ephemeral: true });
    }
  }
}

async function handleAvatar(
  interaction: ChatInputCommandInteraction,
  locale: string
): Promise<void> {
  const user = interaction.options.getUser('user') || interaction.user;

  const avatarUrl = user.displayAvatarURL({ size: 4096, extension: 'png' });

  const embed = new EmbedBuilder()
    .setTitle(t('commands.utils.avatar.title', { lng: locale, user: user.username }))
    .setImage(avatarUrl)
    .setColor(0x7289da)
    .setFooter({ text: t('commands.utils.avatar.footer', { lng: locale }) })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

async function handleBanner(
  interaction: ChatInputCommandInteraction,
  locale: string
): Promise<void> {
  await interaction.deferReply();

  const user = interaction.options.getUser('user') || interaction.user;

  try {
    // Fetch user with banner
    const fetchedUser = await interaction.client.users.fetch(user.id, { force: true });

    if (!fetchedUser.banner) {
      await interaction.editReply({
        content: t('commands.utils.banner.noBanner', { lng: locale, user: user.username }),
      });
      return;
    }

    const bannerUrl = fetchedUser.bannerURL({ size: 4096, extension: 'png' });

    const embed = new EmbedBuilder()
      .setTitle(t('commands.utils.banner.title', { lng: locale, user: user.username }))
      .setImage(bannerUrl!)
      .setColor(fetchedUser.accentColor || 0x7289da)
      .setFooter({ text: t('commands.utils.banner.footer', { lng: locale }) })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logger.error('Error fetching user banner:', error);
    await interaction.editReply({
      content: t('commands.utils.banner.error', { lng: locale }),
    });
  }
}

async function handleSteam(
  interaction: ChatInputCommandInteraction,
  locale: string
): Promise<void> {
  await interaction.deferReply();

  const username = interaction.options.getString('username', true);

  try {
    // Temporarily use mock service
    const embed = await SteamService.getPlayerSummary(username);

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logger.error('Error fetching Steam profile:', error);
    await interaction.editReply({
      content: t('commands.utils.steam.error', { lng: locale }),
    });
  }
}

async function handleUserInfo(
  interaction: ChatInputCommandInteraction,
  locale: string
): Promise<void> {
  const user = interaction.options.getUser('user') || interaction.user;
  const member = interaction.guild?.members.cache.get(user.id);

  const embed = new EmbedBuilder()
    .setTitle(t('commands.utils.userinfo.title', { lng: locale, user: user.username }))
    .setThumbnail(user.displayAvatarURL({ size: 512 }))
    .setColor(member?.displayColor || 0x7289da)
    .addFields([
      {
        name: t('commands.utils.userinfo.username', { lng: locale }),
        value: user.username,
        inline: true,
      },
      {
        name: t('commands.utils.userinfo.id', { lng: locale }),
        value: user.id,
        inline: true,
      },
      {
        name: t('commands.utils.userinfo.bot', { lng: locale }),
        value: user.bot ? t('common.yes', { lng: locale }) : t('common.no', { lng: locale }),
        inline: true,
      },
      {
        name: t('commands.utils.userinfo.created', { lng: locale }),
        value: `<t:${Math.floor(user.createdTimestamp / 1000)}:F>`,
        inline: true,
      },
    ]);

  if (member) {
    embed.addFields([
      {
        name: t('commands.utils.userinfo.joined', { lng: locale }),
        value: `<t:${Math.floor(member.joinedTimestamp! / 1000)}:F>`,
        inline: true,
      },
      {
        name: t('commands.utils.userinfo.nickname', { lng: locale }),
        value: member.nickname || t('common.none', { lng: locale }),
        inline: true,
      },
      {
        name: t('commands.utils.userinfo.roles', { lng: locale }),
        value:
          member.roles.cache
            .filter(role => role.id !== interaction.guildId)
            .sort((a, b) => b.position - a.position)
            .map(role => role.toString())
            .join(', ') || t('common.none', { lng: locale }),
        inline: false,
      },
      {
        name: t('commands.utils.userinfo.permissions', { lng: locale }),
        value:
          member.permissions
            .toArray()
            .map(perm => `\`${perm}\``)
            .join(', ') || t('common.none', { lng: locale }),
        inline: false,
      },
    ]);
  }

  const badges = getUserBadges(user);
  if (badges.length > 0) {
    embed.addFields({
      name: t('commands.utils.userinfo.badges', { lng: locale }),
      value: badges.join(' '),
      inline: false,
    });
  }

  embed.setFooter({ text: t('commands.utils.userinfo.footer', { lng: locale }) }).setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

async function handleWhois(
  interaction: ChatInputCommandInteraction,
  locale: string
): Promise<void> {
  await interaction.deferReply();

  const userId = interaction.options.getString('user_id', true);

  try {
    const user = await interaction.client.users.fetch(userId);
    const member = interaction.guild?.members.cache.get(userId);

    const embed = new EmbedBuilder()
      .setTitle(t('commands.utils.whois.title', { lng: locale }))
      .setThumbnail(user.displayAvatarURL({ size: 512 }))
      .setColor(member?.displayColor || 0x7289da)
      .addFields([
        {
          name: t('commands.utils.userinfo.username', { lng: locale }),
          value: user.username,
          inline: true,
        },
        {
          name: t('commands.utils.userinfo.id', { lng: locale }),
          value: user.id,
          inline: true,
        },
        {
          name: t('commands.utils.whois.tag', { lng: locale }),
          value: user.tag,
          inline: true,
        },
        {
          name: t('commands.utils.userinfo.bot', { lng: locale }),
          value: user.bot ? t('common.yes', { lng: locale }) : t('common.no', { lng: locale }),
          inline: true,
        },
        {
          name: t('commands.utils.userinfo.created', { lng: locale }),
          value: `<t:${Math.floor(user.createdTimestamp / 1000)}:F>`,
          inline: true,
        },
      ]);

    if (member) {
      embed.addFields({
        name: t('commands.utils.whois.inServer', { lng: locale }),
        value: t('common.yes', { lng: locale }),
        inline: true,
      });
    }

    embed.setFooter({ text: t('commands.utils.whois.footer', { lng: locale }) }).setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logger.error('Error in whois command:', error);
    await interaction.editReply({
      content: t('commands.utils.whois.notFound', { lng: locale }),
    });
  }
}

async function handleRoleInfo(
  interaction: ChatInputCommandInteraction,
  locale: string
): Promise<void> {
  const role = interaction.options.getRole('role', true) as Role;

  const permissions =
    role.permissions
      .toArray()
      .map(perm => `\`${perm}\``)
      .join(', ') || t('common.none', { lng: locale });

  const embed = new EmbedBuilder()
    .setTitle(t('commands.utils.roleinfo.title', { lng: locale, role: role.name }))
    .setColor(role.color || 0x7289da)
    .addFields([
      {
        name: t('commands.utils.roleinfo.name', { lng: locale }),
        value: role.name,
        inline: true,
      },
      {
        name: t('commands.utils.roleinfo.id', { lng: locale }),
        value: role.id,
        inline: true,
      },
      {
        name: t('commands.utils.roleinfo.color', { lng: locale }),
        value: role.hexColor,
        inline: true,
      },
      {
        name: t('commands.utils.roleinfo.position', { lng: locale }),
        value: role.position.toString(),
        inline: true,
      },
      {
        name: t('commands.utils.roleinfo.mentionable', { lng: locale }),
        value: role.mentionable
          ? t('common.yes', { lng: locale })
          : t('common.no', { lng: locale }),
        inline: true,
      },
      {
        name: t('commands.utils.roleinfo.hoisted', { lng: locale }),
        value: role.hoist ? t('common.yes', { lng: locale }) : t('common.no', { lng: locale }),
        inline: true,
      },
      {
        name: t('commands.utils.roleinfo.created', { lng: locale }),
        value: `<t:${Math.floor(role.createdTimestamp / 1000)}:F>`,
        inline: true,
      },
      {
        name: t('commands.utils.roleinfo.members', { lng: locale }),
        value: role.members.size.toString(),
        inline: true,
      },
      {
        name: t('commands.utils.roleinfo.permissions', { lng: locale }),
        value: permissions.length > 1024 ? permissions.substring(0, 1021) + '...' : permissions,
        inline: false,
      },
    ])
    .setFooter({ text: t('commands.utils.roleinfo.footer', { lng: locale }) })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

async function handleServerInfo(
  interaction: ChatInputCommandInteraction,
  locale: string
): Promise<void> {
  const guild = interaction.guild!;

  await guild.fetch();
  const owner = await guild.fetchOwner();

  const channels = guild.channels.cache;
  const textChannels = channels.filter(c => c.type === ChannelType.GuildText).size;
  const voiceChannels = channels.filter(c => c.type === ChannelType.GuildVoice).size;
  const categories = channels.filter(c => c.type === ChannelType.GuildCategory).size;

  const embed = new EmbedBuilder()
    .setTitle(t('commands.utils.serverinfo.title', { lng: locale }))
    .setThumbnail(guild.iconURL({ size: 512 }) || '')
    .setColor(0x7289da)
    .addFields([
      {
        name: t('commands.utils.serverinfo.name', { lng: locale }),
        value: guild.name,
        inline: true,
      },
      {
        name: t('commands.utils.serverinfo.id', { lng: locale }),
        value: guild.id,
        inline: true,
      },
      {
        name: t('commands.utils.serverinfo.owner', { lng: locale }),
        value: `${owner.user.tag} (${owner.id})`,
        inline: true,
      },
      {
        name: t('commands.utils.serverinfo.created', { lng: locale }),
        value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:F>`,
        inline: true,
      },
      {
        name: t('commands.utils.serverinfo.members', { lng: locale }),
        value: t('commands.utils.serverinfo.membersValue', {
          lng: locale,
          total: guild.memberCount,
          humans: guild.members.cache.filter(m => !m.user.bot).size,
          bots: guild.members.cache.filter(m => m.user.bot).size,
        }),
        inline: true,
      },
      {
        name: t('commands.utils.serverinfo.channels', { lng: locale }),
        value: t('commands.utils.serverinfo.channelsValue', {
          lng: locale,
          total: channels.size,
          text: textChannels,
          voice: voiceChannels,
          categories: categories,
        }),
        inline: true,
      },
      {
        name: t('commands.utils.serverinfo.roles', { lng: locale }),
        value: guild.roles.cache.size.toString(),
        inline: true,
      },
      {
        name: t('commands.utils.serverinfo.emojis', { lng: locale }),
        value: guild.emojis.cache.size.toString(),
        inline: true,
      },
      {
        name: t('commands.utils.serverinfo.boosts', { lng: locale }),
        value: t('commands.utils.serverinfo.boostsValue', {
          lng: locale,
          level: guild.premiumTier,
          boosts: guild.premiumSubscriptionCount || 0,
        }),
        inline: true,
      },
    ]);

  if (guild.description) {
    embed.addFields({
      name: t('commands.utils.serverinfo.description', { lng: locale }),
      value: guild.description,
      inline: false,
    });
  }

  const features = guild.features.map(f => `\`${f}\``).join(', ');
  if (features) {
    embed.addFields({
      name: t('commands.utils.serverinfo.features', { lng: locale }),
      value: features,
      inline: false,
    });
  }

  if (guild.bannerURL()) {
    embed.setImage(guild.bannerURL({ size: 1024 })!);
  }

  embed.setFooter({ text: t('commands.utils.serverinfo.footer', { lng: locale }) }).setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

async function handleHelp(interaction: ChatInputCommandInteraction, locale: string): Promise<void> {
  const commandName = interaction.options.getString('command');

  if (commandName) {
    const commandHelp = await helpService.getCommandHelp(commandName, locale);

    if (!commandHelp) {
      await interaction.reply({
        content: t('commands.utils.help.commandNotFound', { lng: locale }),
        ephemeral: true,
      });
      return;
    }

    await interaction.reply({ embeds: [commandHelp] });
  } else {
    const helpMenu = await helpService.getHelpMenu(locale);
    await interaction.reply({ embeds: [helpMenu] });
  }
}

async function handleSupport(
  interaction: ChatInputCommandInteraction,
  locale: string
): Promise<void> {
  const embed = new EmbedBuilder()
    .setTitle(t('commands.utils.support.title', { lng: locale }))
    .setDescription(t('commands.utils.support.description', { lng: locale }))
    .setColor(0x7289da)
    .addFields({
      name: t('commands.utils.support.link', { lng: locale }),
      value: '[discord.gg/vaultscope](https://discord.gg/vaultscope)',
      inline: false,
    })
    .setFooter({ text: t('commands.utils.support.footer', { lng: locale }) })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

function getUserBadges(user: User): string[] {
  const badges: string[] = [];
  const flags = user.flags?.toArray() || [];

  const badgeMap: Record<string, string> = {
    Staff: '🛡️',
    Partner: '🤝',
    Hypesquad: '🏆',
    BugHunterLevel1: '🐛',
    BugHunterLevel2: '🪲',
    HypeSquadOnlineHouse1: '🏠💜',
    HypeSquadOnlineHouse2: '🏠🧡',
    HypeSquadOnlineHouse3: '🏠💚',
    PremiumEarlySupporter: '💎',
    VerifiedDeveloper: '✅',
    CertifiedModerator: '👮',
    ActiveDeveloper: '🔧',
  };

  for (const flag of flags) {
    if (badgeMap[flag]) {
      badges.push(badgeMap[flag]);
    }
  }

  return badges;
}

export async function autocomplete(interaction: ChatInputCommandInteraction): Promise<void> {
  const focused = interaction.options.getFocused();
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'help') {
    const commands = await helpService.getCommandList();
    const filtered = commands
      .filter(cmd => cmd.toLowerCase().includes(focused.toLowerCase()))
      .slice(0, 25);

    await interaction.respond(filtered.map(cmd => ({ name: cmd, value: cmd })));
  }
}

async function handleStats(
  interaction: ChatInputCommandInteraction,
  _locale: string
): Promise<void> {
  await interaction.deferReply();

  try {
    const client = interaction.client;

    // Calculate bot statistics
    const guildCount = client.guilds.cache.size;
    const userCount = client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);
    const channelCount = client.channels.cache.size;
    const commandCount = client.application?.commands.cache.size || 0;

    // System information
    const platform = os.platform();
    const arch = os.arch();
    const nodeVersion = process.version;
    const uptime = process.uptime();
    const memUsage = process.memoryUsage();

    // OS information
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const cpuCores = os.cpus().length;
    const cpuModel = os.cpus()[0]?.model || 'Unknown';
    const osType = os.type();
    const osRelease = os.release();
    const hostname = os.hostname();

    // Calculate CPU usage (approximation)
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;

    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type as keyof typeof cpu.times];
      }
      totalIdle += cpu.times.idle;
    });

    const cpuUsage = 100 - ~~((100 * totalIdle) / totalTick);

    // Format uptime
    const formatUptime = (seconds: number): string => {
      const days = Math.floor(seconds / 86400);
      const hours = Math.floor((seconds % 86400) / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const secs = Math.floor(seconds % 60);

      const parts = [];
      if (days > 0) parts.push(`${days}d`);
      if (hours > 0) parts.push(`${hours}h`);
      if (minutes > 0) parts.push(`${minutes}m`);
      if (secs > 0) parts.push(`${secs}s`);

      return parts.join(' ') || '0s';
    };

    // Format bytes
    const formatBytes = (bytes: number): string => {
      const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
      if (bytes === 0) return '0 B';
      const i = Math.floor(Math.log(bytes) / Math.log(1024));
      return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
    };

    // Create embed
    const embed = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle('📊 Bot Statistics & System Information')
      .setThumbnail(client.user?.displayAvatarURL() || '')
      .addFields(
        {
          name: '🤖 Bot Statistics',
          value: [
            `**Guilds:** ${guildCount.toLocaleString()}`,
            `**Users:** ${userCount.toLocaleString()}`,
            `**Channels:** ${channelCount.toLocaleString()}`,
            `**Commands:** ${commandCount}`,
            `**Uptime:** ${formatUptime(uptime)}`,
            `**Ping:** ${client.ws.ping}ms`,
          ].join('\n'),
          inline: true,
        },
        {
          name: '💻 System Information',
          value: [
            `**OS:** ${osType} ${osRelease}`,
            `**Platform:** ${platform} (${arch})`,
            `**Hostname:** ${hostname}`,
            `**CPU:** ${cpuModel}`,
            `**CPU Cores:** ${cpuCores}`,
            `**CPU Usage:** ~${cpuUsage}%`,
          ].join('\n'),
          inline: true,
        },
        {
          name: '💾 Memory Usage',
          value: [
            `**Total RAM:** ${formatBytes(totalMem)}`,
            `**Used RAM:** ${formatBytes(usedMem)} (${Math.round((usedMem / totalMem) * 100)}%)`,
            `**Free RAM:** ${formatBytes(freeMem)}`,
            `**Bot RSS:** ${formatBytes(memUsage.rss)}`,
            `**Bot Heap:** ${formatBytes(memUsage.heapUsed)} / ${formatBytes(memUsage.heapTotal)}`,
            `**Bot External:** ${formatBytes(memUsage.external)}`,
          ].join('\n'),
          inline: false,
        },
        {
          name: '📦 Versions',
          value: [
            `**Node.js:** ${nodeVersion}`,
            `**Discord.js:** v${djsVersion}`,
            `**TypeScript:** v${require('typescript/package.json').version}`,
          ].join('\n'),
          inline: true,
        },
        {
          name: '⚙️ Process Information',
          value: [
            `**PID:** ${process.pid}`,
            `**Platform:** ${process.platform}`,
            `**Architecture:** ${process.arch}`,
            `**Memory Limit:** ${formatBytes(memUsage.rss)}`,
          ].join('\n'),
          inline: true,
        }
      )
      .setFooter({
        text: `Requested by ${interaction.user.tag}`,
        iconURL: interaction.user.displayAvatarURL(),
      })
      .setTimestamp();

    // Add GPU information if available (usually not accessible in Node.js)
    try {
      // This is a placeholder - GPU info typically requires additional libraries
      // or system calls that aren't standard in Node.js
      if (process.platform === 'linux') {
        // Could potentially use exec to run nvidia-smi or similar
        // but keeping it simple for now
      }
    } catch (error) {
      // GPU info not available
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logger.error('Error in stats command:', error);
    await interaction.editReply({
      content: 'An error occurred while fetching statistics.',
    });
  }
}

export default {
  data,
  category,
  cooldown,
  execute,
  autocomplete,
} as Command;
