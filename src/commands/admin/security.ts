import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuInteraction,
  ButtonInteraction,
  ComponentType,
  PermissionFlagsBits
} from 'discord.js';
import { permissions } from '../../security/permissions';
import { auditLogger } from '../../security/audit';
import { rateLimiter } from '../../security/rateLimiter';
import { InputValidator } from '../../security/validator';
import { config } from '../../config';

export const data = new SlashCommandBuilder()
  .setName('security')
  .setDescription('Manage bot security settings')
  .addSubcommand(subcommand =>
    subcommand
      .setName('permissions')
      .setDescription('Manage custom permissions')
      .addStringOption(option =>
        option
          .setName('action')
          .setDescription('Action to perform')
          .setRequired(true)
          .addChoices(
            { name: 'View', value: 'view' },
            { name: 'Grant', value: 'grant' },
            { name: 'Revoke', value: 'revoke' }
          )
      )
      .addUserOption(option =>
        option
          .setName('user')
          .setDescription('User to manage permissions for')
          .setRequired(false)
      )
      .addRoleOption(option =>
        option
          .setName('role')
          .setDescription('Role to manage permissions for')
          .setRequired(false)
      )
      .addStringOption(option =>
        option
          .setName('permission')
          .setDescription('Permission node (e.g., moderation.ban)')
          .setRequired(false)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('audit')
      .setDescription('View audit logs')
      .addUserOption(option =>
        option
          .setName('user')
          .setDescription('Filter by user')
          .setRequired(false)
      )
      .addStringOption(option =>
        option
          .setName('category')
          .setDescription('Filter by category')
          .setRequired(false)
          .addChoices(
            { name: 'Moderation', value: 'moderation' },
            { name: 'Configuration', value: 'configuration' },
            { name: 'Economy', value: 'economy' },
            { name: 'Permissions', value: 'permissions' },
            { name: 'Security', value: 'security' }
          )
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('ratelimits')
      .setDescription('View rate limit status')
      .addUserOption(option =>
        option
          .setName('user')
          .setDescription('Check rate limits for a specific user')
          .setRequired(false)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('alerts')
      .setDescription('View security alerts')
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
  const subcommand = interaction.options.getSubcommand();

  switch (subcommand) {
    case 'permissions':
      await handlePermissions(interaction);
      break;
    case 'audit':
      await handleAudit(interaction);
      break;
    case 'ratelimits':
      await handleRateLimits(interaction);
      break;
    case 'alerts':
      await handleAlerts(interaction);
      break;
  }
}

async function handlePermissions(interaction: ChatInputCommandInteraction) {
  const action = interaction.options.getString('action', true);
  const user = interaction.options.getUser('user');
  const role = interaction.options.getRole('role');
  const permission = interaction.options.getString('permission');

  if (action === 'view') {
    if (!user && !role) {
      await interaction.reply({
        content: 'Please specify a user or role to view permissions for.',
        ephemeral: true
      });
      return;
    }

    const target = user || role!;
    const targetType = user ? 'user' : 'role';
    const perms = await permissions.getPermissionList(
      interaction.guildId!,
      target.id,
      targetType
    );

    const embed = new EmbedBuilder()
      .setTitle(`Permissions for ${target.toString()}`)
      .setColor(config.colors.primary)
      .setDescription(
        perms.length > 0
          ? perms.map(p => `${p.allowed ? '✅' : '❌'} \`${p.node}\``).join('\n')
          : 'No custom permissions set.'
      )
      .setFooter({ text: `${perms.length} permission${perms.length !== 1 ? 's' : ''}` });

    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }

  if (!permission) {
    await interaction.reply({
      content: 'Please specify a permission node.',
      ephemeral: true
    });
    return;
  }

  if (!user && !role) {
    await interaction.reply({
      content: 'Please specify a user or role.',
      ephemeral: true
    });
    return;
  }

  const target = user || role!;
  const targetType = user ? 'user' : 'role';

  if (action === 'grant') {
    if (targetType === 'user') {
      await permissions.grantUserPermission(interaction.guildId!, target.id, permission);
    } else {
      await permissions.grantRolePermission(interaction.guildId!, target.id, permission);
    }

    await interaction.reply({
      embeds: [{
        title: 'Permission Granted',
        description: `✅ Granted \`${permission}\` to ${target.toString()}`,
        color: config.colors.success
      }]
    });
  } else if (action === 'revoke') {
    if (targetType === 'user') {
      await permissions.revokeUserPermission(interaction.guildId!, target.id, permission);
    } else {
      await permissions.revokeRolePermission(interaction.guildId!, target.id, permission);
    }

    await interaction.reply({
      embeds: [{
        title: 'Permission Revoked',
        description: `❌ Revoked \`${permission}\` from ${target.toString()}`,
        color: config.colors.error
      }]
    });
  }
}

async function handleAudit(interaction: ChatInputCommandInteraction) {
  const user = interaction.options.getUser('user');
  const category = interaction.options.getString('category');

  const logs = await auditLogger.query({
    guildId: interaction.guildId!,
    userId: user?.id,
    category: category || undefined
  }, 10);

  const embed = new EmbedBuilder()
    .setTitle('Audit Logs')
    .setColor(config.colors.primary)
    .setDescription(
      logs.length > 0
        ? logs.map(log => {
            const time = new Date(log.timestamp).toLocaleString();
            return `**${time}**\n<@${log.userId}> - \`${log.action}\`\n${
              Object.keys(log.details).length > 0 
                ? `Details: ${JSON.stringify(log.details).slice(0, 100)}\n` 
                : ''
            }`;
          }).join('\n')
        : 'No audit logs found.'
    )
    .setFooter({ text: `Showing ${logs.length} most recent entries` });

  const components = [];
  if (logs.length === 10) {
    components.push(
      new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('audit_stats')
            .setLabel('View Statistics')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('📊')
        )
    );
  }

  await interaction.reply({ 
    embeds: [embed], 
    components,
    ephemeral: true 
  });
}

async function handleRateLimits(interaction: ChatInputCommandInteraction) {
  const user = interaction.options.getUser('user');
  const metrics = rateLimiter.getMetrics();

  if (user) {
    const key = `discord:${user.id}:default`;
    const status = rateLimiter.getStatus(key);

    const embed = new EmbedBuilder()
      .setTitle(`Rate Limit Status for ${user.tag}`)
      .setColor(status ? config.colors.warning : config.colors.success)
      .setDescription(
        status
          ? `Current requests: ${status.count}\nResets at: ${new Date(status.resetAt).toLocaleString()}`
          : 'No active rate limits'
      );

    await interaction.reply({ embeds: [embed], ephemeral: true });
  } else {
    const embed = new EmbedBuilder()
      .setTitle('Rate Limit Metrics')
      .setColor(config.colors.primary)
      .addFields(
        { name: 'Total Tracked', value: metrics.totalEntries.toString(), inline: true },
        { name: 'Blacklisted', value: metrics.blacklistedCount.toString(), inline: true }
      );

    if (metrics.topOffenders.length > 0) {
      embed.addFields({
        name: 'Top Rate Limited Users',
        value: metrics.topOffenders
          .map(o => `<@${o.key.split(':')[1]}> - ${o.count} requests`)
          .join('\n')
      });
    }

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
}

async function handleAlerts(interaction: ChatInputCommandInteraction) {
  // This would fetch security alerts from the database
  const embed = new EmbedBuilder()
    .setTitle('Security Alerts')
    .setColor(config.colors.warning)
    .setDescription('No active security alerts.')
    .setFooter({ text: 'All systems operational' });

  await interaction.reply({ embeds: [embed], ephemeral: true });
}