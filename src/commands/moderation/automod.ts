import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  EmbedBuilder,
  PermissionFlagsBits
} from 'discord.js';
import { DatabaseService } from '../../lib/database';

export const data = new SlashCommandBuilder()
  .setName('automod')
  .setDescription('Automatische Moderation konfigurieren')
  .addSubcommand(subcommand =>
    subcommand
      .setName('setup')
      .setDescription('Automod-System einrichten')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('rule')
      .setDescription('Neue Automod-Regel erstellen')
      .addStringOption(option =>
        option
          .setName('type')
          .setDescription('Regeltyp')
          .setRequired(true)
          .addChoices(
            { name: 'Spam-Schutz', value: 'SPAM' },
            { name: 'Caps Lock', value: 'CAPS' },
            { name: 'Zu viele Mentions', value: 'MENTIONS' },
            { name: 'Links blockieren', value: 'LINKS' },
            { name: 'Discord Invites', value: 'INVITES' },
            { name: 'Schimpfwörter', value: 'PROFANITY' },
            { name: 'Wiederholter Text', value: 'REPEATED_TEXT' },
            { name: 'Zalgo Text', value: 'ZALGO' },
            { name: 'Emoji Spam', value: 'EMOJI_SPAM' }
          )
      )
      .addStringOption(option =>
        option
          .setName('name')
          .setDescription('Name der Regel')
          .setRequired(true)
      )
      .addStringOption(option =>
        option
          .setName('action')
          .setDescription('Aktion bei Verstoß')
          .setRequired(true)
          .addChoices(
            { name: 'Nachricht löschen', value: 'DELETE' },
            { name: 'Warnung geben', value: 'WARN' },
            { name: 'Timeout (1h)', value: 'TIMEOUT_1H' },
            { name: 'Timeout (24h)', value: 'TIMEOUT_24H' },
            { name: 'Kick', value: 'KICK' },
            { name: 'Ban', value: 'BAN' }
          )
      )
      .addIntegerOption(option =>
        option
          .setName('threshold')
          .setDescription('Schwellenwert (z.B. Anzahl Nachrichten für Spam)')
          .setMinValue(1)
          .setMaxValue(50)
          .setRequired(false)
      )
      .addIntegerOption(option =>
        option
          .setName('timeframe')
          .setDescription('Zeitraum in Sekunden (für Spam-Erkennung)')
          .setMinValue(5)
          .setMaxValue(300)
          .setRequired(false)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('list')
      .setDescription('Alle Automod-Regeln anzeigen')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('toggle')
      .setDescription('Regel aktivieren/deaktivieren')
      .addIntegerOption(option =>
        option
          .setName('id')
          .setDescription('Regel-ID')
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('delete')
      .setDescription('Regel löschen')
      .addIntegerOption(option =>
        option
          .setName('id')
          .setDescription('Regel-ID')
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('whitelist')
      .setDescription('Rolle oder Channel von Automod ausschließen')
      .addIntegerOption(option =>
        option
          .setName('rule_id')
          .setDescription('Regel-ID')
          .setRequired(true)
      )
      .addRoleOption(option =>
        option
          .setName('role')
          .setDescription('Rolle ausschließen')
          .setRequired(false)
      )
      .addChannelOption(option =>
        option
          .setName('channel')
          .setDescription('Channel ausschließen')
          .setRequired(false)
      )
  );

export async function run({ interaction }: { interaction: ChatInputCommandInteraction }) {
  // Admin-Berechtigung prüfen
  const member = interaction.member as any;
  if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({
      content: '❌ Du benötigst Administrator-Berechtigung für diesen Befehl.',
      ephemeral: true,
    });
  }

  const subcommand = interaction.options.getSubcommand();

  switch (subcommand) {
    case 'setup':
      await handleSetup(interaction);
      break;
    case 'rule':
      await handleCreateRule(interaction);
      break;
    case 'list':
      await handleListRules(interaction);
      break;
    case 'toggle':
      await handleToggleRule(interaction);
      break;
    case 'delete':
      await handleDeleteRule(interaction);
      break;
    case 'whitelist':
      await handleWhitelist(interaction);
      break;
  }
}

async function handleSetup(interaction: ChatInputCommandInteraction) {
  const guild = interaction.guild!;

  await interaction.deferReply();

  try {
    // Guild-Einstellungen aktualisieren
    await DatabaseService.updateGuildSettings(guild.id, {
      enableAutomod: true,
      name: guild.name
    });

    // Standard-Regeln erstellen
    const defaultRules = [
      {
        name: 'Spam-Schutz',
        type: 'SPAM',
        trigger: { threshold: 5, timeframe: 10 },
        action: { type: 'DELETE', warn: true }
      },
      {
        name: 'Caps Lock Limit',
        type: 'CAPS',
        trigger: { percentage: 70, minLength: 10 },
        action: { type: 'DELETE' }
      },
      {
        name: 'Mention-Spam',
        type: 'MENTIONS',
        trigger: { threshold: 5 },
        action: { type: 'DELETE', warn: true }
      },
      {
        name: 'Discord Invites',
        type: 'INVITES',
        trigger: {},
        action: { type: 'DELETE', warn: true }
      }
    ];

    for (const rule of defaultRules) {
      await DatabaseService.createAutomodRule({
        guildId: guild.id,
        name: rule.name,
        type: rule.type as any,
        trigger: rule.trigger,
        action: rule.action
      });
    }

    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle('✅ Automod-System eingerichtet')
      .setDescription('Das automatische Moderationssystem wurde erfolgreich aktiviert!')
      .addFields(
        { name: '🛡️ Standard-Regeln', value: `${defaultRules.length} Regeln erstellt`, inline: true },
        { name: '🔧 Status', value: 'Aktiviert', inline: true },
        { name: '📖 Verwendung', value: 'Verwende `/automod list` um alle Regeln zu sehen', inline: false }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

  } catch (error) {
    console.error('Fehler beim Einrichten des Automod-Systems:', error);
    await interaction.editReply({
      content: '❌ Ein Fehler ist aufgetreten beim Einrichten des Systems.',
    });
  }
}

async function handleCreateRule(interaction: ChatInputCommandInteraction) {
  const type = interaction.options.getString('type', true) as any;
  const name = interaction.options.getString('name', true);
  const action = interaction.options.getString('action', true);
  const threshold = interaction.options.getInteger('threshold');
  const timeframe = interaction.options.getInteger('timeframe');
  const guild = interaction.guild!;

  await interaction.deferReply();

  try {
    // Trigger-Konfiguration basierend auf Typ
    const trigger: any = {};
    const actionConfig: any = { type: action };

    switch (type) {
      case 'SPAM':
        trigger.threshold = threshold || 5;
        trigger.timeframe = timeframe || 10;
        break;
      case 'CAPS':
        trigger.percentage = threshold || 70;
        trigger.minLength = 10;
        break;
      case 'MENTIONS':
        trigger.threshold = threshold || 5;
        break;
      case 'REPEATED_TEXT':
        trigger.threshold = threshold || 3;
        break;
      case 'EMOJI_SPAM':
        trigger.threshold = threshold || 10;
        break;
    }

    // Warnung hinzufügen wenn gewünscht
    if (['WARN', 'TIMEOUT_1H', 'TIMEOUT_24H', 'KICK', 'BAN'].includes(action)) {
      actionConfig.warn = true;
    }

    const rule = await DatabaseService.createAutomodRule({
      guildId: guild.id,
      name,
      type,
      trigger,
      action: actionConfig
    });

    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle('✅ Automod-Regel erstellt')
      .setDescription(`Die Regel "${name}" wurde erfolgreich erstellt.`)
      .addFields(
        { name: '🆔 Regel-ID', value: rule.id.toString(), inline: true },
        { name: '📋 Typ', value: getTypeDisplayName(type), inline: true },
        { name: '⚡ Aktion', value: getActionDisplayName(action), inline: true }
      )
      .setTimestamp();

    if (Object.keys(trigger).length > 0) {
      embed.addFields({
        name: '🎯 Auslöser',
        value: Object.entries(trigger).map(([key, value]) => `${key}: ${value}`).join('\n'),
        inline: false
      });
    }

    await interaction.editReply({ embeds: [embed] });

  } catch (error) {
    console.error('Fehler beim Erstellen der Automod-Regel:', error);
    await interaction.editReply({
      content: '❌ Ein Fehler ist aufgetreten beim Erstellen der Regel.',
    });
  }
}

async function handleListRules(interaction: ChatInputCommandInteraction) {
  const guild = interaction.guild!;

  await interaction.deferReply();

  try {
    const rules = await DatabaseService.getAutomodRules(guild.id);

    if (rules.length === 0) {
      return interaction.editReply({
        content: '📋 Keine Automod-Regeln konfiguriert. Verwende `/automod setup` um Standard-Regeln zu erstellen.',
      });
    }

    const embed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle('🛡️ Automod-Regeln')
      .setDescription(`${rules.length} Regel(n) konfiguriert`)
      .setTimestamp();

    rules.slice(0, 10).forEach((rule, index) => {
      const status = rule.enabled ? '🟢 Aktiv' : '🔴 Inaktiv';
      const action = getActionDisplayName((rule.action as any).type);
      
      embed.addFields({
        name: `${index + 1}. ${rule.name} (ID: ${rule.id})`,
        value: `**Typ:** ${getTypeDisplayName(rule.type)}\n**Aktion:** ${action}\n**Status:** ${status}`,
        inline: true
      });
    });

    if (rules.length > 10) {
      embed.setFooter({ text: `Zeige die ersten 10 von ${rules.length} Regeln` });
    }

    await interaction.editReply({ embeds: [embed] });

  } catch (error) {
    console.error('Fehler beim Laden der Automod-Regeln:', error);
    await interaction.editReply({
      content: '❌ Ein Fehler ist aufgetreten beim Laden der Regeln.',
    });
  }
}

async function handleToggleRule(interaction: ChatInputCommandInteraction) {
  const ruleId = interaction.options.getInteger('id', true);
  const guild = interaction.guild!;

  await interaction.deferReply();

  try {
    // Regel finden und Status umschalten
    const rules = await DatabaseService.getAutomodRules(guild.id);
    const rule = rules.find(r => r.id === ruleId);

    if (!rule) {
      return interaction.editReply({
        content: '❌ Regel nicht gefunden.',
      });
    }

    const newStatus = !rule.enabled;
    await DatabaseService.updateAutomodRule(ruleId, { enabled: newStatus });

    const embed = new EmbedBuilder()
      .setColor(newStatus ? 0x00ff00 : 0xff6b35)
      .setTitle(newStatus ? '✅ Regel aktiviert' : '⏸️ Regel deaktiviert')
      .setDescription(`Die Regel "${rule.name}" wurde ${newStatus ? 'aktiviert' : 'deaktiviert'}.`)
      .addFields(
        { name: '🆔 Regel-ID', value: rule.id.toString(), inline: true },
        { name: '📋 Typ', value: getTypeDisplayName(rule.type), inline: true },
        { name: '🔧 Status', value: newStatus ? '🟢 Aktiv' : '🔴 Inaktiv', inline: true }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

  } catch (error) {
    console.error('Fehler beim Umschalten der Regel:', error);
    await interaction.editReply({
      content: '❌ Ein Fehler ist aufgetreten beim Umschalten der Regel.',
    });
  }
}

async function handleDeleteRule(interaction: ChatInputCommandInteraction) {
  const ruleId = interaction.options.getInteger('id', true);
  const guild = interaction.guild!;

  await interaction.deferReply();

  try {
    const rules = await DatabaseService.getAutomodRules(guild.id);
    const rule = rules.find(r => r.id === ruleId);

    if (!rule) {
      return interaction.editReply({
        content: '❌ Regel nicht gefunden.',
      });
    }

    await DatabaseService.deleteAutomodRule(ruleId);

    const embed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle('🗑️ Regel gelöscht')
      .setDescription(`Die Regel "${rule.name}" wurde erfolgreich gelöscht.`)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

  } catch (error) {
    console.error('Fehler beim Löschen der Regel:', error);
    await interaction.editReply({
      content: '❌ Ein Fehler ist aufgetreten beim Löschen der Regel.',
    });
  }
}

async function handleWhitelist(interaction: ChatInputCommandInteraction) {
  const ruleId = interaction.options.getInteger('rule_id', true);
  const role = interaction.options.getRole('role');
  const channel = interaction.options.getChannel('channel');
  const guild = interaction.guild!;

  if (!role && !channel) {
    return interaction.reply({
      content: '❌ Du musst entweder eine Rolle oder einen Channel angeben.',
      ephemeral: true,
    });
  }

  await interaction.deferReply();

  try {
    const rules = await DatabaseService.getAutomodRules(guild.id);
    const rule = rules.find(r => r.id === ruleId);

    if (!rule) {
      return interaction.editReply({
        content: '❌ Regel nicht gefunden.',
      });
    }

    const exemptRoles = [...(rule.exemptRoles || [])];
    const exemptChannels = [...(rule.exemptChannels || [])];

    if (role) {
      if (!exemptRoles.includes(role.id)) {
        exemptRoles.push(role.id);
      }
    }

    if (channel) {
      if (!exemptChannels.includes(channel.id)) {
        exemptChannels.push(channel.id);
      }
    }

    await DatabaseService.updateAutomodRule(ruleId, {
      exemptRoles,
      exemptChannels
    });

    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle('✅ Whitelist aktualisiert')
      .setDescription(`Die Ausnahmen für Regel "${rule.name}" wurden aktualisiert.`)
      .addFields(
        { name: '🛡️ Ausgeschlossene Rollen', value: exemptRoles.length > 0 ? exemptRoles.map(id => `<@&${id}>`).join('\n') : 'Keine', inline: true },
        { name: '📺 Ausgeschlossene Channels', value: exemptChannels.length > 0 ? exemptChannels.map(id => `<#${id}>`).join('\n') : 'Keine', inline: true }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

  } catch (error) {
    console.error('Fehler beim Aktualisieren der Whitelist:', error);
    await interaction.editReply({
      content: '❌ Ein Fehler ist aufgetreten beim Aktualisieren der Whitelist.',
    });
  }
}

function getTypeDisplayName(type: string): string {
  const types: Record<string, string> = {
    SPAM: 'Spam-Schutz',
    CAPS: 'Caps Lock',
    MENTIONS: 'Mention-Spam',
    LINKS: 'Link-Filter',
    INVITES: 'Discord Invites',
    PROFANITY: 'Schimpfwörter',
    REPEATED_TEXT: 'Wiederholter Text',
    ZALGO: 'Zalgo Text',
    EMOJI_SPAM: 'Emoji Spam'
  };
  return types[type] || type;
}

function getActionDisplayName(action: string): string {
  const actions: Record<string, string> = {
    DELETE: 'Nachricht löschen',
    WARN: 'Warnung geben',
    TIMEOUT_1H: 'Timeout (1h)',
    TIMEOUT_24H: 'Timeout (24h)',
    KICK: 'Kick',
    BAN: 'Ban'
  };
  return actions[action] || action;
}

export const options = {
  userPermissions: [PermissionFlagsBits.Administrator],
  botPermissions: ['SendMessages', 'ManageMessages', 'ModerateMembers'],
};