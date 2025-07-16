import { 
  GuildMember, 
  TextChannel, 
  EmbedBuilder, 
  AttachmentBuilder
} from 'discord.js';
// Canvas functionality disabled for compatibility
// import { Canvas, createCanvas, loadImage } from '@napi-rs/canvas';
import { db } from '../database/connection';
import { createEmbed } from '../utils/helpers';
import { colors, emojis } from '../utils/config';

interface WelcomeSettings {
  guildId: string;
  welcomeEnabled: boolean;
  welcomeChannel?: string;
  welcomeMessage?: string;
  welcomeImage: boolean;
  welcomeImageTemplate: string;
  welcomeCard: boolean;
  welcomeCardColor: string;
  welcomeRoles: string[];
  goodbyeEnabled: boolean;
  goodbyeChannel?: string;
  goodbyeMessage?: string;
  goodbyeImage: boolean;
  dmWelcome: boolean;
  dmMessage?: string;
  autoroleEnabled: boolean;
  autoroles: string[];
  welcomeEmbed: boolean;
  embedTitle?: string;
  embedDescription?: string;
  embedColor: string;
  embedThumbnail: boolean;
  embedFooter?: string;
}

export class WelcomeHandler {
  private static instance: WelcomeHandler;

  public static getInstance(): WelcomeHandler {
    if (!WelcomeHandler.instance) {
      WelcomeHandler.instance = new WelcomeHandler();
    }
    return WelcomeHandler.instance;
  }

  public async handleMemberJoin(member: GuildMember): Promise<void> {
    const settings = await this.getWelcomeSettings(member.guild.id);
    
    if (!settings.welcomeEnabled) return;

    // Apply autoroles
    if (settings.autoroleEnabled && settings.autoroles.length > 0) {
      await this.applyAutoroles(member, settings.autoroles);
    }

    // Send welcome message
    if (settings.welcomeChannel) {
      await this.sendWelcomeMessage(member, settings);
    }

    // Send DM welcome
    if (settings.dmWelcome && settings.dmMessage) {
      await this.sendDMWelcome(member, settings);
    }
  }

  public async handleMemberLeave(member: GuildMember): Promise<void> {
    const settings = await this.getWelcomeSettings(member.guild.id);
    
    if (!settings.goodbyeEnabled || !settings.goodbyeChannel) return;

    await this.sendGoodbyeMessage(member, settings);
  }

  private async sendWelcomeMessage(member: GuildMember, settings: WelcomeSettings): Promise<void> {
    const channel = member.guild.channels.cache.get(settings.welcomeChannel!) as TextChannel;
    if (!channel) return;

    try {
      const messageContent = this.parseMessage(settings.welcomeMessage || '', member);
      const attachments: AttachmentBuilder[] = [];

      // Create welcome card if enabled
      if (settings.welcomeCard || settings.welcomeImage) {
        const cardBuffer = await this.createWelcomeCard(member, settings);
        if (cardBuffer) {
          attachments.push(new AttachmentBuilder(cardBuffer, { name: 'welcome.png' }));
        }
      }

      if (settings.welcomeEmbed) {
        // Send as embed
        const embed = this.createWelcomeEmbed(member, settings);
        
        if (attachments.length > 0) {
          embed.setImage('attachment://welcome.png');
        }

        await channel.send({ 
          content: messageContent || undefined, 
          embeds: [embed], 
          files: attachments 
        });
      } else {
        // Send as regular message
        await channel.send({ 
          content: messageContent || `Welcome ${member}!`, 
          files: attachments 
        });
      }

    } catch (error) {
      console.error('Error sending welcome message:', error);
    }
  }

  private async sendGoodbyeMessage(member: GuildMember, settings: WelcomeSettings): Promise<void> {
    const channel = member.guild.channels.cache.get(settings.goodbyeChannel!) as TextChannel;
    if (!channel) return;

    try {
      const messageContent = this.parseMessage(settings.goodbyeMessage || '', member);
      const attachments: AttachmentBuilder[] = [];

      // Create goodbye image if enabled
      if (settings.goodbyeImage) {
        const cardBuffer = await this.createGoodbyeCard(member, settings);
        if (cardBuffer) {
          attachments.push(new AttachmentBuilder(cardBuffer, { name: 'goodbye.png' }));
        }
      }

      const embed = createEmbed({
        title: `${emojis.error} Member Left`,
        description: messageContent || `${member.user.tag} has left the server.`,
        color: colors.error,
        thumbnail: member.user.displayAvatarURL(),
        fields: [
          {
            name: 'Member Count',
            value: member.guild.memberCount.toString(),
            inline: true,
          },
          {
            name: 'Joined',
            value: member.joinedAt ? `<t:${Math.floor(member.joinedAt.getTime() / 1000)}:R>` : 'Unknown',
            inline: true,
          },
        ],
        timestamp: true,
      });

      if (attachments.length > 0) {
        embed.setImage('attachment://goodbye.png');
      }

      await channel.send({ embeds: [embed], files: attachments });

    } catch (error) {
      console.error('Error sending goodbye message:', error);
    }
  }

