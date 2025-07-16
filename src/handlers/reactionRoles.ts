import { 
  MessageReaction, 
  User, 
  GuildMember, 
  TextChannel, 
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ComponentType,
  ButtonInteraction,
  StringSelectMenuInteraction
} from 'discord.js';
import { db } from '../database/connection';
import { createEmbed, createSuccessEmbed, createErrorEmbed } from '../utils/helpers';
import { colors, emojis } from '../utils/config';

interface ReactionRolePanel {
  id: string;
  guildId: string;
  channelId: string;
  messageId: string;
  title: string;
  description: string;
  color: string;
  type: 'reaction' | 'button' | 'dropdown';
  maxRoles: number;
  requiredRoles: string[];
  allowedRoles: string[];
  embedEnabled: boolean;
  embedThumbnail?: string;
  embedImage?: string;
  embedFooter?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface ReactionRole {
  id: string;
  panelId: string;
  roleId: string;
  emoji?: string;
  label: string;
  description?: string;
  style?: string;
  requirements: any;
  createdAt: Date;
}

export class ReactionRolesHandler {
  private static instance: ReactionRolesHandler;

  public static getInstance(): ReactionRolesHandler {
    if (!ReactionRolesHandler.instance) {
      ReactionRolesHandler.instance = new ReactionRolesHandler();
    }
    return ReactionRolesHandler.instance;
  }

  public async handleReactionAdd(reaction: MessageReaction, user: User): Promise<void> {
    if (user.bot) return;

    const panel = await this.getPanelByMessage(reaction.message.id);
    if (!panel || panel.type !== 'reaction') return;

    const reactionRole = await this.getReactionRole(panel.id, reaction.emoji.toString());
    if (!reactionRole) return;

    const member = reaction.message.guild?.members.cache.get(user.id);
    if (!member) return;

    await this.giveRole(member, reactionRole, panel);
  }

  public async handleReactionRemove(reaction: MessageReaction, user: User): Promise<void> {
    if (user.bot) return;

    const panel = await this.getPanelByMessage(reaction.message.id);
    if (!panel || panel.type !== 'reaction') return;

    const reactionRole = await this.getReactionRole(panel.id, reaction.emoji.toString());
    if (!reactionRole) return;

    const member = reaction.message.guild?.members.cache.get(user.id);
    if (!member) return;

    await this.removeRole(member, reactionRole, panel);
  }

  public async handleButtonInteraction(interaction: ButtonInteraction): Promise<void> {
    if (!interaction.customId.startsWith('rr_')) return;

    const [, panelId, roleId] = interaction.customId.split('_');
    
    const panel = await this.getPanel(panelId);
    if (!panel || panel.type !== 'button') return;

    const reactionRole = await this.getReactionRoleById(roleId);
    if (!reactionRole) return;

    const member = interaction.member as GuildMember;
    const hasRole = member.roles.cache.has(reactionRole.roleId);

    if (hasRole) {
      await this.removeRole(member, reactionRole, panel);
      await interaction.reply({
        embeds: [createSuccessEmbed('Role Removed', `Removed the <@&${reactionRole.roleId}> role.`)],
        ephemeral: true,
      });
    } else {
      const success = await this.giveRole(member, reactionRole, panel);
      if (success) {
        await interaction.reply({
          embeds: [createSuccessEmbed('Role Added', `Added the <@&${reactionRole.roleId}> role.`)],
          ephemeral: true,
        });
      } else {
        await interaction.reply({
          embeds: [createErrorEmbed('Error', 'Failed to add role. Check requirements or role limits.')],
          ephemeral: true,
        });
      }
    }
  }

