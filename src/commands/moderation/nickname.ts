import { SlashCommandBuilder, PermissionFlagsBits, GuildMember } from 'discord.js';
import { createSuccessEmbed, createErrorEmbed, hasPermission, canModerate } from '../../utils/helpers';
import { db } from '../../database/connection';
import { emojis } from '../../utils/config';

export const data = new SlashCommandBuilder()
  .setName('nickname')
  .setDescription('Manage user nicknames')
  .addSubcommand(subcommand =>
    subcommand
      .setName('set')
      .setDescription('Set a user\'s nickname')
      .addUserOption(option =>
        option.setName('user')
          .setDescription('User to change nickname for')
          .setRequired(true)
      )
      .addStringOption(option =>
        option.setName('nickname')
          .setDescription('New nickname (leave empty to reset)')
          .setRequired(false)
          .setMaxLength(32)
      )
      .addStringOption(option =>
        option.setName('reason')
          .setDescription('Reason for nickname change')
          .setRequired(false)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('reset')
      .setDescription('Reset a user\'s nickname to their username')
      .addUserOption(option =>
        option.setName('user')
          .setDescription('User to reset nickname for')
          .setRequired(true)
      )
      .addStringOption(option =>
        option.setName('reason')
          .setDescription('Reason for nickname reset')
          .setRequired(false)
      )
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames)
  .setDMPermission(false);

export async function execute(interaction: any) {
  if (!interaction.guild) {
    return interaction.reply({
      embeds: [createErrorEmbed('Error', 'This command can only be used in a server.')],
      ephemeral: true,
    });
  }

  const member = interaction.member as GuildMember;

  if (!hasPermission(member, PermissionFlagsBits.ManageNicknames)) {
    return interaction.reply({
      embeds: [createErrorEmbed('Error', 'You need the Manage Nicknames permission to use this command.')],
      ephemeral: true,
    });
  }

  const subcommand = interaction.options.getSubcommand();
  const targetUser = interaction.options.getUser('user', true);
  const reason = interaction.options.getString('reason') || 'No reason provided';

  try {
    const targetMember = await interaction.guild.members.fetch(targetUser.id);

    if (!canModerate(member, targetMember)) {
      return interaction.reply({
        embeds: [createErrorEmbed('Error', 'You cannot manage this user\'s nickname.')],
        ephemeral: true,
      });
    }

    if (targetUser.id === interaction.user.id) {
      return interaction.reply({
        embeds: [createErrorEmbed('Error', 'You cannot change your own nickname using this command. Use the built-in Discord feature instead.')],
        ephemeral: true,
      });
    }

    const oldNickname = targetMember.displayName;
    let newNickname: string | null = null;

    switch (subcommand) {
      case 'set': {
        newNickname = interaction.options.getString('nickname') || null;
        
        if (newNickname && newNickname.length > 32) {
          return interaction.reply({
            embeds: [createErrorEmbed('Error', 'Nickname cannot be longer than 32 characters.')],
            ephemeral: true,
          });
        }

        await targetMember.setNickname(newNickname, `Nickname changed by ${interaction.user.tag}: ${reason}`);
        break;
      }

      case 'reset': {
        newNickname = null;
        await targetMember.setNickname(null, `Nickname reset by ${interaction.user.tag}: ${reason}`);
        break;
      }
    }

    // Log the action
    await db.query(
      `INSERT INTO mod_actions (guild_id, user_id, moderator_id, action, reason, metadata) 
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        interaction.guild.id,
        targetUser.id,
        interaction.user.id,
        'nickname_change',
        reason,
        JSON.stringify({
          old_nickname: oldNickname !== targetUser.username ? oldNickname : null,
          new_nickname: newNickname,
          action_type: subcommand,
        }),
      ]
    );

    const embed = createSuccessEmbed(
      'Nickname Updated',
      newNickname 
        ? `${emojis.edit} Changed **${targetUser.username}**'s nickname to **${newNickname}**.`
        : `${emojis.reset} Reset **${targetUser.username}**'s nickname.`
    );

    embed.addFields(
      { name: 'User', value: `${targetUser} (${targetUser.username})`, inline: true },
      { name: 'Moderator', value: `${interaction.user}`, inline: true },
      { name: 'Old Nickname', value: oldNickname !== targetUser.username ? oldNickname : 'None', inline: true },
      { name: 'New Nickname', value: newNickname || 'None', inline: true },
      { name: 'Reason', value: reason, inline: false }
    );

    await interaction.reply({ embeds: [embed] });

    // Try to notify the user
    try {
      const dmEmbed = createSuccessEmbed(
        'Nickname Changed',
        `Your nickname in **${interaction.guild.name}** has been ${newNickname ? 'changed' : 'reset'}.`
      );

      dmEmbed.addFields(
        { name: 'Old Nickname', value: oldNickname !== targetUser.username ? oldNickname : 'None', inline: true },
        { name: 'New Nickname', value: newNickname || 'None', inline: true },
        { name: 'Moderator', value: interaction.user.username, inline: true },
        { name: 'Reason', value: reason, inline: false }
      );

      await targetUser.send({ embeds: [dmEmbed] });
    } catch (error) {
      console.log('Could not send DM to user about nickname change');
    }

    // Send to log channel if configured
    const settings = await db.query(
      'SELECT log_channel FROM guild_settings WHERE guild_id = $1',
      [interaction.guild.id]
    );

    if (settings.rows[0]?.log_channel) {
      const logChannel = interaction.guild.channels.cache.get(settings.rows[0].log_channel);
      if (logChannel?.isTextBased()) {
        await logChannel.send({ embeds: [embed] });
      }
    }

  } catch (error: any) {
    console.error('Error changing nickname:', error);
    
    let errorMessage = 'Failed to change nickname. Please check my permissions and try again.';
    
    if (error.code === 50013) {
      errorMessage = 'I don\'t have permission to change this user\'s nickname. They may have a higher role than me.';
    } else if (error.code === 50035) {
      errorMessage = 'Invalid nickname provided. Please check the nickname format and length.';
    }

    await interaction.reply({
      embeds: [createErrorEmbed('Error', errorMessage)],
      ephemeral: true,
    });
  }
}