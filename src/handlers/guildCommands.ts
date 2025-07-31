import { 
  ChatInputCommandInteraction, 
  EmbedBuilder,
  REST,
  Routes,
  SlashCommandBuilder
} from 'discord.js';
import { premiumHandler } from './premium';
import { createErrorEmbed } from '../utils/helpers';

export class GuildCommandHandler {
  private static instance: GuildCommandHandler;
  private registeredCommands = new Map<string, Set<string>>(); // guildId -> Set of command names
  private rest: REST;

  public static getInstance(): GuildCommandHandler {
    if (!GuildCommandHandler.instance) {
      GuildCommandHandler.instance = new GuildCommandHandler();
    }
    return GuildCommandHandler.instance;
  }

  constructor() {
    this.rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!);
  }

  // Register a guild command with Discord
  public async registerGuildCommand(guildId: string, commandName: string, description: string): Promise<string | null> {
    try {
      const command = new SlashCommandBuilder()
        .setName(commandName)
        .setDescription(description)
        .setDMPermission(false);

      const response = await this.rest.post(
        Routes.applicationGuildCommands(process.env.CLIENT_ID!, guildId),
        { body: command.toJSON() }
      ) as any;

      // Track the registered command
      if (!this.registeredCommands.has(guildId)) {
        this.registeredCommands.set(guildId, new Set());
      }
      this.registeredCommands.get(guildId)!.add(commandName);

      return response.id;
    } catch (error) {
      console.error('Error registering guild command:', error);
      return null;
    }
  }

  // Unregister a guild command from Discord
  public async unregisterGuildCommand(guildId: string, commandId: string): Promise<boolean> {
    try {
      await this.rest.delete(
        Routes.applicationGuildCommand(process.env.CLIENT_ID!, guildId, commandId)
      );

      return true;
    } catch (error) {
      console.error('Error unregistering guild command:', error);
      return false;
    }
  }

  // Execute a guild command
  public async execute(interaction: ChatInputCommandInteraction): Promise<boolean> {
    if (!interaction.guild) return false;

    const commandName = interaction.commandName;

    // Check if this is a registered guild command
    const guildCommands = this.registeredCommands.get(interaction.guild.id);
    if (!guildCommands || !guildCommands.has(commandName)) {
      return false; // Not a guild command
    }

    // Try to find and execute guild command
    const guildCommandResponse = await premiumHandler.executeGuildCommand(
      interaction.guild.id,
      commandName
    );

    if (!guildCommandResponse) {
      return false; // Command not found in database
    }

    try {
      if (guildCommandResponse.type === 'embed') {
        const embedData = guildCommandResponse.data;
        const embed = new EmbedBuilder();

        if (embedData.title) embed.setTitle(embedData.title);
        if (embedData.description) embed.setDescription(embedData.description);
        if (embedData.color) embed.setColor(embedData.color);
        if (embedData.footer) embed.setFooter({ text: embedData.footer });
        if (embedData.image) embed.setImage(embedData.image);

        // Add timestamp if requested
        embed.setTimestamp();

        await interaction.reply({ embeds: [embed] });
      } else if (guildCommandResponse.type === 'text') {
        const content = guildCommandResponse.data.content;
        await interaction.reply({ content });
      }

      return true;
    } catch (error) {
      console.error('Error executing guild command:', error);
      await interaction.reply({
        embeds: [createErrorEmbed('Command Error', 'There was an error executing this guild command.')],
        ephemeral: true
      });
      return true; // Still handled, just with error
    }
  }

  // Sync all guild commands for a guild
  public async syncGuildCommands(guildId: string): Promise<void> {
    try {
      const guildCommands = await premiumHandler.getGuildCommands(guildId);
      
      // Clear existing registrations for this guild
      this.registeredCommands.delete(guildId);
      
      // Register each command
      for (const command of guildCommands) {
        const discordCommandId = await this.registerGuildCommand(
          guildId,
          command.command_name,
          command.description
        );
        
        if (discordCommandId) {
          // Update the database with the Discord command ID
          await premiumHandler.updateGuildCommandDiscordId(command.id, discordCommandId);
        }
      }
    } catch (error) {
      console.error('Error syncing guild commands:', error);
    }
  }

  // Check if a command is registered as a guild command
  public isRegisteredGuildCommand(guildId: string, commandName: string): boolean {
    const guildCommands = this.registeredCommands.get(guildId);
    return guildCommands ? guildCommands.has(commandName) : false;
  }

  // Get all registered guild commands for a guild
  public getRegisteredCommands(guildId: string): string[] {
    const guildCommands = this.registeredCommands.get(guildId);
    return guildCommands ? Array.from(guildCommands) : [];
  }

  // Clear registered commands for a guild
  public clearRegisteredCommands(guildId: string): void {
    this.registeredCommands.delete(guildId);
  }
}

export const guildCommandHandler = GuildCommandHandler.getInstance();