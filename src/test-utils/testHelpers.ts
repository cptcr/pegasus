import { EmbedBuilder, PermissionsBitField } from 'discord.js';
import { createMockDb } from './mockDatabase';
import { createMockClient } from './mockDiscord';
// Using jest mocking - no import needed since jest is global

export const expectEmbed = (embed: EmbedBuilder) => ({
  toHaveTitle: (title: string) => {
    expect(embed.data.title).toBe(title);
  },
  toHaveDescription: (description: string) => {
    expect(embed.data.description).toBe(description);
  },
  toHaveColor: (color: number) => {
    expect(embed.data.color).toBe(color);
  },
  toHaveField: (name: string, value?: string) => {
    const field = embed.data.fields?.find(f => f.name === name);
    expect(field).toBeDefined();
    if (value !== undefined) {
      expect(field?.value).toBe(value);
    }
  },
  toHaveFooter: (text: string) => {
    expect(embed.data.footer?.text).toBe(text);
  },
  toHaveAuthor: (name: string) => {
    expect(embed.data.author?.name).toBe(name);
  },
  toHaveTimestamp: () => {
    expect(embed.data.timestamp).toBeDefined();
  },
});

export const expectInteractionReply = (interaction: any) => ({
  toHaveBeenCalledWithEmbed: (matcher: (embed: EmbedBuilder) => boolean) => {
    expect(interaction.reply).toHaveBeenCalled();
    const call = interaction.reply.mock.calls[0][0];
    expect(call.embeds).toBeDefined();
    expect(call.embeds.length).toBeGreaterThan(0);
    expect(matcher(call.embeds[0])).toBe(true);
  },
  toHaveBeenCalledWithContent: (content: string) => {
    expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({ content }));
  },
  toHaveBeenCalledEphemeral: () => {
    expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({ ephemeral: true }));
  },
  toHaveBeenDeferred: () => {
    expect(interaction.deferReply).toHaveBeenCalled();
  },
});

export const createMockPermissions = (permissions: string[]): PermissionsBitField => {
  return new PermissionsBitField(permissions as any);
};

export const waitFor = async (condition: () => boolean, timeout = 5000): Promise<void> => {
  const startTime = Date.now();
  while (!condition()) {
    if (Date.now() - startTime > timeout) {
      throw new Error('Timeout waiting for condition');
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
};

export const mockI18n = () => {
  const t = jest.fn((key: string, options?: any): string => {
    const translations: Record<string, string> = {
      'common.error': 'An error occurred',
      'common.success': 'Success!',
      'common.noPermission': 'You do not have permission to use this command',
      'common.invalidUser': 'Invalid user specified',
      'common.userNotFound': 'User not found',
      'commands.warn.success': 'Warning issued successfully',
      'commands.warn.invalidLevel': 'Invalid warning level',
      'commands.eco.insufficientFunds': 'Insufficient funds',
      'commands.eco.dailyClaimed': 'Daily reward claimed!',
      'commands.gw.created': 'Giveaway created successfully',
      'commands.gw.ended': 'Giveaway ended',
      'commands.ticket.created': 'Ticket created',
      'commands.ticket.closed': 'Ticket closed',
    };

    let result = translations[key] || key;

    if (options) {
      Object.entries(options).forEach(([placeholder, value]) => {
        result = result.replace(`{${placeholder}}`, String(value));
      });
    }

    return result;
  });

  return { t };
};

export const mockLogger = () => ({
  info: jest.fn(() => undefined),
  warn: jest.fn(() => undefined),
  error: jest.fn(() => undefined),
  debug: jest.fn(() => undefined),
  verbose: jest.fn(() => undefined),
});

export const mockCache = () => {
  const cache = new Map();
  return {
    get: jest.fn((key: string) => cache.get(key)),
    set: jest.fn((key: string, value: any, ttl?: number): void => {
      cache.set(key, value);
      if (ttl) {
        setTimeout(() => cache.delete(key), ttl);
      }
    }),
    delete: jest.fn((key: string) => cache.delete(key)),
    clear: jest.fn(() => cache.clear()),
    has: jest.fn((key: string) => cache.has(key)),
  };
};

export const mockRateLimiter = () => ({
  consume: jest.fn().mockResolvedValue({ remainingPoints: 10, msBeforeNext: 0 }),
  penalty: jest.fn().mockResolvedValue(undefined),
  reward: jest.fn().mockResolvedValue(undefined),
  block: jest.fn().mockResolvedValue(undefined),
  delete: jest.fn().mockResolvedValue(undefined),
  get: jest.fn().mockResolvedValue({ points: 0, msBeforeNext: 0 }),
});

export const createTestContext = () => ({
  db: createMockDb(),
  client: createMockClient(),
  i18n: mockI18n(),
  logger: mockLogger(),
  cache: mockCache(),
  rateLimiter: mockRateLimiter(),
});

export const cleanupMocks = () => {
  jest.clearAllMocks();
  jest.resetModules();
};

export const suppressConsole = () => {
  const originalConsole = { ...console };

  beforeAll(() => {
    console.log = jest.fn(() => undefined);
    console.error = jest.fn(() => undefined);
    console.warn = jest.fn(() => undefined);
    console.info = jest.fn(() => undefined);
    console.debug = jest.fn(() => undefined);
  });

  afterAll(() => {
    console.log = originalConsole.log;
    console.error = originalConsole.error;
    console.warn = originalConsole.warn;
    console.info = originalConsole.info;
    console.debug = originalConsole.debug;
  });
};

export const mockEnvironment = (overrides: Record<string, string> = {}) => {
  const originalEnv = process.env;

  beforeAll(() => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'test',
      DISCORD_TOKEN: 'test_token',
      DATABASE_URL: 'postgresql://test:test@localhost:5432/pegasus_test',
      BOT_API_TOKEN: 'test_api_token',
      DEVELOPER_IDS: '["123456789012345678"]',
      DEFAULT_LANGUAGE: 'en',
      LOG_LEVEL: 'error',
      ...overrides,
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });
};