  private async sendDMWelcome(member: GuildMember, settings: WelcomeSettings): Promise<void> {
    try {
      const messageContent = this.parseMessage(settings.dmMessage || '', member);
      
      const embed = createEmbed({
        title: `${emojis.tada} Welcome to ${member.guild.name}!`,
        description: messageContent,
        color: colors.success,
        thumbnail: member.guild.iconURL() || undefined,
        footer: `You are member #${member.guild.memberCount}`,
        timestamp: true,
      });

      await member.send({ embeds: [embed] });

    } catch (error) {
      console.log('Could not send DM welcome to user');
    }
  }

  private createWelcomeEmbed(member: GuildMember, settings: WelcomeSettings): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setColor(settings.embedColor as any || colors.success)
      .setTimestamp();

    if (settings.embedTitle) {
      embed.setTitle(this.parseMessage(settings.embedTitle, member));
    } else {
      embed.setTitle(`${emojis.tada} Welcome to ${member.guild.name}!`);
    }

    if (settings.embedDescription) {
      embed.setDescription(this.parseMessage(settings.embedDescription, member));
    }

    if (settings.embedThumbnail) {
      embed.setThumbnail(member.user.displayAvatarURL());
    }

    if (settings.embedFooter) {
      embed.setFooter({ text: this.parseMessage(settings.embedFooter, member) });
    } else {
      embed.setFooter({ text: `Member #${member.guild.memberCount}` });
    }

    embed.addFields(
      {
        name: 'Account Created',
        value: `<t:${Math.floor(member.user.createdAt.getTime() / 1000)}:R>`,
        inline: true,
      },
      {
        name: 'Member Count',
        value: member.guild.memberCount.toString(),
        inline: true,
      }
    );

