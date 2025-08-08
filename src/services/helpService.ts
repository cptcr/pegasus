import { EmbedBuilder } from 'discord.js';
import { t } from '../i18n';
import { readdirSync } from 'fs';
import { join } from 'path';
import { Command, CommandCategory } from '../types/command';
import { logger } from '../utils/logger';

export class HelpService {
  private commands: Map<string, Command> = new Map();
  private commandsByCategory: Map<CommandCategory, Command[]> = new Map();

  constructor() {
    this.loadCommands();
  }

  private async loadCommands(): Promise<void> {
    try {
      const commandsPath = join(__dirname, '..', 'commands');
      const categoryFolders = readdirSync(commandsPath, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);

      for (const category of categoryFolders) {
        const categoryPath = join(commandsPath, category);
        const commandFiles = readdirSync(categoryPath).filter(
          file => (file.endsWith('.ts') || file.endsWith('.js')) && !file.endsWith('.d.ts')
        );

        for (const file of commandFiles) {
          try {
            const filePath = join(categoryPath, file);
            const commandModule = await import(filePath);

            let commandData: any = null;
            let commandCategory: CommandCategory = this.getCategoryFromPath(category);
            let executeFunction: any = null;

            // Handle different export patterns
            if (commandModule.default) {
              // Default export pattern
              if ('data' in commandModule.default && 'execute' in commandModule.default) {
                commandData = commandModule.default.data;
                commandCategory = commandModule.default.category || this.getCategoryFromPath(category);
                executeFunction = commandModule.default.execute;
              }
            } else {
              // Named export pattern (data, execute, category)
              if (commandModule.data && commandModule.execute) {
                commandData = commandModule.data;
                commandCategory = commandModule.category || this.getCategoryFromPath(category);
                executeFunction = commandModule.execute;
              }
            }

            if (commandData && executeFunction) {
              const cmd: Command = {
                data: commandData,
                execute: executeFunction,
                category: commandCategory,
                cooldown: commandModule.cooldown,
                permissions: commandModule.permissions,
                autocomplete: commandModule.autocomplete,
              };

              const commandName = cmd.data.name;
              this.commands.set(commandName, cmd);

              if (!this.commandsByCategory.has(cmd.category)) {
                this.commandsByCategory.set(cmd.category, []);
              }

              this.commandsByCategory.get(cmd.category)!.push(cmd);
              logger.debug(`Loaded command: ${commandName} (${cmd.category})`);
            }
          } catch (error) {
            logger.error(`Error loading command ${file}:`, error);
          }
        }
      }

      logger.info(`Loaded ${this.commands.size} commands across ${this.commandsByCategory.size} categories`);
    } catch (error) {
      logger.error('Error loading commands for help service:', error);
    }
  }

  private getCategoryFromPath(categoryPath: string): CommandCategory {
    const categoryMap: Record<string, CommandCategory> = {
      'utility': CommandCategory.Utility,
      'moderation': CommandCategory.Moderation,
      'economy': CommandCategory.Economy,
      'xp': CommandCategory.XP,
      'giveaways': CommandCategory.Giveaways,
      'tickets': CommandCategory.Tickets,
      'fun': CommandCategory.Fun,
      'admin': CommandCategory.Admin,
    };

    return categoryMap[categoryPath.toLowerCase()] || CommandCategory.Utility;
  }

  async getHelpMenu(locale: string): Promise<EmbedBuilder> {
    const embed = new EmbedBuilder()
      .setTitle(t('commands.help.title', { lng: locale }))
      .setDescription(t('commands.help.description', { lng: locale }))
      .setColor(0x7289da)
      .setTimestamp();

    const categoryOrder = [
      CommandCategory.Utility,
      CommandCategory.Moderation,
      CommandCategory.Economy,
      CommandCategory.XP,
      CommandCategory.Giveaways,
      CommandCategory.Tickets,
      CommandCategory.Fun,
      CommandCategory.Admin,
    ];

    for (const category of categoryOrder) {
      const commands = this.commandsByCategory.get(category);

      if (commands && commands.length > 0) {
        const commandList = commands.map(cmd => `\`/${cmd.data.name}\``).join(', ');

        embed.addFields({
          name: t(`commands.help.categories.${category}`, { lng: locale }),
          value: commandList || t('common.none', { lng: locale }),
          inline: false,
        });
      }
    }

    embed.setFooter({
      text: t('commands.help.menuFooter', { lng: locale }),
    });

    return embed;
  }

