// src/commands/slash/hilfe.ts
import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { SlashCommand, ClientWithCommands } from '../../types';

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('hilfe')
    .setDescription('Zeigt eine Liste aller verfügbaren Befehle oder Informationen zu einem bestimmten Befehl.')
    .addStringOption(option =>
      option.setName('befehl')
        .setDescription('Der Befehl, zu dem du Hilfe benötigst.')
        .setRequired(false)),
  enabled: true,
  async execute(interaction: ChatInputCommandInteraction, client: ClientWithCommands) {
    const commandName = interaction.options.getString('befehl');

    if (commandName) {
      const cmd = client.slashCommands.get(commandName.toLowerCase()) || client.commands.get(commandName.toLowerCase());
      if (!cmd) {
        await interaction.reply({ content: `❌ Der Befehl \`${commandName}\` wurde nicht gefunden.`, ephemeral: true });
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(0x5865F2) // Discord Blau
        .setTitle(`Hilfe für: \`/${(cmd as SlashCommand).data?.name || (cmd as any).name}\``)
        .setDescription((cmd as SlashCommand).data?.description || (cmd as any).description || 'Keine Beschreibung verfügbar.')
        .setTimestamp();
      
      if ((cmd as any).usage) { // Für Prefix-Befehle
        embed.addFields({ name: 'Verwendung', value: `\`${client.config.defaultPrefix}${(cmd as any).usage}\`` });
      }
      if ((cmd as any).aliases && (cmd as any).aliases.length > 0) {
        embed.addFields({ name: 'Aliase', value: (cmd as any).aliases.join(', ') });
      }
      if ((cmd as any).cooldown) {
        embed.addFields({ name: 'Cooldown', value: `${(cmd as any).cooldown} Sekunden` });
      }

      await interaction.reply({ embeds: [embed], ephemeral: true });

    } else {
      const categories: { [key: string]: SlashCommand[] } = {};
      client.slashCommands.forEach(cmd => {
        if (cmd.enabled === false || cmd.testOnly && !client.config.devGuilds.includes(interaction.guildId || '')) return;
        const category = cmd.category || 'Sonstige';
        if (!categories[category]) {
          categories[category] = [];
        }
        categories[category].push(cmd);
      });

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('Pegasus Bot Hilfe')
        .setDescription(`Hier ist eine Liste aller verfügbaren Slash-Befehle. Für detaillierte Informationen zu einem bestimmten Befehl, verwende \`/hilfe <Befehlsname>\`.\nDer aktuelle Prefix für textbasierte Befehle ist: \`${client.config.defaultPrefix}\``)
        .setTimestamp()
        .setFooter({ text: `Angefordert von ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() });

      for (const category in categories) {
        const commandsInCategory = categories[category]
          .map(cmd => `\`/${cmd.data.name}\` - ${cmd.data.description}`)
          .join('\n');
        if (commandsInCategory) {
          embed.addFields({ name: `Kategorie: ${category}`, value: commandsInCategory });
        }
      }
      
      // Hinweis für Prefix-Befehle
      if (client.commands.size > 0) {
        embed.addFields({name: "Prefix-Befehle", value: `Es gibt auch textbasierte Befehle. Nutze \`${client.config.defaultPrefix}hilfe\` für eine Liste.`})
      }


      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }
};

export default command;
