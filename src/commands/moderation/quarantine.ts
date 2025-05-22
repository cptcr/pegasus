import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  GuildMember,
  Role,
  TextChannel,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} from 'discord.js';
import { DatabaseService } from '../../lib/database';

export const data = new SlashCommandBuilder()
  .setName('quarantine')
  .setDescription('Quarantäne-System verwalten')
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .addSubcommand(subcommand =>
    subcommand
      .setName('setup')
      .setDescription('Quarantäne-System einrichten')
      .addRoleOption(option =>
        option
          .setName('role')
          .setDescription('Quarantäne-Rolle')
          .setRequired(true)
      )
      .addChannelOption(option =>
        option
          .setName('log_channel')
          .setDescription('Log-Channel für Quarantäne-Aktionen')
          .setRequired(false)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('user')
      .setDescription('Benutzer in Quarantäne setzen')
      .addUserOption(option =>
        option
          .setName('user')
          .setDescription('Ziel-Benutzer')
          .setRequired(true)
      )
      .addStringOption(option =>
        option
          .setName('reason')
          .setDescription('Grund für die Quarantäne')
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('channel')
      .setDescription('Channel in Quarantäne setzen')
      .addChannelOption(option =>
        option
          .setName('channel')
          .setDescription('Ziel-Channel')
          .setRequired(true)
      )
      .addStringOption(option =>
        option
          .setName('reason')
          .setDescription('Grund für die Quarantäne')
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('role')
      .setDescription('Rolle in Quarantäne setzen')
      .addRoleOption(option =>
        option
          .setName('role')
          .setDescription('Ziel-Rolle')
          .setRequired(true)
      )
      .addStringOption(option =>
        option
          .setName('reason')
          .setDescription('Grund für die Quarantäne')
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('list')
      .setDescription('Aktive Quarantäne-Einträge anzeigen')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('release')
      .setDescription('Quarantäne aufheben')
      .addIntegerOption(option =>
        option
          .setName('id')
          .setDescription('Quarantäne-ID')
          .setRequired(true)
      )
  );

export async function run({ interaction }: { interaction: ChatInputCommandInteraction }) {
  const subcommand = interaction.options.getSubcommand();

  switch (subcommand) {
    case 'setup':
      await handleSetup(interaction);
      break;
    case 'user':
      await handleUserQuarantine(interaction);
      break;
    case 'channel':
      await handleChannelQuarantine(interaction);
      break;
    case 'role':
      await handleRoleQuarantine(interaction);
      break;
    case 'list':
      await handleListQuarantine(interaction);
      break;
    case 'release':
      await handleReleaseQuarantine(interaction);
      break;
  }
}

async function handleSetup(interaction: ChatInputCommandInteraction) {
  const role = interaction.options.getRole('role', true);
  const logChannel = interaction.options.getChannel('log_channel');
  const guild = interaction.guild!;

  await interaction.deferReply();

  try {
    // Guild-Einstellungen aktualisieren
    await DatabaseService.updateGuildSettings(guild.id, {
      quarantineRoleId: role.id,
      modLogChannelId: logChannel?.id || null,
      name: guild.name
    });

    const embed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle('✅ Quarantäne-System eingerichtet')
      .setDescription(`Das Quarantäne-System wurde erfolgreich eingerichtet.`)
      .addFields(
        { name: '🔒 Quarantäne-Rolle', value: role.toString(), inline: true },
        { name: '📝 Log-Channel', value: logChannel ? logChannel.toString() : 'Nicht gesetzt', inline: true }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Fehler beim Einrichten des Quarantäne-Systems:', error);
    await interaction.editReply('❌ Es ist ein Fehler aufgetreten. Bitte versuche es erneut.');
  }
}

async function handleUserQuarantine(interaction: ChatInputCommandInteraction) {
  const user = interaction.options.getUser('user', true);
  const reason = interaction.options.getString('reason', true);
  const guild = interaction.guild!;
  const moderator = interaction.user;

  await interaction.deferReply();

  try {
    // Guild-Einstellungen abrufen
    const guildSettings = await DatabaseService.getGuildSettings(guild.id);
    if (!guildSettings.quarantineRoleId) {
      return interaction.editReply('❌ Das Quarantäne-System ist nicht eingerichtet. Benutze `/quarantine setup`.');
    }

    // Benutzer und Moderator in Datenbank speichern
    await DatabaseService.getOrCreateUser(user.id, user.username);
    await DatabaseService.getOrCreateUser(moderator.id, moderator.username);

    // Quarantäne-Eintrag erstellen
    const entry = await DatabaseService.addQuarantineEntry({
      guildId: guild.id,
      targetId: user.id,
      targetType: 'USER',
      moderatorId: moderator.id,
      reason
    });

    // Rolle zuweisen
    const member = await guild.members.fetch(user.id).catch(() => null);
    if (member) {
      const quarantineRole = await guild.roles.fetch(guildSettings.quarantineRoleId).catch(() => null);
      if (quarantineRole) {
        await member.roles.add(quarantineRole);
      }
    }

    // Erfolg anzeigen
    const embed = new EmbedBuilder()
      .setColor(0xff3333)
      .setTitle('🔒 Benutzer in Quarantäne gesetzt')
      .setDescription(`${user} wurde in Quarantäne gesetzt.`)
      .addFields(
        { name: 'ID', value: `${entry.id}`, inline: true },
        { name: 'Moderator', value: moderator.toString(), inline: true },
        { name: 'Grund', value: reason, inline: false }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    // Log-Channel Nachricht
    if (guildSettings.modLogChannelId) {
      const logChannel = await guild.channels.fetch(guildSettings.modLogChannelId).catch(() => null) as TextChannel;
      if (logChannel) {
        await logChannel.send({ embeds: [embed] });
      }
    }
  } catch (error) {
    console.error('Fehler beim Quarantäne-Befehl:', error);
    await interaction.editReply('❌ Es ist ein Fehler aufgetreten. Bitte versuche es erneut.');
  }
}

async function handleChannelQuarantine(interaction: ChatInputCommandInteraction) {
  const channel = interaction.options.getChannel('channel', true);
  const reason = interaction.options.getString('reason', true);
  const guild = interaction.guild!;
  const moderator = interaction.user;

  await interaction.deferReply();

  try {
    // Moderator in Datenbank speichern
    await DatabaseService.getOrCreateUser(moderator.id, moderator.username);

    // Quarantäne-Eintrag erstellen
    const entry = await DatabaseService.addQuarantineEntry({
      guildId: guild.id,
      targetId: channel.id,
      targetType: 'CHANNEL',
      moderatorId: moderator.id,
      reason
    });

    // Channel-Berechtigungen ändern
    const targetChannel = await guild.channels.fetch(channel.id).catch(() => null);
    if (targetChannel && 'permissionOverwrites' in targetChannel) {
      await targetChannel.permissionOverwrites.create(guild.roles.everyone, {
        ViewChannel: false
      });
      const guildSettings = await DatabaseService.getGuildSettings(guild.id);
      const quarantineRole = await guild.roles.fetch(guildSettings.quarantineRoleId || '').catch(() => null);
      if (quarantineRole) {
        await targetChannel.permissionOverwrites.create(quarantineRole, {
          ViewChannel: true,
          SendMessages: true,
          ReadMessageHistory: true
        });
      }
    }

    // Erfolg anzeigen
    const embed = new EmbedBuilder()
      .setColor(0xff3333)
      .setTitle('🔒 Channel in Quarantäne gesetzt')
      .setDescription(`${channel} wurde in Quarantäne gesetzt.`)
      .addFields(
        { name: 'ID', value: `${entry.id}`, inline: true },
        { name: 'Moderator', value: moderator.toString(), inline: true },
        { name: 'Grund', value: reason, inline: false }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    // Guild-Einstellungen abrufen für Log-Channel
    const guildSettings = await DatabaseService.getGuildSettings(guild.id);
    if (guildSettings.modLogChannelId) {
      const logChannel = await guild.channels.fetch(guildSettings.modLogChannelId).catch(() => null) as TextChannel;
      if (logChannel) {
        await logChannel.send({ embeds: [embed] });
      }
    }
  } catch (error) {
    console.error('Fehler beim Quarantäne-Befehl:', error);
    await interaction.editReply('❌ Es ist ein Fehler aufgetreten. Bitte versuche es erneut.');
  }
}

async function handleRoleQuarantine(interaction: ChatInputCommandInteraction) {
  const role = interaction.options.getRole('role', true);
  const reason = interaction.options.getString('reason', true);
  const guild = interaction.guild!;
  const moderator = interaction.user;

  await interaction.deferReply();

  try {
    // Moderator in Datenbank speichern
    await DatabaseService.getOrCreateUser(moderator.id, moderator.username);

    // Quarantäne-Eintrag erstellen
    const entry = await DatabaseService.addQuarantineEntry({
      guildId: guild.id,
      targetId: role.id,
      targetType: 'ROLE',
      moderatorId: moderator.id,
      reason
    });

    // Erfolg anzeigen
    const embed = new EmbedBuilder()
      .setColor(0xff3333)
      .setTitle('🔒 Rolle in Quarantäne gesetzt')
      .setDescription(`${role} wurde in Quarantäne gesetzt.`)
      .addFields(
        { name: 'ID', value: `${entry.id}`, inline: true },
        { name: 'Moderator', value: moderator.toString(), inline: true },
        { name: 'Grund', value: reason, inline: false }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    // Guild-Einstellungen abrufen für Log-Channel
    const guildSettings = await DatabaseService.getGuildSettings(guild.id);
    if (guildSettings.modLogChannelId) {
      const logChannel = await guild.channels.fetch(guildSettings.modLogChannelId).catch(() => null) as TextChannel;
      if (logChannel) {
        await logChannel.send({ embeds: [embed] });
      }
    }
  } catch (error) {
    console.error('Fehler beim Quarantäne-Befehl:', error);
    await interaction.editReply('❌ Es ist ein Fehler aufgetreten. Bitte versuche es erneut.');
  }
}

async function handleListQuarantine(interaction: ChatInputCommandInteraction) {
  const guild = interaction.guild!;

  await interaction.deferReply();

  try {
    // Aktive Quarantäne-Einträge abrufen
    const entries = await DatabaseService.getActiveQuarantineEntries(guild.id);

    if (entries.length === 0) {
      return interaction.editReply('✅ Es gibt keine aktiven Quarantäne-Einträge.');
    }

    // Einträge anzeigen
    const embed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle('🔒 Aktive Quarantäne-Einträge')
      .setDescription(`Es gibt ${entries.length} aktive Quarantäne-Einträge.`)
      .setTimestamp();

    // Einträge hinzufügen (max. 25)
    const maxEntries = Math.min(entries.length, 25);
    for (let i = 0; i < maxEntries; i++) {
      const entry = entries[i];
      const targetType = {
        'USER': 'Benutzer',
        'CHANNEL': 'Channel',
        'ROLE': 'Rolle'
      }[entry.targetType];

      let targetMention;
      if (entry.targetType === 'USER') {
        targetMention = `<@${entry.targetId}>`;
      } else if (entry.targetType === 'CHANNEL') {
        targetMention = `<#${entry.targetId}>`;
      } else if (entry.targetType === 'ROLE') {
        targetMention = `<@&${entry.targetId}>`;
      }

      embed.addFields({
        name: `ID ${entry.id}: ${targetType}`,
        value: `Target: ${targetMention}\nModerator: <@${entry.moderatorId}>\nGrund: ${entry.reason}\nDatum: ${entry.createdAt.toLocaleString()}`,
        inline: false
      });
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Fehler beim Abrufen der Quarantäne-Einträge:', error);
    await interaction.editReply('❌ Es ist ein Fehler aufgetreten. Bitte versuche es erneut.');
  }
}

async function handleReleaseQuarantine(interaction: ChatInputCommandInteraction) {
  const id = interaction.options.getInteger('id', true);
  const guild = interaction.guild!;

  await interaction.deferReply();

  try {
    // Quarantäne-Eintrag abrufen bevor er deaktiviert wird
    const entry = await DatabaseService.getQuarantineEntry(id);

    if (!entry) {
      return interaction.editReply('❌ Quarantäne-Eintrag nicht gefunden.');
    }

    if (!entry.active) {
      return interaction.editReply('❌ Dieser Quarantäne-Eintrag ist bereits aufgehoben.');
    }

    // Guild-Einstellungen abrufen
    const guildSettings = await DatabaseService.getGuildSettings(guild.id);

    // Je nach Typ die Quarantäne aufheben
    if (entry.targetType === 'USER') {
      // Benutzer-Quarantäne aufheben
      if (guildSettings.quarantineRoleId) {
        const member = await guild.members.fetch(entry.targetId).catch(() => null);
        if (member) {
          await member.roles.remove(guildSettings.quarantineRoleId).catch(() => null);
        }
      }
    } else if (entry.targetType === 'CHANNEL') {
      // Channel-Quarantäne aufheben
      const channel = await guild.channels.fetch(entry.targetId).catch(() => null);
      if (channel && 'permissionOverwrites' in channel) {
        await channel.permissionOverwrites.edit(guild.roles.everyone, {
          ViewChannel: true
        }).catch(() => null);
      }
    }
    // Für Rollen gibt es keine spezifische Aktion beim Aufheben

    // Quarantäne-Eintrag deaktivieren
    await DatabaseService.removeQuarantineEntry(id);

    // Erfolg anzeigen
    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle('🔓 Quarantäne aufgehoben')
      .setDescription(`Quarantäne-Eintrag mit ID ${id} wurde aufgehoben.`)
      .addFields(
        { name: 'Typ', value: entry.targetType === 'USER' ? 'Benutzer' : entry.targetType === 'CHANNEL' ? 'Channel' : 'Rolle', inline: true },
        { name: 'Moderator', value: `<@${interaction.user.id}>`, inline: true }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    // Log-Channel Nachricht
    if (guildSettings.modLogChannelId) {
      const logChannel = await guild.channels.fetch(guildSettings.modLogChannelId).catch(() => null) as TextChannel;
      if (logChannel) {
        await logChannel.send({ embeds: [embed] });
      }
    }
  } catch (error) {
    console.error('Fehler beim Aufheben der Quarantäne:', error);
    await interaction.editReply('❌ Es ist ein Fehler aufgetreten. Bitte versuche es erneut.');
  }
}
