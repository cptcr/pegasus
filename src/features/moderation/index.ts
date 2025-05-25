import { ClientWithCommands, Feature } from '../../types';
import { getGuildSettings, updateGuildSettings, invalidateGuildSettingsCache } from '../../utils/guildSettings';
import { GuildMember, TextChannel, User } from 'discord.js';

async function logModerationAction(client: ClientWithCommands, guildId: string, title: string, targetUser: User, moderator: User, reason: string, fields?: {name: string, value: string}[]) {
    const settings = await getGuildSettings(guildId, client);
    if (settings && settings.modLogChannelId) {
        const logChannel = await client.channels.fetch(settings.modLogChannelId) as TextChannel;
        if (logChannel && logChannel.isTextBased()) {
            const embed = {
                color: 0xFF0000,
                title: title,
                thumbnail: { url: targetUser.displayAvatarURL() },
                fields: [
                    { name: 'Benutzer', value: `${targetUser.tag} (${targetUser.id})`, inline: true },
                    { name: 'Moderator', value: `${moderator.tag} (${moderator.id})`, inline: true },
                    { name: 'Grund', value: reason, inline: false },
                    ...(fields || [])
                ],
                timestamp: new Date().toISOString(),
            };
            await logChannel.send({ embeds: [embed] });
        }
    }
}

const moderationFeature: Feature = {
  name: 'moderation',
  description: 'Verwaltet Verwarnungen, Quarantäne und Automod-Aktionen.',
  enabled: true,
  async initialize(client: ClientWithCommands) {
    if (!client.config.enabledFeatures.moderation && !client.config.enabledFeatures.automod) {
      return;
    }


  }
};

export default moderationFeature;