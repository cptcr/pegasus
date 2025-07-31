import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { premiumHandler } from './premium';
import { createErrorEmbed } from '../utils/helpers';

export class DynamicCommandHandler {
  private static instance: DynamicCommandHandler;
  private registeredCommands = new Set<string>();

  public static getInstance(): DynamicCommandHandler {
    if (!DynamicCommandHandler.instance) {
      DynamicCommandHandler.instance = new DynamicCommandHandler();
    }
    return DynamicCommandHandler.instance;
  }

  // Check if a command should be handled dynamically
  public async shouldHandle(commandName: string, subcommandName?: string): Promise<boolean> {
    if (!subcommandName) return false;
    
    // This will be called from interaction handler
    return true; // We'll check in the execute method
  }

  // Execute a dynamic command
  public async execute(interaction: ChatInputCommandInteraction): Promise<boolean> {
    if (!interaction.guild) return false;

    const commandName = interaction.commandName;
    const subcommandName = interaction.options.getSubcommand(false);

    if (!subcommandName) return false;

    // Try to find and execute custom command
    const customResponse = await premiumHandler.executeCustomCommand(
      interaction.guild.id,
      commandName,
      subcommandName
    );

    if (!customResponse) {
      return false; // Not a custom command
    }

    try {
      if (customResponse.type === 'embed') {
        const embedData = customResponse.data;
        const embed = new EmbedBuilder();

        if (embedData.title) embed.setTitle(embedData.title);
        if (embedData.description) embed.setDescription(embedData.description);
        if (embedData.color) embed.setColor(embedData.color);
        if (embedData.footer) embed.setFooter({ text: embedData.footer });
        if (embedData.image) embed.setImage(embedData.image);

        // Add timestamp if requested
        embed.setTimestamp();

        await interaction.reply({ embeds: [embed] });
      } else if (customResponse.type === 'text') {
        const content = customResponse.data.content;
        await interaction.reply({ content });
      }

      return true;
    } catch (error) {
      console.error('Error executing custom command:', error);
      await interaction.reply({
        embeds: [createErrorEmbed('Command Error', 'There was an error executing this custom command.')],
        ephemeral: true
      });
      return true; // Still handled, just with error
    }
  }

  // Get all custom parent commands for a guild
  public async getCustomParentCommands(guildId: string): Promise<string[]> {
    const commands = await premiumHandler.getCustomCommands(guildId);
    const parentCommands = new Set(commands.map(cmd => cmd.parent_command));
    return Array.from(parentCommands);
  }

  // Register a custom parent command for slash command registration
  public registerCustomCommand(commandName: string): void {
    this.registeredCommands.add(commandName);
  }

  // Check if a command is registered as custom
  public isRegisteredCustomCommand(commandName: string): boolean {
    return this.registeredCommands.has(commandName);
  }

  // Get all registered custom commands
  public getRegisteredCommands(): string[] {
    return Array.from(this.registeredCommands);
  }

  // Clear registered commands (for refresh)
  public clearRegisteredCommands(): void {
    this.registeredCommands.clear();
  }
}

export const dynamicCommandHandler = DynamicCommandHandler.getInstance();