import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  TextChannel,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ColorResolvable
} from 'discord.js';
import { DatabaseService } from '../../lib/database';

export const data = new SlashCommandBuilder()
  .setName('reactionrole')
  .setDescription('Rollen durch Reaktionen verwalten')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
  .addSubcommand(subcommand =>
    subcommand
      .setName('create')
      .setDescription('Erstellt eine neue Reaktionsrolle-Nachricht')
      .addChannelOption(option =>
        option
          .setName('channel')
          .setDescription('Channel für die Nachricht')
          .setRequired(true)
      )
      .addStringOption(option =>
        option
          .setName('title')
          .setDescription('Titel der Nachricht')
          .setRequired(true)
      )
      .addStringOption(option =>
        option
          .setName('description')
          .setDescription('Beschreibung der Nachricht')
          .setRequired(true)
      )
      .addStringOption(option =>
        option
          .setName('color')
          .setDescription('Farbe der Nachricht (HEX-Code oder Name)')
          .setRequired(false)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('add')
      .setDescription('Fügt eine Rolle zu einer Reaktionsrolle-Nachricht hinzu')
      .addStringOption(option =>
        option
          .setName('message_id')
          .setDescription('ID der Nachricht')
          .setRequired(true)
      )
      .addRoleOption(option =>
        option
          .setName('role')
          .setDescription('Rolle, die vergeben werden soll')
          .setRequired(true)
      )
      .addStringOption(option =>
        option
          .setName('emoji')
          .setDescription('Emoji für die Reaktion')
          .setRequired(true)
      )
      .addStringOption(option =>
        option
          .setName('description')
          .setDescription('Beschreibung der Rolle')
          .setRequired(false)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('remove')
      .setDescription('Entfernt eine Reaktionsrolle')
      .addStringOption(option =>
        option
          .setName('message_id')
          .setDescription('ID der Nachricht')
          .setRequired(true)
      )
      .addStringOption(option =>
        option
          .setName('emoji')
          .setDescription('Emoji der zu entfernenden Reaktion')
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('list')
      .setDescription('Zeigt alle Reaktionsrollen an')
  );

export async function run({ interaction }: { interaction: ChatInputCommandInteraction }) {
  const subcommand = interaction.options.getSubcommand();

  switch (subcommand) {
    case 'create':
      await handleCreate(interaction);
      break;
    case 'add':
      await handleAdd(interaction);
      break;
    case 'remove':
      await handleRemove(interaction);
      break;
    case 'list':
      await handleList(interaction);
      break;
  }
}

async function handleCreate(interaction: ChatInputCommandInteraction) {
  const channel = interaction.options.getChannel('channel', true) as TextChannel;
  const title = interaction.options.getString('title', true);
  const description = interaction.options.getString('description', true);
  const color = interaction.options.getString('color') || '#3498db';
  const guild = interaction.guild!;

  await interaction.deferReply();

  try {
    // Erstelle Embed
    const embed = new EmbedBuilder()
      .setColor(color as ColorResolvable)
      .setTitle(title)
      .setDescription(description)
      .setFooter({ text: 'Klicke auf die Reaktionen, um Rollen zu erhalten oder zu entfernen' })
      .setTimestamp();

    // Sende Nachricht im angegebenen Channel
    const message = await channel.send({ embeds: [embed] });

    await interaction.editReply(`✅ Reaktionsrollen-Nachricht erstellt in ${channel} mit ID: \`${message.id}\``);
  } catch (error) {
    console.error('Fehler beim Erstellen der Reaktionsrollen-Nachricht:', error);
    await interaction.editReply('❌ Es ist ein Fehler aufgetreten. Bitte versuche es erneut.');
  }
}

async function handleAdd(interaction: ChatInputCommandInteraction) {
  const messageId = interaction.options.getString('message_id', true);
  const role = interaction.options.getRole('role', true);
  const emoji = interaction.options.getString('emoji', true);
  const description = interaction.options.getString('description') || '';
  const guild = interaction.guild!;

  await interaction.deferReply();

  try {
    // Überprüfe Berechtigungen
    const botMember = await guild.members.fetchMe();
    if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
      return interaction.editReply('❌ Ich benötige die Berechtigung "Rollen verwalten".');
    }

    // Finde die Nachricht in allen Kanälen
    let targetMessage;
    let targetChannel;

    const channels = await guild.channels.fetch();
    for (const [_, channel] of channels) {
      if (channel && channel.isTextBased() && !channel.isDMBased()) {
        try {
          const fetchedMessage = await (channel as TextChannel).messages.fetch(messageId);
          if (fetchedMessage) {
            targetMessage = fetchedMessage;
            targetChannel = channel;
            break;
          }
        } catch {
          // Ignorieren, wenn die Nachricht nicht gefunden wird
        }
      }
    }

    if (!targetMessage) {
      return interaction.editReply('❌ Die angegebene Nachricht wurde nicht gefunden.');
    }

    // Überprüfe, ob die Nachricht vom Bot stammt
    if (targetMessage.author.id !== guild.client.user!.id) {
      return interaction.editReply('❌ Die Nachricht muss vom Bot erstellt worden sein.');
    }

    // Erstelle den Reaction Role Eintrag
    await DatabaseService.createReactionRole({
      guildId: guild.id,
      channelId: targetChannel!.id,
      messageId: messageId,
      emoji: emoji,
      roleId: role.id
    });

    // Update die Nachricht mit den neuen Button
    const embed = EmbedBuilder.from(targetMessage.embeds[0]);
    
    // Sammle vorhandene Reaktionsrollen aus der Datenbank
    const reactionRoles = await DatabaseService.getReactionRoles(guild.id);
    const messageReactionRoles = reactionRoles.filter((rr: { messageId: string }) => rr.messageId === messageId);
    
    // Erstelle die Beschreibung der Rollen
    let rolesDescription = '';
    for (const rr of messageReactionRoles) {
      const fetchedRole = await guild.roles.fetch(rr.roleId);
      rolesDescription += `${rr.emoji} - ${fetchedRole}\n`;
      const description = (rr as any).description;
      if (description) rolesDescription += `> ${description}\n\n`;
    }
    
    if (rolesDescription) {
      embed.addFields({ name: 'Verfügbare Rollen', value: rolesDescription });
    }
    
    await targetMessage.edit({ embeds: [embed] });
    
    // Optional: Füge Reaktion zur Nachricht hinzu
    try {
      await targetMessage.react(emoji);
    } catch (error) {
      console.warn('Konnte Reaktion nicht hinzufügen. Eventuell ist das Emoji ungültig:', error);
      // Wir lassen den Befehl trotzdem weiterlaufen
    }

    await interaction.editReply(`✅ Reaktionsrolle hinzugefügt: ${emoji} für Rolle ${role}`);
  } catch (error) {
    console.error('Fehler beim Hinzufügen der Reaktionsrolle:', error);
    await interaction.editReply('❌ Es ist ein Fehler aufgetreten. Bitte versuche es erneut.');
  }
}

async function handleRemove(interaction: ChatInputCommandInteraction) {
  const messageId = interaction.options.getString('message_id', true);
  const emoji = interaction.options.getString('emoji', true);
  const guild = interaction.guild!;

  await interaction.deferReply();

  try {
    // Lösche den Eintrag aus der Datenbank
    await DatabaseService.deleteReactionRole(messageId, emoji);

    // Finde die Nachricht und entferne die Reaktion
    let targetMessage;
    let targetChannel;

    const channels = await guild.channels.fetch();
    for (const [_, channel] of channels) {
      if (channel && channel.isTextBased() && !channel.isDMBased()) {
        try {
          const fetchedMessage = await (channel as TextChannel).messages.fetch(messageId);
          if (fetchedMessage) {
            targetMessage = fetchedMessage;
            targetChannel = channel;
            break;
          }
        } catch {
          // Ignorieren, wenn die Nachricht nicht gefunden wird
        }
      }
    }

    if (targetMessage) {
      // Entferne die Reaktion
      const reactions = targetMessage.reactions.cache;
      for (const [key, reaction] of reactions) {
        if (key === emoji || reaction.emoji.name === emoji) {
          await reaction.remove();
          break;
        }
      }

      // Update die Nachricht
      const reactionRoles = await DatabaseService.getReactionRoles(guild.id);
      const messageReactionRoles = reactionRoles.filter((rr: { messageId: string }) => rr.messageId === messageId);
      
      const embed = EmbedBuilder.from(targetMessage.embeds[0]);
      
      // Entferne das alte Feld
      const fields = embed.data.fields || [];
      const updatedFields = fields.filter(field => field.name !== 'Verfügbare Rollen');
      embed.setFields(updatedFields);
      
      // Erstelle die Beschreibung der verbleibenden Rollen
      if (messageReactionRoles.length > 0) {
        let rolesDescription = '';
        for (const rr of messageReactionRoles) {
          const fetchedRole = await guild.roles.fetch(rr.roleId);
          rolesDescription += `${rr.emoji} - ${fetchedRole}\n`;
          const description = (rr as any).description;
          if (description) rolesDescription += `> ${description}\n\n`;
        }
        
        if (rolesDescription) {
          embed.addFields({ name: 'Verfügbare Rollen', value: rolesDescription });
        }
      }
      
      await targetMessage.edit({ embeds: [embed] });
    }

    await interaction.editReply(`✅ Reaktionsrolle mit Emoji ${emoji} wurde entfernt.`);
  } catch (error) {
    console.error('Fehler beim Entfernen der Reaktionsrolle:', error);
    await interaction.editReply('❌ Es ist ein Fehler aufgetreten. Bitte versuche es erneut.');
  }
}

async function handleList(interaction: ChatInputCommandInteraction) {
  const guild = interaction.guild!;

  await interaction.deferReply();

  try {
    const reactionRoles = await DatabaseService.getReactionRoles(guild.id);

    if (reactionRoles.length === 0) {
      return interaction.editReply('❌ Es wurden keine Reaktionsrollen gefunden.');
    }

    // Gruppiere nach Nachrichten
    const messageGroups: Record<string, typeof reactionRoles> = {};
    for (const rr of reactionRoles) {
      if (!messageGroups[rr.messageId]) {
        messageGroups[rr.messageId] = [];
      }
      messageGroups[rr.messageId].push(rr);
    }

    const embed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle('📝 Reaktionsrollen')
      .setDescription(`Hier ist eine Liste aller ${reactionRoles.length} Reaktionsrollen auf diesem Server.`)
      .setTimestamp();

    for (const [messageId, roles] of Object.entries(messageGroups)) {
      if (roles.length === 0) continue;

      const channel = await guild.channels.fetch(roles[0].channelId).catch(() => null);
      const channelName = channel ? `#${(channel as TextChannel).name}` : 'Unbekannter Channel';

      let rolesDescription = '';
      for (const rr of roles) {
        const role = await guild.roles.fetch(rr.roleId).catch(() => null);
        const roleName = role ? role.name : 'Unbekannte Rolle';
        rolesDescription += `${rr.emoji} - ${roleName}\n`;
      }

      embed.addFields({
        name: `Nachricht: ${messageId} (${channelName})`,
        value: rolesDescription || 'Keine Rollen',
        inline: false
      });
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Fehler beim Abrufen der Reaktionsrollen:', error);
    await interaction.editReply('❌ Es ist ein Fehler aufgetreten. Bitte versuche es erneut.');
  }
} 