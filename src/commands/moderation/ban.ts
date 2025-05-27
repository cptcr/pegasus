// src/commands/moderation/ban.ts - Advanced Ban Command
import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  PermissionFlagsBits, 
  EmbedBuilder,
  User,
  GuildMember
} from 'discord.js';
import { Command } from '../../types/index.js';
import { CommandMetadata } from '../../types/CommandMetadata.js';
import { ExtendedClient } from '../../index.js';
import { Config } from '../../config/Config.js';

export const metadata: CommandMetadata = {
  name: 'ban',
  description: 'Ban a user from the server with optional message deletion',
  category: 'moderation',
  usage: '/ban <user> [reason] [delete_days]',
  examples: [
    '/ban @user Spamming',
    '/ban @user Breaking rules delete_days:7',
    '/ban 123456789 Harassment reason:"Repeated violations"'
  ],
  permissions: ['BAN_MEMBERS'],
  cooldown: 5,
  guildOnly: true
};

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a user from the server')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user to ban')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for the ban')
        .setMaxLength(500))
    .addIntegerOption(option =>
      option.setName('delete_days')
        .setDescription('Days of messages to delete (0-7)')
        .setMinValue(0)
        .setMaxValue(7))
    .addBooleanOption(option =>
      option.setName('silent')
        .setDescription('Don\'t send a DM to the user')
        .setRequired(false)),
  category: 'moderation',
  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction, client: ExtendedClient) {
    if (!interaction.guild) {
      return interaction.reply({
        content: '❌ This command can only be used in a server.',
        ephemeral: true
      });
    }

    const target = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const deleteDays = interaction.options.getInteger('delete_days') || 0;
    const silent = interaction.options.getBoolean('silent') || false;

    try {
      // Check if target is bannable
      const member = await interaction.guild.members.fetch(target.id).catch(() => null);
      
      if (member) {
        // Check hierarchy
        const moderator = interaction.member as GuildMember;
        if (member.roles.highest.position >= moderator.roles.highest.position && 
            interaction.guild.ownerId !== moderator.id) {
          return interaction.reply({
            content: '❌ You cannot ban this user due to role hierarchy.',
            ephemeral: true
          });
        }

        // Check if target is server owner
        if (member.id === interaction.guild.ownerId) {
          return interaction.reply({
            content: '❌ You cannot ban the server owner.',
            ephemeral: true
          });
        }

        // Check if target is bot
        if (member.user.bot && member.id === client.user?.id) {
          return interaction.reply({
            content: '❌ I cannot ban myself.',
            ephemeral: true
          });
        }
      }

      await interaction.deferReply();

      // Check if user is already banned
      try {
        const existingBan = await interaction.guild.bans.fetch(target.id);
        if (existingBan) {
          return interaction.editReply({
            content: `❌ ${target.tag} is already banned from this server.`
          });
        }
      } catch (error) {
        // User is not banned, continue
      }

      // Send DM to user before banning (if not silent)
      if (!silent && member) {
        try {
          const dmEmbed = new EmbedBuilder()
            .setTitle('🔨 You have been banned')
            .setDescription(`You have been banned from **${interaction.guild.name}**.`)
            .addFields(
              { name: 'Reason', value: reason, inline: true },
              { name: 'Moderator', value: interaction.user.tag, inline: true },
              { name: 'Date', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
            )
            .setColor(Config.COLORS.ERROR)
            .setTimestamp();

          if (interaction.guild.iconURL()) {
            dmEmbed.setThumbnail(interaction.guild.iconURL());
          }

          await target.send({ embeds: [dmEmbed] });
        } catch (error) {
          client.logger.warn(`Could not send ban DM to ${target.tag}:`, error);
        }
      }

      // Execute the ban
      await interaction.guild.members.ban(target, {
        reason: `${reason} | Moderator: ${interaction.user.tag}`,
        deleteMessageDays: deleteDays
      });

      // Create ban log entry
      await client.db.log.create({
        data: {
          guildId: interaction.guild.id,
          type: 'BAN',
          content: JSON.stringify({
            targetId: target.id,
            targetTag: target.tag,
            moderatorId: interaction.user.id,
            moderatorTag: interaction.user.tag,
            reason: reason,
            deleteDays: deleteDays,
            silent: silent
          }),
          userId: target.id
        }
      });

      // Create success embed
      const successEmbed = new EmbedBuilder()
        .setTitle(`${Config.EMOJIS.SUCCESS} User Banned`)
        .setDescription(`Successfully banned **${target.tag}**.`)
        .addFields(
          { name: 'User', value: `${target} (${target.id})`, inline: true },
          { name: 'Moderator', value: `${interaction.user}`, inline: true },
          { name: 'Reason', value: reason, inline: false }
        )
        .setColor(Config.COLORS.ERROR)
        .setTimestamp();

      if (deleteDays > 0) {
        successEmbed.addFields({
          name: 'Messages Deleted',
          value: `${deleteDays} day${deleteDays > 1 ? 's' : ''} of messages`,
          inline: true
        });
      }

      if (silent) {
        successEmbed.addFields({
          name: 'Silent Ban',
          value: 'User was not notified',
          inline: true
        });
      }

      await interaction.editReply({ embeds: [successEmbed] });

      // Emit to dashboard
      client.wsManager.emitRealtimeEvent(interaction.guild.id, 'member:banned', {
        targetId: target.id,
        targetTag: target.tag,
        moderatorId: interaction.user.id,
        moderatorTag: interaction.user.tag,
        reason: reason,
        deleteDays: deleteDays
      });

      client.logger.info(`${target.tag} (${target.id}) was banned from ${interaction.guild.name} by ${interaction.user.tag}`);

    } catch (error) {
      client.logger.error('Error executing ban command:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: `❌ Failed to ban user: ${errorMessage}`,
          ephemeral: true
        });
      } else {
        await interaction.editReply({
          content: `❌ Failed to ban user: ${errorMessage}`
        });
      }
    }
  }
};

export default command;