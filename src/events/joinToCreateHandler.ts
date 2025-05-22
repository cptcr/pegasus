import { Events, VoiceState, ChannelType, PermissionFlagsBits, GuildBasedChannel, VoiceChannel } from 'discord.js';
import { DatabaseService } from '../lib/database';
import { client } from '../index';

export const voiceStateUpdate = {
  name: Events.VoiceStateUpdate,
  async execute(oldState: VoiceState, newState: VoiceState) {
    const guild = newState.guild;
    
    try {
      // Guild-Einstellungen prüfen
      const guildSettings = await DatabaseService.getGuildSettings(guild.id);
      if (!guildSettings.enableJoinToCreate || !guildSettings.joinToCreateChannelId) {
        return;
      }

      // User joined trigger channel
      if (!oldState.channel && newState.channel && 
          newState.channel.id === guildSettings.joinToCreateChannelId) {
        await createTempChannel(newState, guildSettings);
      }
      
      // User left temp channel - check if it should be deleted
      if (oldState.channel && !newState.channel) {
        await checkTempChannelDeletion(oldState);
      }
      
      // User switched channels - check both
      if (oldState.channel && newState.channel && 
          oldState.channel.id !== newState.channel.id) {
        
        // Check if joined trigger channel
        if (newState.channel.id === guildSettings.joinToCreateChannelId) {
          await createTempChannel(newState, guildSettings);
        }
        
        // Check if left temp channel
        await checkTempChannelDeletion(oldState);
      }

    } catch (error) {
      console.error('Fehler beim Join-To-Create Handler:', error);
    }
  },
};

async function createTempChannel(voiceState: VoiceState, guildSettings: any) {
  const { member, guild } = voiceState;
  if (!member) return;

  try {
    // Prüfen ob der Besitzer einen bestehenden temporären Channel hat
    const existingTempChannel = await DatabaseService.getTempChannelByUser(member.id, guild.id);
    if (existingTempChannel) {
      // Versuche den Benutzer in seinen bestehenden Channel zu verschieben
      const existingChannel = await guild.channels.fetch(existingTempChannel.channelId).catch(() => null);
      
      // Füge einen zusätzlichen Typ-Check hinzu, um sicherzustellen, dass es sich um einen VoiceChannel oder StageChannel handelt
      if (existingChannel && 'members' in existingChannel && 
          (existingChannel.type === ChannelType.GuildVoice || existingChannel.type === ChannelType.GuildStageVoice)) {
        try {
          await member.voice.setChannel(existingChannel);
          return;
        } catch (error) {
          // Channel existiert nicht mehr oder Fehler beim Verschieben
          console.error(`Fehler beim Verschieben in existierenden Channel:`, error);
        }
      }
    }

    // Neuen temporären Channel erstellen
    const category = await guild.channels.fetch(guildSettings.joinToCreateCategoryId!).catch(() => null);
    
    const tempChannel = await guild.channels.create({
      name: `${member.displayName}'s Channel`,
      type: ChannelType.GuildVoice,
      parent: category?.id,
      permissionOverwrites: [
        {
          id: guild.roles.everyone.id,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect],
        },
        {
          id: member.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.Connect,
            PermissionFlagsBits.ManageChannels,
            PermissionFlagsBits.ManageRoles,
            PermissionFlagsBits.MoveMembers,
            PermissionFlagsBits.MuteMembers,
            PermissionFlagsBits.DeafenMembers,
          ],
        },
      ],
      reason: `Temporärer Voice Channel für ${member.user.tag}`,
    });

    // In Datenbank speichern
    await DatabaseService.createTempChannel({
      guildId: guild.id,
      channelId: tempChannel.id,
      ownerId: member.id,
    });

    // User in den neuen Channel verschieben
    try {
      await member.voice.setChannel(tempChannel);
      console.log(`✅ Temporärer Channel erstellt für ${member.user.tag}: ${tempChannel.name}`);
    } catch (error) {
      // Fehler beim Verschieben - Channel trotzdem erstellt
      console.error('Fehler beim Verschieben des Users in temporären Channel:', error);
    }

  } catch (error) {
    console.error('Fehler beim Erstellen des temporären Channels:', error);
  }
}

async function checkTempChannelDeletion(voiceState: VoiceState) {
  const { channel, guild } = voiceState;
  if (!channel || !('members' in channel)) return;

  try {
    // Prüfen ob es ein temporärer Channel ist
    const tempChannel = await DatabaseService.getTempChannel(channel.id);
    if (!tempChannel) return;

    // Warten bevor Überprüfung (kurze Verzögerung für Channel-Wechsel)
    setTimeout(async () => {
      try {
        // Channel erneut abrufen für aktuelle Member-Anzahl
        const currentChannel = await guild.channels.fetch(channel.id).catch(() => null);
        
        if (currentChannel && 'members' in currentChannel && 
            (currentChannel.type === ChannelType.GuildVoice || currentChannel.type === ChannelType.GuildStageVoice)) {
          // Wenn Channel leer ist, löschen
          if (currentChannel.members.size === 0) {
            await currentChannel.delete('Temporärer Channel ist leer');
            await DatabaseService.deleteTempChannel(channel.id);
            console.log(`🗑️ Temporärer Channel gelöscht: ${channel.name}`);
          }
        }
      } catch (error) {
        console.error('Fehler beim Überprüfen/Löschen des temporären Channels:', error);
        // Channel aus DB entfernen falls Discord-Fehler
        await DatabaseService.deleteTempChannel(channel.id);
      }
    }, 3000); // 3 Sekunden Verzögerung

  } catch (error) {
    console.error('Fehler beim Überprüfen des temporären Channels:', error);
  }
}

// Cleanup-Funktion für verwaiste Channels
export async function cleanupTempChannels() {
  try {
    const allTempChannels = await DatabaseService.prisma.tempVoiceChannel.findMany({
      include: { owner: true },
    });

    for (const tempChannel of allTempChannels) {
      try {
        // Use the Discord client directly instead of tempChannel.owner.client
        const channel = await client.channels.fetch(tempChannel.channelId).catch(() => null);
        
        if (!channel || !('members' in channel) || 
            !(channel.type === ChannelType.GuildVoice || channel.type === ChannelType.GuildStageVoice) || 
            channel.members.size === 0) {
          // Channel existiert nicht mehr oder ist leer
          if (channel && 'delete' in channel) {
            await channel.delete('Cleanup verwaister temporärer Channel').catch(() => null);
          }
          await DatabaseService.deleteTempChannel(tempChannel.channelId);
          console.log(`🧹 Verwaisten temporären Channel bereinigt: ${tempChannel.channelId}`);
        }
      } catch (error) {
        console.error(`Fehler beim Bereinigen des temporären Channels ${tempChannel.channelId}:`, error);
        // Trotzdem aus DB entfernen
        await DatabaseService.deleteTempChannel(tempChannel.channelId);
      }
    }
  } catch (error) {
    console.error('Fehler beim Cleanup der temporären Channels:', error);
  }
}