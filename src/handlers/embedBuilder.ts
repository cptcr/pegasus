import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  SelectMenuBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
  ChatInputCommandInteraction,
  ButtonInteraction,
  ModalSubmitInteraction,
  StringSelectMenuInteraction,
  ColorResolvable,
  APIEmbed,
} from 'discord.js';
import { config } from '../config';
import { logger } from '../utils/logger';

export interface EmbedConfig {
  title?: string;
  description?: string;
  color?: ColorResolvable;
  thumbnail?: string;
  image?: string;
  footer?: {
    text: string;
    iconURL?: string;
  };
  author?: {
    name: string;
    iconURL?: string;
    url?: string;
  };
  fields?: Array<{
    name: string;
    value: string;
    inline?: boolean;
  }>;
  timestamp?: boolean;
}

export class InteractiveEmbedBuilder {
  private embedConfig: EmbedConfig = {
    color: config.getColor('primary') as ColorResolvable,
    timestamp: true,
  };
  
  private currentPage: 'main' | 'fields' | 'images' | 'author' = 'main';
  private messageId?: string;
  private channelId?: string;
  private userId: string;
  
  constructor(
    private interaction: ChatInputCommandInteraction | ButtonInteraction,
    private onComplete?: (config: EmbedConfig) => Promise<void>
  ) {
    this.userId = interaction.user.id;
    this.channelId = interaction.channelId;
  }
  
  async start(initialConfig?: EmbedConfig): Promise<void> {
    if (initialConfig) {
      this.embedConfig = { ...this.embedConfig, ...initialConfig };
    }
    
    const embed = this.buildPreviewEmbed();
    const components = this.buildMainComponents();
    
    const response = await this.interaction.reply({
      embeds: [embed],
      components,
      ephemeral: true,
      fetchReply: true,
    });
    
    this.messageId = response.id;
    
    // Set up collector
    this.setupCollector();
  }
  
  private buildPreviewEmbed(): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setTitle(this.embedConfig.title || 'Embed Title')
      .setDescription(this.embedConfig.description || 'Embed description goes here')
      .setColor(this.embedConfig.color || config.getColor('primary') as ColorResolvable);
    
    if (this.embedConfig.thumbnail) {
      embed.setThumbnail(this.embedConfig.thumbnail);
    }
    
    if (this.embedConfig.image) {
      embed.setImage(this.embedConfig.image);
    }
    
    if (this.embedConfig.footer) {
      embed.setFooter(this.embedConfig.footer);
    }
    
    if (this.embedConfig.author) {
      embed.setAuthor(this.embedConfig.author);
    }
    
    if (this.embedConfig.fields && this.embedConfig.fields.length > 0) {
      embed.addFields(this.embedConfig.fields);
    }
    
    if (this.embedConfig.timestamp) {
      embed.setTimestamp();
    }
    
