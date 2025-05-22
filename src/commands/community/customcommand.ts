import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits
} from 'discord.js';
import { DatabaseService } from '../../lib/database';

export const data = new SlashCommandBuilder()
  .setName('command')
  .setDescription('Benutzerdefinierte Befehle verwalten')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
  .addSubcommand(subcommand =>
    subcommand
      .setName('create')
      .setDescription('Erstellt einen benutzerdefinierten Befehl')
      .addStringOption(option =>
        option
          .setName('name')
          .setDescription('Name des Befehls (ohne Prefix)')
          .setRequired(true)
      )
      .addStringOption(option =>
        option
          .setName('response')
          .setDescription('Antwort des Bots')
          .setRequired(true)
      )
      .addStringOption(option =>
        option
          .setName('description')
          .setDescription('Beschreibung des Befehls')
          .setRequired(false)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('delete')
      .setDescription('Löscht einen benutzerdefinierten Befehl')
      .addStringOption(option =>
        option
          .setName('name')
          .setDescription('Name des Befehls')
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('list')
      .setDescription('Zeigt alle benutzerdefinierten Befehle an')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('edit')
      .setDescription('Bearbeitet einen benutzerdefinierten Befehl')
      .addStringOption(option =>
        option
          .setName('name')
          .setDescription('Name des Befehls')
          .setRequired(true)
      )
      .addStringOption(option =>
        option
          .setName('response')
          .setDescription('Neue Antwort des Bots')
          .setRequired(true)
      )
      .addStringOption(option =>
        option
          .setName('description')
          .setDescription('Neue Beschreibung des Befehls')
          .setRequired(false)
      )
  );

export async function run({ interaction }: { interaction: ChatInputCommandInteraction }) {
  const subcommand = interaction.options.getSubcommand();
  const guild = interaction.guild!;

  switch (subcommand) {
    case 'create':
      await handleCreate(interaction);
      break;
    case 'delete':
      await handleDelete(interaction);
      break;
    case 'list':
      await handleList(interaction);
      break;
    case 'edit':
      await handleEdit(interaction);
      break;
  }
}

async function handleCreate(interaction: ChatInputCommandInteraction) {
  const name = interaction.options.getString('name', true).toLowerCase();
  const response = interaction.options.getString('response', true);
  const description = interaction.options.getString('description') || 'Kein Beschreibung';
  const guild = interaction.guild!;
  const creator = interaction.user;

  await interaction.deferReply();

  try {
    // Prüfen ob der Befehl bereits existiert
    const existingCommand = await DatabaseService.getCustomCommand(guild.id, name);
    if (existingCommand) {
      return interaction.editReply(`❌ Der Befehl \`${name}\` existiert bereits. Benutze \`/command edit\` um ihn zu bearbeiten.`);
    }

    // Validierung
    if (name.length > 32) {
      return interaction.editReply('❌ Der Befehlsname darf maximal 32 Zeichen lang sein.');
    }

    if (response.length > 2000) {
      return interaction.editReply('❌ Die Antwort darf maximal 2000 Zeichen lang sein.');
    }

    // Reservierte Befehle
    const reservedCommands = ['help', 'command', 'commands', 'create', 'delete', 'list', 'edit', 'admin', 'mod', 'level'];
    if (reservedCommands.includes(name)) {
      return interaction.editReply(`❌ Der Name \`${name}\` ist für Systembefehle reserviert.`);
    }

    // Befehl erstellen
    await DatabaseService.createCustomCommand({
      guildId: guild.id,
      name,
      response,
      description,
      creatorId: creator.id
    });

    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle('✅ Befehl erstellt')
      .setDescription(`Der Befehl \`${name}\` wurde erfolgreich erstellt.`)
      .addFields(
        { name: 'Antwort', value: response, inline: false },
        { name: 'Beschreibung', value: description, inline: false },
        { name: 'Ersteller', value: creator.toString(), inline: true }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Fehler beim Erstellen des Befehls:', error);
    await interaction.editReply('❌ Es ist ein Fehler aufgetreten. Bitte versuche es erneut.');
  }
}

async function handleDelete(interaction: ChatInputCommandInteraction) {
  const name = interaction.options.getString('name', true).toLowerCase();
  const guild = interaction.guild!;

  await interaction.deferReply();

  try {
    const existingCommand = await DatabaseService.getCustomCommand(guild.id, name);
    if (!existingCommand) {
      return interaction.editReply(`❌ Der Befehl \`${name}\` existiert nicht.`);
    }

    await DatabaseService.deleteCustomCommand(guild.id, name);

    const embed = new EmbedBuilder()
      .setColor(0xff3333)
      .setTitle('✅ Befehl gelöscht')
      .setDescription(`Der Befehl \`${name}\` wurde erfolgreich gelöscht.`)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Fehler beim Löschen des Befehls:', error);
    await interaction.editReply('❌ Es ist ein Fehler aufgetreten. Bitte versuche es erneut.');
  }
}

async function handleList(interaction: ChatInputCommandInteraction) {
  const guild = interaction.guild!;

  await interaction.deferReply();

  try {
    const commands = await DatabaseService.getCustomCommands(guild.id);

    if (commands.length === 0) {
      return interaction.editReply('❌ Es wurden keine benutzerdefinierten Befehle gefunden.');
    }

    const embed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle('📝 Benutzerdefinierte Befehle')
      .setDescription(`Hier ist eine Liste aller ${commands.length} benutzerdefinierten Befehle für diesen Server.`)
      .setTimestamp();

    // Gruppen für Pagination
    const commandGroups = [];
    for (let i = 0; i < commands.length; i += 10) {
      commandGroups.push(commands.slice(i, i + 10));
    }

    // Zeige die ersten 10 Befehle
    const commandList = commandGroups[0]
      .map(cmd => `\`${cmd.name}\` - ${cmd.description} (${cmd.uses} Nutzungen)`)
      .join('\n');

    embed.addFields({ name: 'Befehle', value: commandList });

    // Pagination Info
    if (commandGroups.length > 1) {
      embed.setFooter({ text: `Seite 1/${commandGroups.length} • Insgesamt ${commands.length} Befehle` });
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Fehler beim Abrufen der Befehle:', error);
    await interaction.editReply('❌ Es ist ein Fehler aufgetreten. Bitte versuche es erneut.');
  }
}

async function handleEdit(interaction: ChatInputCommandInteraction) {
  const name = interaction.options.getString('name', true).toLowerCase();
  const newResponse = interaction.options.getString('response', true);
  const newDescription = interaction.options.getString('description');
  const guild = interaction.guild!;

  await interaction.deferReply();

  try {
    const existingCommand = await DatabaseService.getCustomCommand(guild.id, name);
    if (!existingCommand) {
      return interaction.editReply(`❌ Der Befehl \`${name}\` existiert nicht.`);
    }

    // Validierung
    if (newResponse.length > 2000) {
      return interaction.editReply('❌ Die Antwort darf maximal 2000 Zeichen lang sein.');
    }

    // Befehl aktualisieren
    const updateData: any = {
      response: newResponse,
    };

    if (newDescription) {
      updateData.description = newDescription;
    }

    await DatabaseService.updateCustomCommand(guild.id, name, updateData);

    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle('✅ Befehl bearbeitet')
      .setDescription(`Der Befehl \`${name}\` wurde erfolgreich bearbeitet.`)
      .addFields(
        { name: 'Neue Antwort', value: newResponse, inline: false }
      )
      .setTimestamp();

    if (newDescription) {
      embed.addFields({ name: 'Neue Beschreibung', value: newDescription, inline: false });
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Fehler beim Bearbeiten des Befehls:', error);
    await interaction.editReply('❌ Es ist ein Fehler aufgetreten. Bitte versuche es erneut.');
  }
} 