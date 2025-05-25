import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { SlashCommand, ClientWithCommands } from '../../../types';
import { getGuildSettings } from '../../../utils/guildSettings';

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('verwarnungenloeschen')
    .setDescription('Löscht alle aktiven Verwarnungen eines Benutzers oder eine spezifische Verwarnung.')
    .addUserOption(option =>
      option.setName('benutzer')
        .setDescription('Der Benutzer, dessen Verwarnungen gelöscht werden sollen.')
        .setRequired(true))
    .addIntegerOption(option =>
        option.setName('verwarnungs_id')
        .setDescription('Die ID einer spezifischen Verwarnung, die gelöscht werden soll (optional).')
        .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages), // Benötigt höhere Rechte
  enabled: true,
  category: 'moderation',
  async execute(interaction: ChatInputCommandInteraction, client: ClientWithCommands) {
    if (!interaction.guildId) {
        await interaction.reply({ content: 'Dieser Befehl kann nur auf einem Server verwendet werden.', ephemeral: true });
        return;
    }
    const guildSettings = await getGuildSettings(interaction.guildId, client);
    if (!guildSettings?.enableModeration) {
        await interaction.reply({ content: 'Das Moderationssystem ist auf diesem Server deaktiviert.', ephemeral: true });
        return;
    }

    const targetUser = interaction.options.getUser('benutzer', true);
    const warningId = interaction.options.getInteger('verwarnungs_id');
    const moderator = interaction.user;

    try {
      let count = 0;
      if (warningId) {
        const result = await client.prisma.warn.updateMany({
          where: {
            id: warningId,
            userId: targetUser.id,
            guildId: interaction.guildId,
            active: true,
          },
          data: { active: false },
        });
        count = result.count;
      } else {
        const result = await client.prisma.warn.updateMany({
          where: {
            userId: targetUser.id,
            guildId: interaction.guildId,
            active: true,
          },
          data: { active: false },
        });
        count = result.count;
      }

      if (count === 0) {
        await interaction.reply({ content: warningId ? `Keine aktive Verwarnung mit ID ${warningId} für ${targetUser.tag} gefunden.` : `Keine aktiven Verwarnungen für ${targetUser.tag} gefunden.`, ephemeral: true });
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(0x00FF00) // Grün für erfolgreiche Aktion
        .setTitle('Verwarnungen Gelöscht')
        .setDescription(warningId ? `Verwarnung #${warningId} für ${targetUser.tag} wurde als inaktiv markiert.` : `Alle ${count} aktiven Verwarnungen für ${targetUser.tag} wurden als inaktiv markiert.`)
        .addFields(
          { name: 'Benutzer', value: `${targetUser.tag} (${targetUser.id})`, inline: true },
          { name: 'Moderator', value: `${moderator.tag} (${moderator.id})`, inline: true }
        )
        .setTimestamp()
        .setFooter({ text: `Aktion ausgeführt in ${interaction.guild?.name}` });
      
      await interaction.reply({ embeds: [embed] });

       if (guildSettings.modLogChannelId) {
        const logChannel = interaction.guild!.channels.cache.get(guildSettings.modLogChannelId);
        if (logChannel && logChannel.isTextBased()) {
          await logChannel.send({ embeds: [embed.setTitle(warningId ? 'Verwarnung Deaktiviert' : 'Alle Verwarnungen Deaktiviert')] });
        }
      }

    } catch (error) {
      console.error('Fehler beim Löschen der Verwarnungen:', error);
      await interaction.reply({ content: 'Ein Fehler ist beim Löschen der Verwarnungen aufgetreten.', ephemeral: true });
    }
  }
};

export default command;