  public async handleSelectMenuInteraction(interaction: StringSelectMenuInteraction): Promise<void> {
    if (!interaction.customId.startsWith('rr_dropdown_')) return;

    const panelId = interaction.customId.replace('rr_dropdown_', '');
    const selectedRoleIds = interaction.values;

    const panel = await this.getPanel(panelId);
    if (!panel || panel.type !== 'dropdown') return;

    const member = interaction.member as GuildMember;
    const panelRoles = await this.getPanelRoles(panel.id);
    
    const currentRoles = member.roles.cache
      .filter(role => panelRoles.some(pr => pr.roleId === role.id))
      .map(role => role.id);

    const rolesToAdd = selectedRoleIds.filter(roleId => !currentRoles.includes(roleId));
    const rolesToRemove = currentRoles.filter(roleId => !selectedRoleIds.includes(roleId));

    let addedRoles: string[] = [];
    let removedRoles: string[] = [];

    // Remove roles
    for (const roleId of rolesToRemove) {
      const reactionRole = panelRoles.find(pr => pr.roleId === roleId);
      if (reactionRole) {
        await this.removeRole(member, reactionRole, panel);
        removedRoles.push(roleId);
      }
    }

    // Add roles
    for (const roleId of rolesToAdd) {
      const reactionRole = panelRoles.find(pr => pr.roleId === roleId);
      if (reactionRole) {
        const success = await this.giveRole(member, reactionRole, panel);
        if (success) {
          addedRoles.push(roleId);
        }
      }
    }

    let responseText = '';
    if (addedRoles.length > 0) {
      responseText += `**Added:** ${addedRoles.map(r => `<@&${r}>`).join(', ')}\n`;
    }
    if (removedRoles.length > 0) {
      responseText += `**Removed:** ${removedRoles.map(r => `<@&${r}>`).join(', ')}`;
    }

    if (!responseText) {
      responseText = 'No changes were made.';
    }

    await interaction.reply({
      embeds: [createSuccessEmbed('Roles Updated', responseText)],
      ephemeral: true,
    });
  }

  private async giveRole(member: GuildMember, reactionRole: ReactionRole, panel: ReactionRolePanel): Promise<boolean> {
    try {
      // Check if user already has the role
      if (member.roles.cache.has(reactionRole.roleId)) {
        return false;
      }

      // Check role limits
      if (panel.maxRoles > 0) {
        const panelRoles = await this.getPanelRoles(panel.id);
        const currentPanelRoles = member.roles.cache
          .filter(role => panelRoles.some(pr => pr.roleId === role.id))
          .size;

        if (currentPanelRoles >= panel.maxRoles) {
          return false;
        }
      }

      // Check requirements
      if (!await this.checkRequirements(member, reactionRole.requirements)) {
        return false;
      }

      // Check allowed roles
      if (panel.allowedRoles.length > 0) {
        const hasAllowedRole = panel.allowedRoles.some(roleId => member.roles.cache.has(roleId));
        if (!hasAllowedRole) {
          return false;
        }
      }

      // Check required roles
      if (panel.requiredRoles.length > 0) {
        const hasAllRequiredRoles = panel.requiredRoles.every(roleId => member.roles.cache.has(roleId));
        if (!hasAllRequiredRoles) {
          return false;
        }
      }

      await member.roles.add(reactionRole.roleId, 'Reaction role');
      return true;

    } catch (error) {
      console.error('Error giving role:', error);
      return false;
    }
  }

  private async removeRole(member: GuildMember, reactionRole: ReactionRole, panel: ReactionRolePanel): Promise<boolean> {
    try {
      if (!member.roles.cache.has(reactionRole.roleId)) {
        return false;
      }

      await member.roles.remove(reactionRole.roleId, 'Reaction role removal');
      return true;

    } catch (error) {
      console.error('Error removing role:', error);
      return false;
    }
  }

  private async checkRequirements(member: GuildMember, requirements: any): Promise<boolean> {
    if (!requirements) return true;

    // Check level requirement
    if (requirements.level) {
      // This would integrate with the XP system
      // For now, assume it passes
    }

    // Check role requirements
    if (requirements.roles && requirements.roles.length > 0) {
      const hasRequiredRole = requirements.roles.some((roleId: string) => member.roles.cache.has(roleId));
      if (!hasRequiredRole) return false;
    }

    // Check excluded roles
    if (requirements.excludedRoles && requirements.excludedRoles.length > 0) {
      const hasExcludedRole = requirements.excludedRoles.some((roleId: string) => member.roles.cache.has(roleId));
      if (hasExcludedRole) return false;
    }

    return true;
  }

  public async createPanel(
    guildId: string,
    channelId: string,
    options: Partial<ReactionRolePanel>
  ): Promise<string> {
    const panelId = await db.query(
      `INSERT INTO reaction_role_panels (guild_id, channel_id, title, description, color, type, max_roles, required_roles, allowed_roles, embed_enabled, embed_thumbnail, embed_image, embed_footer)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id`,
      [
        guildId,
        channelId,
        options.title || 'Reaction Roles',
        options.description || 'React to get roles!',
        options.color || colors.primary,
        options.type || 'reaction',
        options.maxRoles || 0,
        options.requiredRoles || [],
        options.allowedRoles || [],
        options.embedEnabled ?? true,
        options.embedThumbnail,
        options.embedImage,
        options.embedFooter,
      ]
    );

    return panelId.rows[0].id;
  }

