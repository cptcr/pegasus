import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  EmbedBuilder, 
  PermissionFlagsBits,
  User,
  GuildMember
} from 'discord.js';
import { DatabaseService } from '../../lib/database';

export const data = new SlashCommandBuilder()
  .setName('warn')
  .setDescription('Warn-System Befehle')
  .addSubcommand(subcommand =>
    subcommand
      .setName('add')
      .setDescription('Einen Benutzer warnen')
      .addUserOption(option =>
        option
          .setName('user')
          .setDescription('Der Benutzer, der gewarnt werden soll')
          .setRequired(true)
      )
      .addStringOption(option =>
        option
          .setName('reason')
          .setDescription('Grund für die Warnung')
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('list')
      .setDescription('Warnungen eines Benutzers anzeigen')
      .addUserOption(option =>
        option
          .setName('user')
          .setDescription('Der Benutzer dessen Warnungen angezeigt werden sollen')
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('remove')
      .setDescription('Eine Warnung entfernen')
      .addIntegerOption(option =>
        option
          .setName('id')
          .setDescription('Die ID der Warnung')
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('clear')
      .setDescription('Alle Warnungen eines Benutzers löschen')
      .addUserOption(option =>
        option
          .setName('user')
          .setDescription('Der Benutzer dessen Warnungen gelöscht werden sollen')
          .setRequired(true)
      )
  );

export async function run({ interaction }: { interaction: ChatInputCommandInteraction }) {
  // Prüfung der Berechtigung
  const member = interaction.member as GuildMember;
  if (!member.permissions.has(PermissionFlagsBits.ManageMessages)) {
    return interaction.reply({
      content: '❌ Du hast keine Berechtigung, diesen Befehl zu verwenden.',
      ephemeral: true,
    });
  }

  const subcommand = interaction.options.getSubcommand();

  switch (subcommand) {
    case 'add':
      await handleAddWarn(interaction);
      break;
    case 'list':
      await handleListWarns(interaction);
      break;
    case 'remove':
      await handleRemoveWarn(interaction);
      break;
    case 'clear':
      await handleClearWarns(interaction);
      break;
  }
}

async function handleAddWarn(interaction: ChatInputCommandInteraction) {
  const user = interaction.options.getUser('user', true);
  const reason = interaction.options.getString('reason', true);
  const moderator = interaction.user;
  const guild = interaction.guild!;

  // Prüfung der Rollenhierarchie
  const targetMember = await guild.members.fetch(user.id).catch(() => null);
  const moderatorMember = interaction.member as GuildMember;

  if (targetMember && moderatorMember.roles.highest.position <= targetMember.roles.highest.position) {
    return interaction.reply({
      content: '❌ Du kannst keine Benutzer warnen, die eine höhere oder gleiche Rolle haben.',
      ephemeral: true,
    });
  }

  try {
    // User in Datenbank erstellen/aktualisieren
    await DatabaseService.getOrCreateUser(user.id, user.username);
    await DatabaseService.getOrCreateUser(moderator.id, moderator.username);

    // Warnung hinzufügen
    const warn = await DatabaseService.addWarn({
      userId: user.id,
      guildId: guild.id,
      moderatorId: moderator.id,
      reason,
    });

    // Anzahl aktiver Warnungen abrufen
    const activeWarns = await DatabaseService.getActiveWarns(user.id, guild.id);

    const embed = new EmbedBuilder()
      .setColor(0xff9900)
      .setTitle('⚠️ Warnung ausgesprochen')
      .setDescription(`${user} wurde gewarnt.`)
      .addFields(
        { name: 'Grund', value: reason, inline: false },
        { name: 'Moderator', value: moderator.toString(), inline: true },
        { name: 'Warn-ID', value: warn.id.toString(), inline: true },
        { name: 'Aktive Warnungen', value: activeWarns.length.toString(), inline: true }
      )
      .setTimestamp()
      .setFooter({ text: `Benutzer-ID: ${user.id}` });

    await interaction.reply({ embeds: [embed] });

    // DM an den gewarnten Benutzer senden
    try {
      const dmEmbed = new EmbedBuilder()
        .setColor(0xff9900)
        .setTitle('⚠️ Du wurdest gewarnt')
        .setDescription(`Du wurdest auf dem Server **${guild.name}** gewarnt.`)
        .addFields(
          { name: 'Grund', value: reason, inline: false },
          { name: 'Aktive Warnungen', value: activeWarns.length.toString(), inline: true }
        )
        .setTimestamp();

      await user.send({ embeds: [dmEmbed] });
    } catch (error) {
      // DM konnte nicht gesendet werden - ignorieren
    }

  } catch (error) {
    console.error('Fehler beim Hinzufügen der Warnung:', error);
    await interaction.reply({
      content: '❌ Ein Fehler ist aufgetreten beim Hinzufügen der Warnung.',
      ephemeral: true,
    });
  }
}

async function handleListWarns(interaction: ChatInputCommandInteraction) {
  const user = interaction.options.getUser('user', true);
  const guild = interaction.guild!;

  try {
    const warns = await DatabaseService.getActiveWarns(user.id, guild.id);

    if (warns.length === 0) {
      return interaction.reply({
        content: `${user} hat keine aktiven Warnungen.`,
        ephemeral: true,
      });
    }

    const embed = new EmbedBuilder()
      .setColor(0xff9900)
      .setTitle(`⚠️ Warnungen für ${user.username}`)
      .setDescription(`Insgesamt ${warns.length} aktive Warnung(en)`)
      .setThumbnail(user.displayAvatarURL())
      .setTimestamp();

    warns.slice(0, 10).forEach((warn, index) => {
      embed.addFields({
        name: `Warnung #${warn.id}`,
        value: `**Grund:** ${warn.reason}\n**Moderator:** ${warn.moderator.username}\n**Datum:** <t:${Math.floor(warn.createdAt.getTime() / 1000)}:R>`,
        inline: false,
      });
    });

    if (warns.length > 10) {
      embed.setFooter({ text: `Zeige die neuesten 10 von ${warns.length} Warnungen` });
    }

    await interaction.reply({ embeds: [embed], ephemeral: true });

  } catch (error) {
    console.error('Fehler beim Abrufen der Warnungen:', error);
    await interaction.reply({
      content: '❌ Ein Fehler ist aufgetreten beim Abrufen der Warnungen.',
      ephemeral: true,
    });
  }
}

async function handleRemoveWarn(interaction: ChatInputCommandInteraction) {
  const warnId = interaction.options.getInteger('id', true);
  const moderator = interaction.user;

  try {
    await DatabaseService.removeWarn(warnId);

    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle('✅ Warnung entfernt')
      .setDescription(`Warnung #${warnId} wurde erfolgreich entfernt.`)
      .addFields(
        { name: 'Moderator', value: moderator.toString(), inline: true }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });

  } catch (error) {
    console.error('Fehler beim Entfernen der Warnung:', error);
    await interaction.reply({
      content: '❌ Ein Fehler ist aufgetreten beim Entfernen der Warnung. Überprüfe die Warn-ID.',
      ephemeral: true,
    });
  }
}

async function handleClearWarns(interaction: ChatInputCommandInteraction) {
  const user = interaction.options.getUser('user', true);
  const moderator = interaction.user;
  const guild = interaction.guild!;

  try {
    const activeWarns = await DatabaseService.getActiveWarns(user.id, guild.id);
    
    if (activeWarns.length === 0) {
      return interaction.reply({
        content: `${user} hat keine aktiven Warnungen zum Löschen.`,
        ephemeral: true,
      });
    }

    await DatabaseService.clearWarns(user.id, guild.id);

    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle('✅ Warnungen gelöscht')
      .setDescription(`Alle ${activeWarns.length} aktive(n) Warnung(en) für ${user} wurden entfernt.`)
      .addFields(
        { name: 'Moderator', value: moderator.toString(), inline: true }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });

  } catch (error) {
    console.error('Fehler beim Löschen der Warnungen:', error);
    await interaction.reply({
      content: '❌ Ein Fehler ist aufgetreten beim Löschen der Warnungen.',
      ephemeral: true,
    });
  }
}

export const options = {
  userPermissions: [PermissionFlagsBits.ManageMessages],
  botPermissions: [PermissionFlagsBits.SendMessages],
};