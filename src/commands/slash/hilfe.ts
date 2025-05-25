import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { SlashCommand, ClientWithCommands, PrefixCommand } from '../../types';

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('hilfe')
    .setDescription('Zeigt eine Liste aller verfügbaren Befehle oder Informationen zu einem bestimmten Befehl.')
    .addStringOption(option =>
      option.setName('befehl')
        .setDescription('Der Befehl, zu dem du Hilfe benötigst.')
        .setRequired(false)),
  enabled: true,
  category: 'utility',
  async execute(interaction: ChatInputCommandInteraction, client: ClientWithCommands) {
    const commandName = interaction.options.getString('befehl');
    const guildSettings = await client.prisma.guild.findUnique({ where: { id: interaction.guildId! } });
    const prefix = guildSettings?.prefix || client.config.defaultPrefix;

    if (commandName) {
      const slashCmd = client.slashCommands.get(commandName.toLowerCase());
      const prefixCmd = client.commands.get(commandName.toLowerCase());

      let cmd: SlashCommand | PrefixCommand | undefined = slashCmd || prefixCmd;

      if (!cmd || (cmd as any).enabled === false) {
        await interaction.reply({ content: `❌ Der Befehl \`${commandName}\` wurde nicht gefunden oder ist deaktiviert.`, ephemeral: true });
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTimestamp();

      if ('data' in cmd) { // Slash Command
        embed.setTitle(`Hilfe für: \`/${cmd.data.name}\``)
             .setDescription(cmd.data.description || 'Keine Beschreibung verfügbar.');
        if (cmd.usage) {
             embed.addFields({ name: 'Verwendung', value: `\`/${cmd.data.name} ${cmd.usage}\`` });
        }
      } else { // Prefix Command
        embed.setTitle(`Hilfe für: \`${prefix}${cmd.name}\``)
             .setDescription(cmd.description || 'Keine Beschreibung verfügbar.');
        if (cmd.usage) {
             embed.addFields({ name: 'Verwendung', value: `\`${prefix}${cmd.usage}\`` });
        }
        if (cmd.aliases && cmd.aliases.length > 0) {
          embed.addFields({ name: 'Aliase', value: cmd.aliases.map(a => `\`${prefix}${a}\``).join(', ') });
        }
      }
      
      if (cmd.category) {
        embed.addFields({ name: 'Kategorie', value: cmd.category });
      }
      if (cmd.cooldown) {
        embed.addFields({ name: 'Cooldown', value: `${cmd.cooldown} Sekunden` });
      }


      await interaction.reply({ embeds: [embed], ephemeral: true });

    } else {
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('Pegasus Bot Hilfe')
        .setDescription(`Hier ist eine Liste aller verfügbaren Slash-Befehle. Für detaillierte Informationen zu einem bestimmten Befehl, verwende \`/hilfe <Befehlsname>\`.\nDer aktuelle Präfix für textbasierte Befehle ist: \`${prefix}\``)
        .setTimestamp()
        .setFooter({ text: `Angefordert von ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() || undefined });

      const slashCategories: { [key: string]: string[] } = {};
      client.slashCommands.forEach(cmd => {
        if (cmd.enabled === false || (cmd.testOnly && !client.config.devGuilds.includes(interaction.guildId || ''))) return;
        const category = cmd.category || 'Sonstige';
        if (!slashCategories[category]) {
          slashCategories[category] = [];
        }
        slashCategories[category].push(`\`/${cmd.data.name}\` - ${cmd.data.description}`);
      });

      for (const category in slashCategories) {
        if (slashCategories[category].length > 0) {
          embed.addFields({ name: `Kategorie: ${category} (Slash)`, value: slashCategories[category].join('\n') });
        }
      }
      
      const prefixCategories: { [key: string]: string[] } = {};
       client.commands.filter(cmd => !cmd.aliases?.includes(cmd.name) && cmd.enabled !== false).forEach(cmd => {
        const category = cmd.category || 'Sonstige';
        if (!prefixCategories[category]) {
          prefixCategories[category] = [];
        }
        prefixCategories[category].push(`\`${prefix}${cmd.name}\` - ${cmd.description}`);
      });

      if (Object.keys(prefixCategories).length > 0) {
           embed.addFields({name: "Textbasierte Befehle", value: `Nutze \`${prefix}hilfe\` für eine detaillierte Liste.`})
      }

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }
};

export default command;