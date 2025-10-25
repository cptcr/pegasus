import { EmbedBuilder, Message } from 'discord.js';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { logger } from '../utils/logger';

interface ListCommandDefinition {
  trigger: string;
  listKey: string;
  entries: Array<{ name: string; url: string }>;
  title: string;
}

type ListCommandMap = Map<string, ListCommandDefinition>;

function formatTitleFromKey(key: string): string {
  const words = key.split('-').map(word => {
    if (word.length <= 3) {
      return word.toUpperCase();
    }
    return word.charAt(0).toUpperCase() + word.slice(1);
  });
  return words.join(' ');
}

function loadListDefinitions(): ListCommandMap {
  const configPath = path.join(__dirname, '..', '..', 'lists.json');
  try {
    const raw = readFileSync(configPath, 'utf-8');
    const data = JSON.parse(raw) as Record<string, unknown>;
    const commands: ListCommandMap = new Map();

    Object.entries(data)
      .filter(([, value]) => typeof value === 'string')
      .forEach(([key, value]) => {
        if (!key.endsWith('-prefix')) return;
        const trigger = (value as string).trim();
        if (!trigger) return;

        const baseKey = key.slice(0, -'-prefix'.length);
        const listKey = Object.keys(data).find(candidate => {
          if (candidate === key) return false;
          if (!candidate.startsWith(baseKey)) return false;
          return typeof data[candidate] === 'object' && data[candidate] !== null;
        });

        if (!listKey) {
          logger.warn(`No matching list found in lists.json for prefix key "${key}"`);
          return;
        }

        const rawEntries = data[listKey] as Record<string, unknown>;
        const entries = Object.entries(rawEntries)
          .filter(([, url]) => typeof url === 'string' && url.trim().length > 0)
          .map(([name, url]) => ({
            name,
            url: url as string,
          }));

        if (entries.length === 0) {
          logger.warn(`List "${listKey}" in lists.json has no valid entries`);
          return;
        }

        commands.set(trigger.toLowerCase(), {
          trigger,
          listKey,
          entries,
          title: formatTitleFromKey(listKey),
        });
      });

    return commands;
  } catch (error) {
    logger.error('Failed to load lists.json for prefix commands:', error);
    return new Map();
  }
}

export class ListCommandService {
  private readonly commands: ListCommandMap;

  constructor() {
    this.commands = loadListDefinitions();
  }

  async handle(message: Message): Promise<boolean> {
    if (!message.content) return false;

    const trigger = message.content.trim().toLowerCase();
    const definition = this.commands.get(trigger);

    if (!definition) {
      return false;
    }

    const embed = new EmbedBuilder()
      .setTitle(definition.title)
      .setColor(0x5865f2)
      .setDescription('Here are the resources you requested:')
      .addFields(
        definition.entries.map(entry => ({
          name: entry.name,
          value: `[Open](${entry.url})`,
          inline: false,
        }))
      )
      .setTimestamp();

    if (!message.channel || !message.channel.isTextBased() || !('send' in message.channel)) {
      logger.warn(`Cannot send list embed for trigger "${definition.trigger}" in non-text channel`);
      return false;
    }

    try {
      const channel = message.channel;
      // TypeScript guard ensures channel has send method
      if (typeof channel.send !== 'function') {
        return false;
      }
      await message.channel.send({ embeds: [embed] });
      return true;
    } catch (error) {
      logger.error(`Failed to send list embed for trigger "${definition.trigger}":`, error);
      return false;
    }
  }
}

export const listCommandService = new ListCommandService();