  async getCommandHelp(commandName: string, locale: string): Promise<EmbedBuilder | null> {
    const command = this.commands.get(commandName);

    if (!command) {
      return null;
    }

    const embed = new EmbedBuilder()
      .setTitle(t('commands.help.commandInfo', { lng: locale }))
      .setColor(0x7289da)
      .addFields([
        {
          name: t('commands.help.commandName', { lng: locale }),
          value: `\`/${command.data.name}\``,
          inline: true,
        },
        {
          name: t('commands.help.category', { lng: locale }),
          value: t(`commands.help.categories.${command.category}`, { lng: locale }),
          inline: true,
        },
      ]);

    // Add description
    const description =
      command.data.description || t('commands.help.noDescription', { lng: locale });
    embed.addFields({
      name: t('commands.help.description', { lng: locale }),
      value: description,
      inline: false,
    });

    // Add usage
    embed.addFields({
      name: t('commands.help.usage', { lng: locale }),
      value: this.generateUsage(command),
      inline: false,
    });

    // Add cooldown if exists
    if (command.cooldown) {
      embed.addFields({
        name: t('commands.help.cooldown', { lng: locale }),
        value: t('commands.help.cooldownValue', {
          lng: locale,
          seconds: command.cooldown,
        }),
        inline: true,
      });
    }

    // Add permissions if required
    if (command.permissions && command.permissions.length > 0) {
      embed.addFields({
        name: t('commands.help.permissions', { lng: locale }),
        value: command.permissions.map(p => `\`${p}\``).join(', '),
        inline: false,
      });
    }

    // Add subcommands if any
    if ('options' in command.data && command.data.options && command.data.options.length > 0) {
      const subcommands = this.getSubcommands(command);
      if (subcommands.length > 0) {
        embed.addFields({
          name: t('commands.help.subcommands', { lng: locale }),
          value: subcommands.join('\n'),
          inline: false,
        });
      }
    }

    embed.setFooter({
      text: t('commands.help.commandFooter', { lng: locale }),
    });

    embed.setTimestamp();

    return embed;
  }

  private generateUsage(command: Command): string {
    let usage = `\`/${command.data.name}`;

    if ('options' in command.data && command.data.options) {
      const options = command.data.options as any[];

      for (const option of options) {
        if (option.type === 1) {
          // Subcommand
          usage += ` ${option.name}`;

          if (option.options) {
            for (const subOption of option.options) {
              usage += subOption.required ? ` <${subOption.name}>` : ` [${subOption.name}]`;
            }
          }

          usage += `\`\n\`/${command.data.name}`;
        }
      }
    }

    usage = usage.replace(/\n\`\/[^`]+$/, '');
    usage += '`';

    return usage;
  }

  private getSubcommands(command: Command): string[] {
    const subcommands: string[] = [];

    if ('options' in command.data && command.data.options) {
      const options = command.data.options as any[];

      for (const option of options) {
        if (option.type === 1) {
          // Subcommand
          subcommands.push(`• \`${option.name}\` - ${option.description}`);
        } else if (option.type === 2) {
          // Subcommand group
          for (const subOption of option.options || []) {
            if (subOption.type === 1) {
              subcommands.push(`• \`${option.name} ${subOption.name}\` - ${subOption.description}`);
            }
          }
        }
      }
    }

    return subcommands;
  }

  async getCommandList(): Promise<string[]> {
    // Only reload if we don't have any commands loaded
    if (this.commands.size === 0) {
      await this.loadCommands();
    }
    return Array.from(this.commands.keys()).sort();
  }

  // Force reload commands (useful for development)
  async reloadCommands(): Promise<void> {
    this.commands.clear();
    this.commandsByCategory.clear();
    await this.loadCommands();
  }

  getCategoryCommands(category: CommandCategory): Command[] {
    return this.commandsByCategory.get(category) || [];
  }

  getAllCategories(): CommandCategory[] {
    return Array.from(this.commandsByCategory.keys());
  }

  getCommandByName(name: string): Command | undefined {
    return this.commands.get(name);
  }
}