    return embed;
  }
  
  private buildMainComponents(): ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] {
    const components: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] = [];
    
    if (this.currentPage === 'main') {
      // Row 1: Basic options
      const row1 = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('embed_title')
            .setLabel('Title')
            .setEmoji(config.getEmoji('edit'))
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId('embed_description')
            .setLabel('Description')
            .setEmoji(config.getEmoji('edit'))
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId('embed_color')
            .setLabel('Color')
            .setEmoji('🎨')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId('embed_fields')
            .setLabel('Fields')
            .setEmoji(config.getEmoji('plus'))
            .setStyle(ButtonStyle.Primary)
        );
      
      // Row 2: Advanced options
      const row2 = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('embed_images')
            .setLabel('Images')
            .setEmoji('🖼️')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId('embed_author')
            .setLabel('Author')
            .setEmoji('👤')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId('embed_footer')
            .setLabel('Footer')
            .setEmoji('📝')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId('embed_timestamp')
            .setLabel('Timestamp')
            .setEmoji('⏰')
            .setStyle(this.embedConfig.timestamp ? ButtonStyle.Success : ButtonStyle.Secondary)
        );
      
      // Row 3: Templates
      const row3 = new ActionRowBuilder<StringSelectMenuBuilder>()
        .addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('embed_template')
            .setPlaceholder('Choose a template...')
            .addOptions([
              {
                label: 'Basic Giveaway',
                description: 'Simple giveaway embed template',
                value: 'giveaway_basic',
                emoji: '🎁',
              },
              {
                label: 'Premium Giveaway',
                description: 'Fancy giveaway with all features',
                value: 'giveaway_premium',
                emoji: '💎',
              },
              {
                label: 'Announcement',
                description: 'Server announcement template',
                value: 'announcement',
                emoji: '📢',
              },
              {
                label: 'Event',
                description: 'Event announcement template',
                value: 'event',
                emoji: '🎉',
              },
              {
                label: 'Rules',
                description: 'Server rules template',
                value: 'rules',
                emoji: '📜',
              },
              {
                label: 'Clear',
                description: 'Start with a blank embed',
                value: 'clear',
                emoji: '🗑️',
              },
            ])
        );
      
      // Row 4: Actions
      const row4 = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('embed_preview')
            .setLabel('Preview')
            .setEmoji('👁️')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId('embed_save_template')
            .setLabel('Save as Template')
            .setEmoji(config.getEmoji('save'))
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId('embed_done')
            .setLabel('Done')
            .setEmoji(config.getEmoji('success'))
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId('embed_cancel')
            .setLabel('Cancel')
            .setEmoji(config.getEmoji('cancel'))
            .setStyle(ButtonStyle.Danger)
        );
      
      components.push(row1, row2, row3, row4);
    } else if (this.currentPage === 'fields') {
      // Fields management page
      const fieldButtons = this.embedConfig.fields?.map((field, index) => 
        new ButtonBuilder()
          .setCustomId(`embed_field_edit_${index}`)
          .setLabel(`Edit Field ${index + 1}`)
          .setStyle(ButtonStyle.Primary)
      ) || [];
      
      const rows: ActionRowBuilder<ButtonBuilder>[] = [];
      
      // Add field buttons in rows of 4
      for (let i = 0; i < fieldButtons.length; i += 4) {
        const row = new ActionRowBuilder<ButtonBuilder>()
          .addComponents(fieldButtons.slice(i, i + 4));
        rows.push(row);
      }
      
      // Add control buttons
      const controlRow = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('embed_field_add')
            .setLabel('Add Field')
            .setEmoji(config.getEmoji('plus'))
            .setStyle(ButtonStyle.Success)
            .setDisabled((this.embedConfig.fields?.length || 0) >= 25),
          new ButtonBuilder()
            .setCustomId('embed_field_clear')
            .setLabel('Clear All')
            .setEmoji(config.getEmoji('trash'))
            .setStyle(ButtonStyle.Danger)
            .setDisabled(!this.embedConfig.fields || this.embedConfig.fields.length === 0),
          new ButtonBuilder()
            .setCustomId('embed_back')
            .setLabel('Back')
            .setEmoji(config.getEmoji('back'))
            .setStyle(ButtonStyle.Secondary)
        );
      
      rows.push(controlRow);
      components.push(...rows.slice(0, 5)); // Discord limit
    }
    
    return components;
  }
  
  private setupCollector(): void {
    if (!this.messageId || !this.channelId) return;
    
    const filter = (i: any) => i.user.id === this.userId;
    const collector = this.interaction.channel?.createMessageComponentCollector({
      filter,
      time: 600000, // 10 minutes
    });
    
    collector?.on('collect', async (i) => {
      try {
        if (i.isButton()) {
          await this.handleButtonClick(i);
        } else if (i.isStringSelectMenu()) {
          await this.handleSelectMenu(i);
        }
      } catch (error) {
        logger.error('Error in embed builder collector', error as Error);
        await i.reply({
          content: 'An error occurred. Please try again.',
          ephemeral: true,
        });
      }
    });
    
    collector?.on('end', () => {
      logger.debug('Embed builder collector ended');
    });
  }
  
  private async handleButtonClick(interaction: ButtonInteraction): Promise<void> {
    const customId = interaction.customId;
    
    switch (customId) {
      case 'embed_title':
        await this.showTitleModal(interaction);
        break;
      
      case 'embed_description':
        await this.showDescriptionModal(interaction);
        break;
      
      case 'embed_color':
        await this.showColorModal(interaction);
        break;
      
      case 'embed_fields':
        this.currentPage = 'fields';
        await this.updateMessage(interaction);
        break;
      
      case 'embed_images':
        await this.showImagesModal(interaction);
        break;
      
      case 'embed_author':
        await this.showAuthorModal(interaction);
        break;
      
      case 'embed_footer':
        await this.showFooterModal(interaction);
        break;
      
      case 'embed_timestamp':
        this.embedConfig.timestamp = !this.embedConfig.timestamp;
        await this.updateMessage(interaction);
        break;
      
      case 'embed_preview':
        await this.showPreview(interaction);
        break;
      
      case 'embed_done':
        if (this.onComplete) {
          await this.onComplete(this.embedConfig);
        }
        await interaction.update({
          content: 'Embed configuration saved!',
          embeds: [],
          components: [],
        });
        break;
      
      case 'embed_cancel':
        await interaction.update({
          content: 'Embed builder cancelled.',
          embeds: [],
          components: [],
        });
        break;
      
      case 'embed_back':
        this.currentPage = 'main';
        await this.updateMessage(interaction);
        break;
      
      case 'embed_field_add':
        await this.showFieldModal(interaction);
        break;
      
      case 'embed_field_clear':
        this.embedConfig.fields = [];
        await this.updateMessage(interaction);
        break;
      
      default:
        if (customId.startsWith('embed_field_edit_')) {
          const index = parseInt(customId.split('_')[3]);
          await this.showFieldModal(interaction, index);
        }
    }
  }
  
  private async handleSelectMenu(interaction: StringSelectMenuInteraction): Promise<void> {
    if (interaction.customId === 'embed_template') {
      const template = interaction.values[0];
      this.applyTemplate(template);
      await this.updateMessage(interaction);
    }
  }
  
  private async updateMessage(interaction: ButtonInteraction | StringSelectMenuInteraction): Promise<void> {
    const embed = this.buildPreviewEmbed();
    const components = this.buildMainComponents();
    
    await interaction.update({
      embeds: [embed],
      components,
    });
  }
  
  private async showTitleModal(interaction: ButtonInteraction): Promise<void> {
    const modal = new ModalBuilder()
      .setCustomId('embed_title_modal')
      .setTitle('Edit Embed Title');
    
    const titleInput = new TextInputBuilder()
      .setCustomId('title')
      .setLabel('Title')
      .setStyle(TextInputStyle.Short)
      .setMaxLength(256)
      .setRequired(false)
      .setValue(this.embedConfig.title || '');
    
    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(titleInput));
    
    await interaction.showModal(modal);
    
    try {
      const submission = await interaction.awaitModalSubmit({
        time: 60000,
        filter: (i) => i.customId === 'embed_title_modal' && i.user.id === this.userId,
      });
      
      this.embedConfig.title = submission.fields.getTextInputValue('title') || undefined;
      await this.updateMessage(submission);
    } catch (error) {
      // Modal timed out
    }
  }
  
  private async showDescriptionModal(interaction: ButtonInteraction): Promise<void> {
    const modal = new ModalBuilder()
      .setCustomId('embed_description_modal')
      .setTitle('Edit Embed Description');
    
    const descriptionInput = new TextInputBuilder()
      .setCustomId('description')
      .setLabel('Description')
      .setStyle(TextInputStyle.Paragraph)
      .setMaxLength(4096)
      .setRequired(false)
      .setValue(this.embedConfig.description || '');
    
    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(descriptionInput));
    
    await interaction.showModal(modal);
    
    try {
      const submission = await interaction.awaitModalSubmit({
        time: 60000,
        filter: (i) => i.customId === 'embed_description_modal' && i.user.id === this.userId,
      });
      
      this.embedConfig.description = submission.fields.getTextInputValue('description') || undefined;
      await this.updateMessage(submission);
    } catch (error) {
      // Modal timed out
    }
  }
  
  private async showColorModal(interaction: ButtonInteraction): Promise<void> {
    const modal = new ModalBuilder()
      .setCustomId('embed_color_modal')
      .setTitle('Edit Embed Color');
    
    const colorInput = new TextInputBuilder()
      .setCustomId('color')
      .setLabel('Color (hex code or color name)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('#0099ff or Blue')
      .setRequired(false)
      .setValue(this.embedConfig.color?.toString() || '');
    
    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(colorInput));
    
    await interaction.showModal(modal);
    
    try {
      const submission = await interaction.awaitModalSubmit({
        time: 60000,
        filter: (i) => i.customId === 'embed_color_modal' && i.user.id === this.userId,
      });
      
      const colorValue = submission.fields.getTextInputValue('color');
      if (colorValue) {
        // Try to parse as hex
        if (colorValue.startsWith('#')) {
          this.embedConfig.color = colorValue as ColorResolvable;
        } else {
          // Try color names
          const colorMap: Record<string, ColorResolvable> = {
            'red': '#ff0000',
            'green': '#00ff00',
            'blue': '#0000ff',
            'yellow': '#ffff00',
            'purple': '#800080',
            'orange': '#ffa500',
            'pink': '#ffc0cb',
            'black': '#000000',
            'white': '#ffffff',
            'gray': '#808080',
            'grey': '#808080',
          };
          
          this.embedConfig.color = colorMap[colorValue.toLowerCase()] || config.getColor('primary') as ColorResolvable;
        }
      }
      
      await this.updateMessage(submission);
    } catch (error) {
      // Modal timed out
    }
  }
  
  private async showFieldModal(interaction: ButtonInteraction, index?: number): Promise<void> {
    const isEdit = index !== undefined;
    const field = isEdit ? this.embedConfig.fields?.[index] : undefined;
    
    const modal = new ModalBuilder()
      .setCustomId(`embed_field_modal_${index ?? 'new'}`)
      .setTitle(isEdit ? `Edit Field ${index + 1}` : 'Add New Field');
    
    const nameInput = new TextInputBuilder()
      .setCustomId('name')
      .setLabel('Field Name')
      .setStyle(TextInputStyle.Short)
      .setMaxLength(256)
      .setRequired(true)
      .setValue(field?.name || '');
    
    const valueInput = new TextInputBuilder()
      .setCustomId('value')
      .setLabel('Field Value')
      .setStyle(TextInputStyle.Paragraph)
      .setMaxLength(1024)
      .setRequired(true)
      .setValue(field?.value || '');
    
    const inlineInput = new TextInputBuilder()
      .setCustomId('inline')
      .setLabel('Inline? (yes/no)')
      .setStyle(TextInputStyle.Short)
      .setMaxLength(3)
      .setRequired(false)
      .setValue(field?.inline ? 'yes' : 'no');
    
    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(valueInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(inlineInput)
    );
    
    await interaction.showModal(modal);
    
    try {
      const submission = await interaction.awaitModalSubmit({
        time: 60000,
        filter: (i) => i.customId === `embed_field_modal_${index ?? 'new'}` && i.user.id === this.userId,
      });
      
      const newField = {
        name: submission.fields.getTextInputValue('name'),
        value: submission.fields.getTextInputValue('value'),
        inline: submission.fields.getTextInputValue('inline')?.toLowerCase() === 'yes',
      };
      
      if (!this.embedConfig.fields) {
        this.embedConfig.fields = [];
      }
      
      if (isEdit) {
        this.embedConfig.fields[index] = newField;
      } else {
        this.embedConfig.fields.push(newField);
      }
      
      this.currentPage = 'fields';
      await this.updateMessage(submission);
    } catch (error) {
      // Modal timed out
    }
  }
  
  private async showImagesModal(interaction: ButtonInteraction): Promise<void> {
    const modal = new ModalBuilder()
      .setCustomId('embed_images_modal')
      .setTitle('Edit Embed Images');
    
    const thumbnailInput = new TextInputBuilder()
      .setCustomId('thumbnail')
      .setLabel('Thumbnail URL')
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setValue(this.embedConfig.thumbnail || '');
    
    const imageInput = new TextInputBuilder()
      .setCustomId('image')
      .setLabel('Image URL')
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setValue(this.embedConfig.image || '');
    
    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(thumbnailInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(imageInput)
    );
    
    await interaction.showModal(modal);
    
    try {
      const submission = await interaction.awaitModalSubmit({
        time: 60000,
        filter: (i) => i.customId === 'embed_images_modal' && i.user.id === this.userId,
      });
      
      this.embedConfig.thumbnail = submission.fields.getTextInputValue('thumbnail') || undefined;
      this.embedConfig.image = submission.fields.getTextInputValue('image') || undefined;
      
      await this.updateMessage(submission);
    } catch (error) {
      // Modal timed out
    }
  }
  
  private async showAuthorModal(interaction: ButtonInteraction): Promise<void> {
    const modal = new ModalBuilder()
      .setCustomId('embed_author_modal')
      .setTitle('Edit Embed Author');
    
    const nameInput = new TextInputBuilder()
      .setCustomId('name')
      .setLabel('Author Name')
      .setStyle(TextInputStyle.Short)
      .setMaxLength(256)
      .setRequired(false)
      .setValue(this.embedConfig.author?.name || '');
    
    const iconInput = new TextInputBuilder()
      .setCustomId('icon')
      .setLabel('Author Icon URL')
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setValue(this.embedConfig.author?.iconURL || '');
    
    const urlInput = new TextInputBuilder()
      .setCustomId('url')
      .setLabel('Author URL')
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setValue(this.embedConfig.author?.url || '');
    
    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(iconInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(urlInput)
    );
    
    await interaction.showModal(modal);
    
    try {
      const submission = await interaction.awaitModalSubmit({
        time: 60000,
        filter: (i) => i.customId === 'embed_author_modal' && i.user.id === this.userId,
      });
      
      const name = submission.fields.getTextInputValue('name');
      if (name) {
        this.embedConfig.author = {
          name,
          iconURL: submission.fields.getTextInputValue('icon') || undefined,
          url: submission.fields.getTextInputValue('url') || undefined,
        };
      } else {
        this.embedConfig.author = undefined;
      }
      
      await this.updateMessage(submission);
    } catch (error) {
      // Modal timed out
    }
  }
  
  private async showFooterModal(interaction: ButtonInteraction): Promise<void> {
    const modal = new ModalBuilder()
      .setCustomId('embed_footer_modal')
      .setTitle('Edit Embed Footer');
    
    const textInput = new TextInputBuilder()
      .setCustomId('text')
      .setLabel('Footer Text')
      .setStyle(TextInputStyle.Short)
      .setMaxLength(2048)
      .setRequired(false)
      .setValue(this.embedConfig.footer?.text || '');
    
    const iconInput = new TextInputBuilder()
      .setCustomId('icon')
      .setLabel('Footer Icon URL')
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setValue(this.embedConfig.footer?.iconURL || '');
    
    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(textInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(iconInput)
    );
    
    await interaction.showModal(modal);
    
    try {
      const submission = await interaction.awaitModalSubmit({
        time: 60000,
        filter: (i) => i.customId === 'embed_footer_modal' && i.user.id === this.userId,
      });
      
      const text = submission.fields.getTextInputValue('text');
      if (text) {
        this.embedConfig.footer = {
          text,
          iconURL: submission.fields.getTextInputValue('icon') || undefined,
        };
      } else {
        this.embedConfig.footer = undefined;
      }
      
      await this.updateMessage(submission);
    } catch (error) {
      // Modal timed out
    }
  }
  
  private async showPreview(interaction: ButtonInteraction): Promise<void> {
    const embed = this.buildPreviewEmbed();
    
    await interaction.reply({
      content: 'Here\'s a preview of your embed:',
      embeds: [embed],
      ephemeral: true,
    });
  }
  
  private applyTemplate(template: string): void {
    switch (template) {
      case 'giveaway_basic':
        this.embedConfig = {
          title: '🎉 GIVEAWAY 🎉',
          description: 'React with 🎉 to enter!\n\n**Prize:** [Prize Name]\n**Winners:** 1\n**Ends:** <t:TIMESTAMP:R>',
          color: config.getColor('primary') as ColorResolvable,
          fields: [
            { name: '📋 Requirements', value: '• Must be in the server\n• Account older than 7 days', inline: false },
            { name: '👥 Entries', value: '0', inline: true },
            { name: '⏰ Duration', value: '24 hours', inline: true },
          ],
          footer: { text: 'Good luck!' },
          timestamp: true,
        };
        break;
      
      case 'giveaway_premium':
        this.embedConfig = {
          title: '🎉 **EXCLUSIVE GIVEAWAY** 🎉',
          description: '> An amazing giveaway is here! Click the button below to participate.\n\n🎁 **Prize Details**\n```\n[Describe your prize here]\n```\n\n✨ **How to Enter**\n• Click the "Enter Giveaway" button\n• Meet all requirements listed below\n• Wait for the results!',
          color: '#FFD700' as ColorResolvable,
          thumbnail: 'https://i.imgur.com/AfFp7pu.png',
          fields: [
            { name: '📋 Entry Requirements', value: '• Level 5+ in server\n• Account age: 30+ days\n• Must have @Member role', inline: false },
            { name: '🎯 Bonus Entries', value: '• Server Boosters: +2 entries\n• @VIP Role: +3 entries\n• Level 10+: +1 entry', inline: false },
            { name: '📊 Statistics', value: 'Entries: **0**\nTime Left: **24h**', inline: true },
            { name: '🏆 Winners', value: '**3** winners\nwill be selected', inline: true },
          ],
          author: {
            name: interaction.guild?.name || 'Server Giveaway',
            iconURL: interaction.guild?.iconURL() || undefined,
          },
          footer: {
            text: 'Powered by Pegasus Bot • ID: ',
            iconURL: interaction.client.user?.displayAvatarURL(),
          },
          timestamp: true,
        };
        break;
      
      case 'announcement':
        this.embedConfig = {
          title: '📢 Server Announcement',
          description: 'Important announcement content goes here.',
          color: config.getColor('info') as ColorResolvable,
          fields: [
            { name: '📅 Date', value: new Date().toLocaleDateString(), inline: true },
            { name: '👤 Announced by', value: interaction.user.toString(), inline: true },
          ],
          footer: { text: interaction.guild?.name || 'Server' },
          timestamp: true,
        };
        break;
      
      case 'event':
        this.embedConfig = {
          title: '🎉 Upcoming Event',
          description: 'Join us for an exciting community event!',
          color: config.getColor('purple') as ColorResolvable,
          fields: [
            { name: '📅 When', value: 'Saturday, 8 PM EST', inline: true },
            { name: '📍 Where', value: 'Event Voice Channel', inline: true },
            { name: '🎮 What', value: 'Game Night', inline: true },
            { name: '📝 Details', value: 'More information about the event...', inline: false },
          ],
          thumbnail: interaction.guild?.iconURL() || undefined,
          timestamp: true,
        };
        break;
      
      case 'rules':
        this.embedConfig = {
          title: '📜 Server Rules',
          description: 'Please read and follow all server rules to maintain a positive community.',
          color: config.getColor('red') as ColorResolvable,
          fields: [
            { name: '1️⃣ Be Respectful', value: 'Treat all members with respect.', inline: false },
            { name: '2️⃣ No Spam', value: 'Avoid spamming in any channel.', inline: false },
            { name: '3️⃣ No NSFW', value: 'Keep content appropriate for all ages.', inline: false },
            { name: '4️⃣ English Only', value: 'Please use English in all channels.', inline: false },
            { name: '5️⃣ Follow Discord ToS', value: 'Abide by Discord\'s Terms of Service.', inline: false },
          ],
          footer: { text: 'Last updated' },
          timestamp: true,
        };
        break;
      
      case 'clear':
        this.embedConfig = {
          color: config.getColor('primary') as ColorResolvable,
          timestamp: true,
        };
        break;
    }
  }
}

export async function createEmbedBuilder(
  interaction: ChatInputCommandInteraction | ButtonInteraction,
  onComplete: (config: EmbedConfig) => Promise<void>,
  initialConfig?: EmbedConfig
): Promise<InteractiveEmbedBuilder> {
  const builder = new InteractiveEmbedBuilder(interaction, onComplete);
  await builder.start(initialConfig);
  return builder;
}