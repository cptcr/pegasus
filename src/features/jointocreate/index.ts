import { ClientWithCommands, Feature } from '../../types';
import { Events, VoiceState, ChannelType, OverwriteResolvable, PermissionsBitField, GuildChannel } from 'discord.js';
import { getGuildSettings, updateGuildSettings } from '../../utils/guildSettings';

const temporaryChannels = new Map<string, string>(); // Key: tempChannelId, Value: ownerUserId

const jointocreateFeature: Feature = {
  name: 'joinToCreate',
  description: 'Ermöglicht Benutzern das Erstellen temporärer Sprachkanäle durch Beitritt zu einem bestimmten Kanal.',
  enabled: true, // Wird durch die globale Konfiguration client.config.enabledFeatures.joinToCreate gesteuert
  async initialize(client: ClientWithCommands) {
    if (!client.config.enabledFeatures.joinToCreate) {
      return;
    }

    client.on(Events.VoiceStateUpdate, async (oldState: VoiceState, newState: VoiceState) => {
      if (!newState.guild || newState.member?.user.bot) return;

      const guildId = newState.guild.id;
      const guildSettings = await getGuildSettings(guildId, client);

      if (!guildSettings.enableJoinToCreate || !guildSettings.joinToCreateChannelId || !guildSettings.joinToCreateCategoryId) {
        return;
      }

      const triggerChannelId = guildSettings.joinToCreateChannelId;
      const targetCategoryId = guildSettings.joinToCreateCategoryId;
      const member = newState.member;

      if (!member) return;

      // Benutzer betritt den Trigger-Kanal
      if (newState.channelId === triggerChannelId && oldState.channelId !== triggerChannelId) {
        try {
          const category = newState.guild.channels.cache.get(targetCategoryId);
          if (!category || category.type !== ChannelType.GuildCategory) {
            console.warn(`JoinToCreate: Kategorie ${targetCategoryId} nicht gefunden oder kein Kategorietyp.`);
            return;
          }

          const tempChannelName = `${member.displayName}'s Kanal`;
          
          const permissionOverwrites: OverwriteResolvable[] = [
            {
              id: member.id, // Channel Ersteller
              allow: [
                PermissionsBitField.Flags.ViewChannel,
                PermissionsBitField.Flags.Connect,
                PermissionsBitField.Flags.Speak,
                PermissionsBitField.Flags.Stream,
                PermissionsBitField.Flags.ManageChannels, // Erlaubt dem Ersteller, den Kanal zu verwalten
                PermissionsBitField.Flags.MoveMembers,
                PermissionsBitField.Flags.MuteMembers,
                PermissionsBitField.Flags.DeafenMembers,
              ],
            },
            {
              id: newState.guild.roles.everyone, // @everyone
              deny: [PermissionsBitField.Flags.Connect], // Verhindert, dass andere ohne Einladung beitreten
              allow: [PermissionsBitField.Flags.ViewChannel] // Erlaubt anderen, den Kanal zu sehen (optional)
            },
          ];
          
          // Support Rolle hinzufügen, falls konfiguriert
          if (guildSettings.ticketSupportRoleId) { // Wiederverwendung der Support-Rolle oder eine dedizierte JTC-Admin-Rolle
              permissionOverwrites.push({
                  id: guildSettings.ticketSupportRoleId,
                  allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.ManageChannels]
              });
          }
           newState.guild.roles.cache.filter(role => role.permissions.has(PermissionsBitField.Flags.Administrator)).forEach(adminRole => {
                permissionOverwrites.push({
                    id: adminRole.id,
                    allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.ManageChannels, PermissionsBitField.Flags.MoveMembers]
                });
           });


          const createdChannel = await newState.guild.channels.create({
            name: tempChannelName,
            type: ChannelType.GuildVoice,
            parent: category.id,
            permissionOverwrites: permissionOverwrites,
            userLimit: 0, // Optional: Benutzerlimit
          });

          temporaryChannels.set(createdChannel.id, member.id);
          await member.voice.setChannel(createdChannel);

          if (guildSettings.modLogChannelId) {
            const logChannel = newState.guild.channels.cache.get(guildSettings.modLogChannelId) as TextChannel | undefined;
            if (logChannel?.isTextBased()) {
                logChannel.send(`🎤 JoinToCreate: ${member.user.tag} hat den temporären Kanal ${createdChannel.name} (${createdChannel.id}) erstellt.`).catch(console.error);
            }
          }


        } catch (error) {
          console.error('Fehler beim Erstellen des temporären JoinToCreate Kanals:', error);
        }
      }

      // Benutzer verlässt einen Kanal (Überprüfung, ob es ein temporärer Kanal ist)
      if (oldState.channelId && oldState.channelId !== newState.channelId) {
        const tempChannelId = oldState.channelId;
        if (temporaryChannels.has(tempChannelId)) {
          const channel = oldState.guild.channels.cache.get(tempChannelId) as GuildChannel | undefined;
          if (channel && channel.isVoiceBased() && channel.members.size === 0) {
            try {
              await channel.delete('Temporärer Kanal leer.');
              temporaryChannels.delete(tempChannelId);
              if (guildSettings.modLogChannelId) {
                const logChannel = newState.guild.channels.cache.get(guildSettings.modLogChannelId) as TextChannel | undefined;
                if (logChannel?.isTextBased()) {
                    logChannel.send(`🎤 JoinToCreate: Temporärer Kanal ${channel.name} (${channel.id}) wurde gelöscht, da er leer war.`).catch(console.error);
                }
              }
            } catch (error) {
              console.error(`Fehler beim Löschen des temporären Kanals ${tempChannelId}:`, error);
            }
          }
        }
      }
    });

    // Regelmäßiger Check für leere temporäre Kanäle (falls der Bot neu gestartet wurde)
    setInterval(async () => {
        temporaryChannels.forEach(async (ownerId, tempChannelId) => {
            const guild = client.guilds.cache.find(g => !!g.channels.cache.has(tempChannelId));
            if (!guild) {
                temporaryChannels.delete(tempChannelId);
                return;
            }
            const channel = guild.channels.cache.get(tempChannelId) as GuildChannel | undefined;
            if (channel && channel.isVoiceBased() && channel.members.size === 0) {
                try {
                    await channel.delete('Temporärer Kanal leer (Aufräumaktion).');
                    temporaryChannels.delete(tempChannelId);
                     const guildSettings = await getGuildSettings(guild.id, client);
                     if (guildSettings.modLogChannelId) {
                        const logChannel = guild.channels.cache.get(guildSettings.modLogChannelId) as TextChannel | undefined;
                        if (logChannel?.isTextBased()) {
                            logChannel.send(`🎤 JoinToCreate: Temporärer Kanal ${channel.name} (${channel.id}) wurde durch Aufräumaktion gelöscht.`).catch(console.error);
                        }
                    }
                } catch (error) {
                    console.error(`Fehler beim Aufräumen des temporären Kanals ${tempChannelId}:`, error);
                }
            } else if (!channel) { // Kanal existiert nicht mehr
                temporaryChannels.delete(tempChannelId);
            }
        });
    }, 5 * 60 * 1000); // Alle 5 Minuten
  },
  async shutdown(client: ClientWithCommands) {
    // Hier könnten noch offene Timer oder Intervalle bereinigt werden, falls nötig
    temporaryChannels.clear();
  }
};

export default jointocreateFeature;