  public async addRoleToPanel(
    panelId: string,
    roleId: string,
    options: Partial<ReactionRole>
  ): Promise<string> {
    const reactionRoleId = await db.query(
      `INSERT INTO reaction_roles (panel_id, role_id, emoji, label, description, style, requirements)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [
        panelId,
        roleId,
        options.emoji,
        options.label || 'Role',
        options.description,
        options.style || 'Primary',
        JSON.stringify(options.requirements || {}),
      ]
    );

    return reactionRoleId.rows[0].id;
  }

  public async deployPanel(panelId: string): Promise<string | null> {
    const panel = await this.getPanel(panelId);
    if (!panel) return null;

    const roles = await this.getPanelRoles(panelId);
    if (roles.length === 0) return null;

    const channel = global.client?.channels.cache.get(panel.channelId) as TextChannel;
    if (!channel) return null;

    let message;

    switch (panel.type) {
      case 'reaction':
        message = await this.deployReactionPanel(channel, panel, roles);
        break;
      case 'button':
        message = await this.deployButtonPanel(channel, panel, roles);
        break;
      case 'dropdown':
        message = await this.deployDropdownPanel(channel, panel, roles);
        break;
      default:
        return null;
    }

    if (message) {
      await db.query(
        'UPDATE reaction_role_panels SET message_id = $1 WHERE id = $2',
        [message.id, panelId]
      );

      // Add reactions for reaction type
      if (panel.type === 'reaction') {
        for (const role of roles) {
          if (role.emoji) {
            try {
              await message.react(role.emoji);
            } catch (error) {
              console.error('Error adding reaction:', error);
            }
          }
        }
      }

      return message.id;
    }

    return null;
  }

  private async deployReactionPanel(channel: TextChannel, panel: ReactionRolePanel, roles: ReactionRole[]) {
    const embed = this.createPanelEmbed(panel, roles);
    
    embed.addFields({
      name: 'How to use',
      value: 'React with the emojis below to get the corresponding roles!',
      inline: false,
    });

    return await channel.send({ embeds: [embed] });
  }

  private async deployButtonPanel(channel: TextChannel, panel: ReactionRolePanel, roles: ReactionRole[]) {
    const embed = this.createPanelEmbed(panel, roles);
    
    const components: ActionRowBuilder<ButtonBuilder>[] = [];
    let currentRow = new ActionRowBuilder<ButtonBuilder>();
    
    roles.forEach((role, index) => {
      if (index > 0 && index % 5 === 0) {
        components.push(currentRow);
        currentRow = new ActionRowBuilder<ButtonBuilder>();
      }

      const button = new ButtonBuilder()
        .setCustomId(`rr_${panel.id}_${role.id}`)
        .setLabel(role.label)
        .setStyle(this.getButtonStyle(role.style));

      if (role.emoji) {
        button.setEmoji(role.emoji);
      }

      currentRow.addComponents(button);
    });

    if (currentRow.components.length > 0) {
      components.push(currentRow);
    }

    embed.addFields({
      name: 'How to use',
      value: 'Click the buttons below to toggle roles!',
      inline: false,
    });

    return await channel.send({ embeds: [embed], components });
  }

  private async deployDropdownPanel(channel: TextChannel, panel: ReactionRolePanel, roles: ReactionRole[]) {
    const embed = this.createPanelEmbed(panel, roles);
    
    const options = roles.map(role => {
      const option = new StringSelectMenuOptionBuilder()
        .setLabel(role.label)
        .setValue(role.roleId);

      if (role.description) {
        option.setDescription(role.description);
      }

      if (role.emoji) {
        option.setEmoji(role.emoji);
      }

      return option;
    });

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`rr_dropdown_${panel.id}`)
      .setPlaceholder('Select roles...')
      .setMinValues(0)
      .setMaxValues(panel.maxRoles > 0 ? Math.min(panel.maxRoles, roles.length) : roles.length)
      .addOptions(options);

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

    embed.addFields({
      name: 'How to use',
      value: 'Use the dropdown menu below to select roles!',
      inline: false,
    });

    return await channel.send({ embeds: [embed], components: [row] });
  }

  private createPanelEmbed(panel: ReactionRolePanel, roles: ReactionRole[]): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setTitle(panel.title)
      .setDescription(panel.description)
      .setColor(panel.color as any)
      .setTimestamp();

    if (panel.embedThumbnail) {
      embed.setThumbnail(panel.embedThumbnail);
    }

    if (panel.embedImage) {
      embed.setImage(panel.embedImage);
    }

    if (panel.embedFooter) {
      embed.setFooter({ text: panel.embedFooter });
    }

    // Add role list
    const roleList = roles.map(role => {
      const emoji = role.emoji || '•';
      return `${emoji} <@&${role.roleId}> - ${role.description || role.label}`;
    }).join('\n');

    if (roleList) {
      embed.addFields({
        name: 'Available Roles',
        value: roleList,
        inline: false,
      });
    }

    return embed;
  }

  private getButtonStyle(style?: string): ButtonStyle {
    switch (style?.toLowerCase()) {
      case 'secondary':
        return ButtonStyle.Secondary;
      case 'success':
        return ButtonStyle.Success;
      case 'danger':
        return ButtonStyle.Danger;
      default:
        return ButtonStyle.Primary;
    }
  }

  private async getPanel(panelId: string): Promise<ReactionRolePanel | null> {
    const result = await db.query(
      'SELECT * FROM reaction_role_panels WHERE id = $1',
      [panelId]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      id: row.id,
      guildId: row.guild_id,
      channelId: row.channel_id,
      messageId: row.message_id,
      title: row.title,
      description: row.description,
      color: row.color,
      type: row.type,
      maxRoles: row.max_roles,
      requiredRoles: row.required_roles || [],
      allowedRoles: row.allowed_roles || [],
      embedEnabled: row.embed_enabled,
      embedThumbnail: row.embed_thumbnail,
      embedImage: row.embed_image,
      embedFooter: row.embed_footer,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private async getPanelByMessage(messageId: string): Promise<ReactionRolePanel | null> {
    const result = await db.query(
      'SELECT * FROM reaction_role_panels WHERE message_id = $1',
      [messageId]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      id: row.id,
      guildId: row.guild_id,
      channelId: row.channel_id,
      messageId: row.message_id,
      title: row.title,
      description: row.description,
      color: row.color,
      type: row.type,
      maxRoles: row.max_roles,
      requiredRoles: row.required_roles || [],
      allowedRoles: row.allowed_roles || [],
      embedEnabled: row.embed_enabled,
      embedThumbnail: row.embed_thumbnail,
      embedImage: row.embed_image,
      embedFooter: row.embed_footer,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private async getPanelRoles(panelId: string): Promise<ReactionRole[]> {
    const result = await db.query(
      'SELECT * FROM reaction_roles WHERE panel_id = $1 ORDER BY created_at ASC',
      [panelId]
    );

    return result.rows.map((row: any) => ({
      id: row.id,
      panelId: row.panel_id,
      roleId: row.role_id,
      emoji: row.emoji,
      label: row.label,
      description: row.description,
      style: row.style,
      requirements: row.requirements,
      createdAt: row.created_at,
    }));
  }

  private async getReactionRole(panelId: string, emoji: string): Promise<ReactionRole | null> {
    const result = await db.query(
      'SELECT * FROM reaction_roles WHERE panel_id = $1 AND emoji = $2',
      [panelId, emoji]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      id: row.id,
      panelId: row.panel_id,
      roleId: row.role_id,
      emoji: row.emoji,
      label: row.label,
      description: row.description,
      style: row.style,
      requirements: row.requirements,
      createdAt: row.created_at,
    };
  }

  private async getReactionRoleById(id: string): Promise<ReactionRole | null> {
    const result = await db.query(
      'SELECT * FROM reaction_roles WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      id: row.id,
      panelId: row.panel_id,
      roleId: row.role_id,
      emoji: row.emoji,
      label: row.label,
      description: row.description,
      style: row.style,
      requirements: row.requirements,
      createdAt: row.created_at,
    };
  }

  public async getPanels(guildId: string): Promise<ReactionRolePanel[]> {
    const result = await db.query(
      'SELECT * FROM reaction_role_panels WHERE guild_id = $1 ORDER BY created_at DESC',
      [guildId]
    );

    return result.rows.map((row: any) => ({
      id: row.id,
      guildId: row.guild_id,
      channelId: row.channel_id,
      messageId: row.message_id,
      title: row.title,
      description: row.description,
      color: row.color,
      type: row.type,
      maxRoles: row.max_roles,
      requiredRoles: row.required_roles || [],
      allowedRoles: row.allowed_roles || [],
      embedEnabled: row.embed_enabled,
      embedThumbnail: row.embed_thumbnail,
      embedImage: row.embed_image,
      embedFooter: row.embed_footer,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  public async deletePanel(panelId: string): Promise<boolean> {
    await db.transaction(async (client) => {
      await client.query('DELETE FROM reaction_roles WHERE panel_id = $1', [panelId]);
      await client.query('DELETE FROM reaction_role_panels WHERE id = $1', [panelId]);
    });

    return true;
  }
}

export const reactionRolesHandler = ReactionRolesHandler.getInstance();