import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, GuildMember, GuildEmoji } from 'discord.js';
import { SlashCommand, ClientWithCommands } from '../../../types';

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('serverinfo')
    .setDescription('Zeigt detaillierte Informationen über den aktuellen Server an.'),
  enabled: true,
  category: 'utility',
  async execute(interaction: ChatInputCommandInteraction, client: ClientWithCommands) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'Dieser Befehl kann nur auf einem Server verwendet werden.', ephemeral: true });
      return;
    }

    const guild = interaction.guild;
    await guild.members.fetch();
    await guild.channels.fetch();
    await guild.roles.fetch();

    const owner = await guild.fetchOwner();

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(`Serverinformationen für ${guild.name}`)
      .setThumbnail(guild.iconURL({ dynamic: true }))
      .addFields(
        { name: 'Server Name', value: guild.name, inline: true },
        { name: 'Server ID', value: guild.id, inline: true },
        { name: 'Besitzer', value: `${owner.user.tag} (${owner.id})`, inline: true },
        { name: 'Mitglieder', value: `Gesamt: ${guild.memberCount}\nNutzer: ${guild.members.cache.filter(member => !member.user.bot).size}\nBots: ${guild.members.cache.filter(member => member.user.bot).size}`, inline: true },
        { name: 'Kanäle', value: `Text: ${guild.channels.cache.filter(c => c.isTextBased() && !c.isThread()).size}\nVoice: ${guild.channels.cache.filter(c => c.isVoiceBased()).size}\nKategorien: ${guild.channels.cache.filter(c => c.type === 4).size}`, inline: true },
        { name: 'Rollen', value: guild.roles.cache.size.toString(), inline: true },
        { name: 'Erstellt am', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:F>`, inline: true },
        { name: 'Boost Level', value: guild.premiumTier.toString(), inline: true },
        { name: 'Boosts', value: (guild.premiumSubscriptionCount || 0).toString(), inline: true },
        { name: 'Emojis', value: `Statisch: ${guild.emojis.cache.filter((e: GuildEmoji) => !e.animated).size}\nAnimiert: ${guild.emojis.cache.filter((e: GuildEmoji) => !!e.animated).size}`, inline: true },
        { name: 'Verifizierungslevel', value: guild.verificationLevel.toString(), inline: true },
        { name: 'Features', value: guild.features.length > 0 ? guild.features.map(f => `\`${f}\``).join(', ') : 'Keine', inline: false }
      )
      .setTimestamp()
      .setFooter({ text: `Angefordert von ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() || undefined });

    await interaction.reply({ embeds: [embed] });
  }
};

export default command;