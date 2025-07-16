import { 
  SlashCommandBuilder, 
  EmbedBuilder, 
  CommandInteraction,
  version as djsVersion 
} from 'discord.js';
import { i18n } from '../../i18n';
import * as os from 'os';

export const data = new SlashCommandBuilder()
  .setName('ping')
  .setDescription('Check bot latency and response time');

export async function execute(interaction: any) {
  const t = i18n.createTranslator(interaction.user.id, interaction.guildId || undefined);
  
  const sent = await interaction.reply({
    content: `⏳ ${t('commands.ping.pong')}...`,
    fetchReply: true,
  });

  const botLatency = sent.createdTimestamp - interaction.createdTimestamp;
  const apiLatency = Math.round(interaction.client.ws.ping);
  const uptime = process.uptime();
  
  // Calculate status based on latency
  let status: string;
  let statusEmoji: string;
  let color: number;
  
  if (botLatency < 100 && apiLatency < 100) {
    status = t('commands.ping.excellent');
    statusEmoji = '🟢';
    color = 0x00ff00;
  } else if (botLatency < 200 && apiLatency < 200) {
    status = t('commands.ping.good');
    statusEmoji = '🟡';
    color = 0xffff00;
  } else {
    status = t('commands.ping.poor');
    statusEmoji = '🔴';
    color = 0xff0000;
  }

  const embed = new EmbedBuilder()
    .setTitle(`🏓 ${t('commands.ping.pong')}`)
    .setColor(color)
    .addFields(
      {
        name: t('commands.ping.bot_latency'),
        value: `\`${botLatency}ms\``,
        inline: true
      },
      {
        name: t('commands.ping.api_latency'),
        value: `\`${apiLatency}ms\``,
        inline: true
      },
      {
        name: t('commands.ping.status'),
        value: `${statusEmoji} ${status}`,
        inline: true
      },
      {
        name: '📊 Bot Statistics',
        value: [
          `**Uptime:** ${formatUptime(uptime)}`,
          `**Memory:** ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
          `**Servers:** ${interaction.client.guilds.cache.size}`,
          `**Users:** ${interaction.client.users.cache.size}`
        ].join('\n'),
        inline: false
      },
      {
        name: '⚙️ System Info',
        value: [
          `**Node.js:** ${process.version}`,
          `**Discord.js:** v${djsVersion}`,
          `**Platform:** ${os.platform()} ${os.arch()}`,
          `**CPU:** ${os.cpus()[0].model.split(' ')[0]} (${os.cpus().length} cores)`
        ].join('\n'),
        inline: false
      }
    )
    .setFooter({ 
      text: `Requested by ${interaction.user.username}`,
      iconURL: interaction.user.displayAvatarURL()
    })
    .setTimestamp();

  await interaction.editReply({
    content: '',
    embeds: [embed]
  });
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0) parts.push(`${secs}s`);

  return parts.length > 0 ? parts.join(' ') : '0s';
}