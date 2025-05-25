import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, PermissionFlagsBits, GuildMember } from 'discord.js';
import { SlashCommand, ClientWithCommands } from '../../../types';
import { getGuildSettings } from '../../../utils/guildSettings';

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('verwarnen')
    .setDescription('Verwarnt einen Benutzer auf dem Server.')
    .addUserOption(option =>
      option.setName('benutzer')
        .setDescription('Der zu verwarnende Benutzer.')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('grund')
        .setDescription('Der Grund für die Verwarnung.')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),
  enabled: true,
  category: 'moderation',
  async execute(interaction: ChatInputCommandInteraction, client: ClientWithCommands) {
    if (!interaction.guildId || !interaction.guild) {
        await interaction.reply({ content: 'Dieser Befehl kann nur auf einem Server verwendet werden.', ephemeral: true });
        return;
    }
    const guildSettings = await getGuildSettings(interaction.guildId, client);
    if (!guildSettings?.enableModeration) {
        await interaction.reply({ content: 'Das Moderationssystem ist auf diesem Server deaktiviert.', ephemeral: true });
        return;
    }

    const targetUser = interaction.options.getUser('benutzer', true);
    const reason = interaction.options.getString('grund', true);
    const moderator = interaction.user;

    if (targetUser.id === moderator.id) {
        await interaction.reply({ content: 'Du kannst dich nicht selbst verwarnen.', ephemeral: true});
        return;
    }

    if (targetUser.bot) {
        await interaction.reply({ content: 'Bots können nicht verwarnt werden.', ephemeral: true});
        return;
    }

    const targetMember = interaction.guild.members.cache.get(targetUser.id) as GuildMember | undefined;
    if (targetMember && targetMember.permissions.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({ content: 'Administratoren können nicht verwarnt werden.', ephemeral: true });
        return;
    }

    try {
      const warning = await client.prisma.warn.create({
        data: {
          guildId: interaction.guildId,
          userId: targetUser.id,
          moderatorId: moderator.id,
          reason: reason,
          active: true,
        },
      });

      const embed = new EmbedBuilder()
        .setColor(0xFFCC00)
        .setTitle('Benutzer Verwarnt')
        .setDescription(`${targetUser.tag} wurde verwarnt.`)
        .addFields(
          { name: 'Benutzer', value: `${targetUser.tag} (${targetUser.id})`, inline: true },
          { name: 'Moderator', value: `${moderator.tag} (${moderator.id})`, inline: true },
          { name: 'Grund', value: reason, inline: false },
          { name: 'Verwarnungs-ID', value: warning.id.toString(), inline: true }
        )
        .setTimestamp()
        .setFooter({ text: `Aktion ausgeführt in ${interaction.guild.name}` });

      await interaction.reply({ embeds: [embed] });

      try {
        await targetUser.send(`Du wurdest auf dem Server **${interaction.guild.name}** verwarnt.\n**Grund:** ${reason}`);
      } catch (dmError) {
        await interaction.followUp({ content: `Konnte den Benutzer nicht per DM benachrichtigen.`, ephemeral: true });
      }

      if (guildSettings.modLogChannelId) {
        const logChannel = interaction.guild.channels.cache.get(guildSettings.modLogChannelId);
        if (logChannel && logChannel.isTextBased()) {
          await logChannel.send({ embeds: [embed.setTitle('Neuer Verwarnungseintrag')] });
        }
      }

    } catch (error) {
      console.error('Fehler beim Erstellen der Verwarnung:', error);
      await interaction.reply({ content: 'Ein Fehler ist beim Verwarnen des Benutzers aufgetreten.', ephemeral: true });
    }
  }
};

export default command;