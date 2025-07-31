import { SlashCommandBuilder, GuildMember } from 'discord.js';
import { createSuccessEmbed, createErrorEmbed, formatTimeAgo } from '../../utils/helpers';
import { db } from '../../database/connection';
import { emojis } from '../../utils/config';

export const data = new SlashCommandBuilder()
  .setName('afk')
  .setDescription('Manage your AFK status')
  .addSubcommand(subcommand =>
    subcommand
      .setName('set')
      .setDescription('Set yourself as AFK')
      .addStringOption(option =>
        option.setName('reason')
          .setDescription('Reason for being AFK')
          .setRequired(false)
          .setMaxLength(200)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('remove')
      .setDescription('Remove your AFK status')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('check')
      .setDescription('Check someone\'s AFK status')
      .addUserOption(option =>
        option.setName('user')
          .setDescription('User to check AFK status for')
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('list')
      .setDescription('List all AFK users in the server')
  )
  .setDMPermission(false);

export async function execute(interaction: any) {
  if (!interaction.guild) {
    return interaction.reply({
      embeds: [createErrorEmbed('Error', 'This command can only be used in a server.')],
      ephemeral: true,
    });
  }

  const subcommand = interaction.options.getSubcommand();

  try {
    switch (subcommand) {
      case 'set':
        await handleSetAFK(interaction);
        break;
      case 'remove':
        await handleRemoveAFK(interaction);
        break;
      case 'check':
        await handleCheckAFK(interaction);
        break;
      case 'list':
        await handleListAFK(interaction);
        break;
    }
  } catch (error) {
    console.error('Error managing AFK:', error);
    await interaction.reply({
      embeds: [createErrorEmbed('Error', 'Failed to manage AFK status. Please try again.')],
      ephemeral: true,
    });
  }
}

async function handleSetAFK(interaction: any) {
  const reason = interaction.options.getString('reason') || 'No reason provided';

  // Check if user is already AFK
  const existing = await db.query(
    'SELECT * FROM user_afk WHERE user_id = $1 AND guild_id = $2',
    [interaction.user.id, interaction.guild.id]
  );

  if (existing.rows.length > 0) {
    return interaction.reply({
      embeds: [createErrorEmbed('Error', 'You are already marked as AFK. Use `/afk remove` to remove your AFK status.')],
      ephemeral: true,
    });
  }

  // Set user as AFK
  await db.query(
    'INSERT INTO user_afk (user_id, guild_id, reason) VALUES ($1, $2, $3)',
    [interaction.user.id, interaction.guild.id, reason]
  );

  const embed = createSuccessEmbed(
    'AFK Status Set',
    `${emojis.afk} You are now marked as AFK.`
  );

  embed.addFields(
    { name: 'User', value: `${interaction.user}`, inline: true },
    { name: 'Reason', value: reason, inline: true },
    { name: 'Set At', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
  );

  embed.setFooter({ text: 'You will be automatically unmarked as AFK when you send your next message.' });

  await interaction.reply({ embeds: [embed] });

  // Try to add [AFK] to nickname
  try {
    const member = interaction.member as GuildMember;
    if (member.manageable && !member.displayName.includes('[AFK]')) {
      const newNickname = `[AFK] ${member.displayName}`.substring(0, 32);
      await member.setNickname(newNickname, 'User set AFK status');
    }
  } catch (error) {
    console.log('Could not modify nickname for AFK user');
  }
}

async function handleRemoveAFK(interaction: any) {
  // Check if user is AFK
  const afkUser = await db.query(
    'SELECT * FROM user_afk WHERE user_id = $1 AND guild_id = $2',
    [interaction.user.id, interaction.guild.id]
  );

  if (afkUser.rows.length === 0) {
    return interaction.reply({
      embeds: [createErrorEmbed('Error', 'You are not currently marked as AFK.')],
      ephemeral: true,
    });
  }

  const afkData = afkUser.rows[0];

  // Remove AFK status
  await db.query(
    'DELETE FROM user_afk WHERE user_id = $1 AND guild_id = $2',
    [interaction.user.id, interaction.guild.id]
  );

  const afkDuration = Date.now() - new Date(afkData.set_at).getTime();

  const embed = createSuccessEmbed(
    'AFK Status Removed',
    `${emojis.success} Welcome back! Your AFK status has been removed.`
  );

  embed.addFields(
    { name: 'User', value: `${interaction.user}`, inline: true },
    { name: 'AFK Duration', value: formatTimeAgo(afkData.set_at), inline: true },
    { name: 'Previous Reason', value: afkData.reason || 'No reason provided', inline: true }
  );

  await interaction.reply({ embeds: [embed] });

  // Try to remove [AFK] from nickname
  try {
    const member = interaction.member as GuildMember;
    if (member.manageable && member.displayName.includes('[AFK]')) {
      const newNickname = member.displayName.replace(/\[AFK\]\s*/, '').trim() || member.user.username;
      await member.setNickname(newNickname.substring(0, 32), 'User removed AFK status');
    }
  } catch (error) {
    console.log('Could not modify nickname for user removing AFK');
  }
}

async function handleCheckAFK(interaction: any) {
  const targetUser = interaction.options.getUser('user', true);

  const afkUser = await db.query(
    'SELECT * FROM user_afk WHERE user_id = $1 AND guild_id = $2',
    [targetUser.id, interaction.guild.id]
  );

  if (afkUser.rows.length === 0) {
    return interaction.reply({
      embeds: [createErrorEmbed('Not AFK', `**${targetUser.username}** is not currently marked as AFK.`)],
      ephemeral: true,
    });
  }

  const afkData = afkUser.rows[0];

  const embed = createSuccessEmbed(
    'AFK Status',
    `${emojis.afk} **${targetUser.username}** is currently AFK.`
  );

  embed.addFields(
    { name: 'User', value: `${targetUser}`, inline: true },
    { name: 'AFK Since', value: `<t:${Math.floor(new Date(afkData.set_at).getTime() / 1000)}:F>`, inline: true },
    { name: 'Duration', value: formatTimeAgo(afkData.set_at), inline: true },
    { name: 'Reason', value: afkData.reason || 'No reason provided', inline: false }
  );

  embed.setThumbnail(targetUser.displayAvatarURL());

  await interaction.reply({ embeds: [embed] });
}

async function handleListAFK(interaction: any) {
  const afkUsers = await db.query(
    `SELECT user_afk.*, users.username 
     FROM user_afk 
     LEFT JOIN users ON user_afk.user_id = users.user_id 
     WHERE user_afk.guild_id = $1 
     ORDER BY user_afk.set_at DESC 
     LIMIT 20`,
    [interaction.guild.id]
  );

  if (afkUsers.rows.length === 0) {
    return interaction.reply({
      embeds: [createErrorEmbed('No AFK Users', 'No users are currently marked as AFK in this server.')],
      ephemeral: true,
    });
  }

  const embed = createSuccessEmbed(
    'AFK Users List',
    `${emojis.afk} **${afkUsers.rows.length}** user${afkUsers.rows.length === 1 ? '' : 's'} currently AFK in this server.`
  );

  let afkList = '';
  for (const afkData of afkUsers.rows) {
    try {
      const user = await interaction.client.users.fetch(afkData.user_id);
      const afkSince = formatTimeAgo(afkData.set_at);
      const reason = afkData.reason ? ` - ${afkData.reason}` : '';
      
      afkList += `• **${user.username}** (${afkSince})${reason}\n`;
      
      if (afkList.length > 1800) {
        afkList += '*...and more*';
        break;
      }
    } catch (error) {
      console.log(`Could not fetch user ${afkData.user_id}`);
    }
  }

  if (afkList) {
    embed.addFields({
      name: 'Currently AFK',
      value: afkList,
      inline: false
    });
  }

  embed.setFooter({
    text: `Showing ${Math.min(afkUsers.rows.length, 20)} AFK users • Use /afk check [user] for details`
  });

  await interaction.reply({ embeds: [embed] });
}

// Export helper function for removing AFK status when user sends a message
export async function removeAFKOnMessage(userId: string, guildId: string, member: GuildMember) {
  try {
    const afkUser = await db.query(
      'SELECT * FROM user_afk WHERE user_id = $1 AND guild_id = $2',
      [userId, guildId]
    );

    if (afkUser.rows.length > 0) {
      await db.query(
        'DELETE FROM user_afk WHERE user_id = $1 AND guild_id = $2',
        [userId, guildId]
      );

      // Try to remove [AFK] from nickname
      if (member.manageable && member.displayName.includes('[AFK]')) {
        const newNickname = member.displayName.replace(/\[AFK\]\s*/, '').trim() || member.user.username;
        await member.setNickname(newNickname.substring(0, 32), 'User is no longer AFK');
      }

      return true; // AFK status was removed
    }
  } catch (error) {
    console.error('Error removing AFK status:', error);
  }
  
  return false; // User was not AFK
}