    return embed;
  }

  private async createWelcomeCard(member: GuildMember, settings: WelcomeSettings): Promise<Buffer | null> {
    // Canvas functionality disabled for compatibility
    return null;
    /*
    try {
      // Create canvas
      const canvas = createCanvas(800, 300);
      const ctx = canvas.getContext('2d');

      // Background gradient
      const gradient = ctx.createLinearGradient(0, 0, 800, 300);
      gradient.addColorStop(0, settings.welcomeCardColor || '#7289da');
      gradient.addColorStop(1, '#2c2f33');
      
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 800, 300);

      // Draw pattern overlay
      ctx.globalAlpha = 0.1;
      for (let i = 0; i < 800; i += 50) {
        for (let j = 0; j < 300; j += 50) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(i, j, 25, 25);
        }
      }
      ctx.globalAlpha = 1;

      // Load and draw avatar
      try {
        const avatar = await loadImage(member.user.displayAvatarURL({ extension: 'png', size: 256 }));
        
        // Draw avatar circle
        ctx.save();
        ctx.beginPath();
        ctx.arc(150, 150, 80, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(avatar, 70, 70, 160, 160);
        ctx.restore();

        // Avatar border
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(150, 150, 80, 0, Math.PI * 2);
        ctx.stroke();
      } catch (error) {
        console.error('Error loading avatar:', error);
      }

      // Welcome text
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 48px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('WELCOME', 500, 100);

      // Username
      ctx.font = 'bold 32px Arial';
      const username = member.user.username.length > 20 
        ? member.user.username.substring(0, 20) + '...' 
        : member.user.username;
      ctx.fillText(username, 500, 150);

      // Server name
      ctx.font = '24px Arial';
      ctx.fillStyle = '#b9bbbe';
      const serverName = member.guild.name.length > 25 
        ? member.guild.name.substring(0, 25) + '...' 
        : member.guild.name;
      ctx.fillText(`to ${serverName}`, 500, 180);

      // Member count
      ctx.font = '20px Arial';
      ctx.fillText(`Member #${member.guild.memberCount}`, 500, 220);

      return canvas.toBuffer();

    } catch (error) {
      console.error('Error creating welcome card:', error);
      return null;
    }
    */
  }

  private async createGoodbyeCard(member: GuildMember, settings: WelcomeSettings): Promise<Buffer | null> {
    // Canvas functionality disabled for compatibility
    return null;
    /*
    try {
      // Create canvas
      const canvas = createCanvas(800, 300);
      const ctx = canvas.getContext('2d');

      // Background gradient (darker for goodbye)
      const gradient = ctx.createLinearGradient(0, 0, 800, 300);
      gradient.addColorStop(0, '#2c2f33');
      gradient.addColorStop(1, '#23272a');
      
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 800, 300);

      // Load and draw avatar (faded)
      try {
        const avatar = await loadImage(member.user.displayAvatarURL({ extension: 'png', size: 256 }));
        
        ctx.save();
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.arc(150, 150, 80, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(avatar, 70, 70, 160, 160);
        ctx.restore();

        // Avatar border
        ctx.strokeStyle = '#99aab5';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(150, 150, 80, 0, Math.PI * 2);
        ctx.stroke();
      } catch (error) {
        console.error('Error loading avatar:', error);
      }

      // Goodbye text
      ctx.fillStyle = '#99aab5';
      ctx.font = 'bold 48px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('GOODBYE', 500, 100);

      // Username
      ctx.font = 'bold 32px Arial';
      const username = member.user.username.length > 20 
        ? member.user.username.substring(0, 20) + '...' 
        : member.user.username;
      ctx.fillText(username, 500, 150);

      // Server name
      ctx.font = '24px Arial';
      ctx.fillStyle = '#72767d';
      ctx.fillText(`Thanks for being part of ${member.guild.name}`, 500, 180);

      return canvas.toBuffer();

    } catch (error) {
      console.error('Error creating goodbye card:', error);
      return null;
    }
    */
  }

  private async applyAutoroles(member: GuildMember, autoroles: string[]): Promise<void> {
    try {
      const roles = autoroles
        .map(roleId => member.guild.roles.cache.get(roleId))
        .filter(role => role && role.position < member.guild.members.me!.roles.highest.position)
        .filter(role => role !== undefined);

      if (roles.length > 0) {
        await member.roles.add(roles as any, 'Autorole on join');
      }
    } catch (error) {
      console.error('Error applying autoroles:', error);
    }
  }

  private parseMessage(message: string, member: GuildMember): string {
    return message
      .replace(/{user}/g, member.toString())
      .replace(/{user\.tag}/g, member.user.tag)
      .replace(/{user\.username}/g, member.user.username)
      .replace(/{user\.id}/g, member.user.id)
      .replace(/{server}/g, member.guild.name)
      .replace(/{server\.name}/g, member.guild.name)
      .replace(/{server\.id}/g, member.guild.id)
      .replace(/{membercount}/g, member.guild.memberCount.toString())
      .replace(/{member\.count}/g, member.guild.memberCount.toString())
      .replace(/{user\.avatar}/g, member.user.displayAvatarURL())
      .replace(/{server\.icon}/g, member.guild.iconURL() || '')
      .replace(/{date}/g, new Date().toLocaleDateString())
      .replace(/{time}/g, new Date().toLocaleTimeString());
  }

  private async getWelcomeSettings(guildId: string): Promise<WelcomeSettings> {
    const result = await db.query(
      `SELECT 
        welcome_enabled, welcome_channel, welcome_message, welcome_image, welcome_image_template,
        welcome_card, welcome_card_color, welcome_roles, goodbye_enabled, goodbye_channel, 
        goodbye_message, goodbye_image, dm_welcome, dm_message, autorole_enabled, autoroles,
        welcome_embed, embed_title, embed_description, embed_color, embed_thumbnail, embed_footer
       FROM guild_settings WHERE guild_id = $1`,
      [guildId]
    );

    const settings = result.rows[0] || {};

    return {
      guildId,
      welcomeEnabled: settings.welcome_enabled || false,
      welcomeChannel: settings.welcome_channel,
      welcomeMessage: settings.welcome_message,
      welcomeImage: settings.welcome_image || false,
      welcomeImageTemplate: settings.welcome_image_template || 'default',
      welcomeCard: settings.welcome_card || false,
      welcomeCardColor: settings.welcome_card_color || '#7289da',
      welcomeRoles: settings.welcome_roles || [],
      goodbyeEnabled: settings.goodbye_enabled || false,
      goodbyeChannel: settings.goodbye_channel,
      goodbyeMessage: settings.goodbye_message,
      goodbyeImage: settings.goodbye_image || false,
      dmWelcome: settings.dm_welcome || false,
      dmMessage: settings.dm_message,
      autoroleEnabled: settings.autorole_enabled || false,
      autoroles: settings.autoroles || [],
      welcomeEmbed: settings.welcome_embed || true,
      embedTitle: settings.embed_title,
      embedDescription: settings.embed_description,
      embedColor: settings.embed_color || colors.success,
      embedThumbnail: settings.embed_thumbnail || true,
      embedFooter: settings.embed_footer,
    };
  }

  public async updateWelcomeSettings(guildId: string, updates: Partial<WelcomeSettings>): Promise<void> {
    const fields = Object.keys(updates).filter(key => key !== 'guildId');
    if (fields.length === 0) return;

    const setClause = fields.map((field, index) => {
      const dbField = field.replace(/([A-Z])/g, '_$1').toLowerCase();
      return `${dbField} = $${index + 2}`;
    }).join(', ');

    const values = fields.map(field => (updates as any)[field]);

    await db.query(
      `INSERT INTO guild_settings (guild_id, ${fields.map(f => f.replace(/([A-Z])/g, '_$1').toLowerCase()).join(', ')})
       VALUES ($1, ${fields.map((_, i) => `$${i + 2}`).join(', ')})
       ON CONFLICT (guild_id) 
       DO UPDATE SET ${setClause}, updated_at = CURRENT_TIMESTAMP`,
      [guildId, ...values]
    );
  }

  public async testWelcome(member: GuildMember): Promise<void> {
    await this.handleMemberJoin(member);
  }

  public async testGoodbye(member: GuildMember): Promise<void> {
    await this.handleMemberLeave(member);
  }
}

export const welcomeHandler = WelcomeHandler.getInstance();