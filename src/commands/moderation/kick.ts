// src/commands/moderation/kick.ts - Advanced Kick Command
import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  PermissionFlagsBits, 
  EmbedBuilder,
  GuildMember
} from 'discord.js';
import { Command } from '../../types/index.js';
import { CommandMetadata } from '../../types/CommandMetadata.js';
import { ExtendedClient } from '../../index.js';
import { Config } from '../../config/Config.js';

export const metadata: CommandMetadata = {
  name: 'kick',
  description: 'Kick a user from the server',
  category: 'moderation',
  usage: '/kick <user> [reason]',
  examples: [
    '/kick @user Disrupting chat',
    '/kick @user reason:"Inappropriate behavior"',
    '/kick @user silent:true'
  ],
  permissions: ['KICK_MEMBERS'],
  cooldown: 3,
  guildOnly: true
};

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a user from the server')
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user to kick')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for the kick')
        .setMaxLength(500))
    .addBooleanOption(option =>
      option.setName('silent')
        .setDescription('Don\'t send a DM to the user')
        .setRequired(false)),
  category: 'moderation',
  cooldown: 3,

  async execute(interaction: ChatInputCommandInteraction, client: ExtendedClient) {
    if (!interaction.guild) {
      return interaction.reply({
        content: '❌ This command can only be used in a server.',
        ephemeral: true
      });
    }

    const target = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const silent = interaction.options.getBoolean('silent') || false;

    try {
      // Get the member object
      const member = await interaction.guild.members.fetch(target.id).catch(() => null);
      
      if (!member) {
        return interaction.reply({
          content: '❌ User not found in this server.',
          ephemeral: true
        });
      }

      // Check hierarchy
      const moderator = interaction.member as GuildMember;
      if (member.roles.highest.position >= moderator.roles.highest.position && 
          interaction.guild.ownerId !== moderator.id) {
        return interaction.reply({
          content: '❌ You cannot kick this user due to role hierarchy.',
          ephemeral: true
        });
      }

      // Check if target is server owner
      if (member.id === interaction.guild.ownerId) {
        return interaction.reply({
          content: '❌ You cannot kick the server owner.',
          ephemeral: true
        });
      }

      // Check if target is bot
      if (member.user.bot && member.id === client.user?.id) {
        return interaction.reply({
          content: '❌ I cannot kick myself.',
          ephemeral: true
        });
      }

      await interaction.deferReply();

      // Send DM to user before kicking (if not silent)
      if (!silent) {
        try {
          const dmEmbed = new EmbedBuilder()
            .setTitle('👢 You have been kicked')
            .setDescription(`You have been kicked from **${interaction.guild.name}**.`)
            .addFields(
              { name: 'Reason', value: reason, inline: true },
              { name: 'Moderator', value: interaction.user.tag, inline: true },
              { name: 'Date', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
            )
            .setColor(Config.COLORS.WARNING)
            .setTimestamp();

          if (interaction.guild.iconURL()) {
            dmEmbed.setThumbnail(interaction.guild.iconURL());
          }

          dmEmbed.addFields({
            name: 'Re-join',
            value: 'You can rejoin this server if you have an invite link.',
            inline: false
          });

          await target.send({ embeds: [dmEmbed] });
        } catch (error) {
          client.logger.warn(`Could not send kick DM to ${target.tag}:`, error);
        }
      }

      // Execute the kick
      await member.kick(`${reason} | Moderator: ${interaction.user.tag}`);

      // Create kick log entry
      await client.db.log.create({
        data: {
          guildId: interaction.guild.id,
          type: 'KICK',
          content: JSON.stringify({
            targetId: target.id,
            targetTag: target.tag,
            moderatorId: interaction.user.id,
            moderatorTag: interaction.user.tag,
            reason: reason,
            silent: silent
          }),
          userId: target.id
        }
      });

      // Create success embed
      const successEmbed = new EmbedBuilder()
        .setTitle(`${Config.EMOJIS.SUCCESS} User Kicked`)
        .setDescription(`Successfully kicked **${target.tag}**.`)
        .addFields(
          { name: 'User', value: `${target} (${target.id})`, inline: true },
          { name: 'Moderator', value: `${interaction.user}`, inline: true },
          { name: 'Reason', value: reason, inline: false }
        )
        .setColor(Config.COLORS.WARNING)
        .setTimestamp();

      if (silent) {
        successEmbed.addFields({
          name: 'Silent Kick',
          value: 'User was not notified',
          inline: true
        });
      }

      await interaction.editReply({ embeds: [successEmbed] });

      // Emit to dashboard
      client.wsManager.emitRealtimeEvent(interaction.guild.id, 'member:kicked', {
        targetId: target.id,
        targetTag: target.tag,
        moderatorId: interaction.user.id,
        moderatorTag: interaction.user.tag,
        reason: reason
      });

      client.logger.info(`${target.tag} (${target.id}) was kicked from ${interaction.guild.name} by ${interaction.user.tag}`);

    } catch (error) {
      client.logger.error('Error executing kick command:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: `❌ Failed to kick user: ${errorMessage}`,
          ephemeral: true
        });
      } else {
        await interaction.editReply({
          content: `❌ Failed to kick user: ${errorMessage}`
        });
      }
    }
  }
};

export default command;