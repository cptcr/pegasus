import { 
  Guild, 
  GuildMember, 
  User, 
  Message,
  ChatInputCommandInteraction,
  ButtonInteraction,
  ModalSubmitInteraction,
  SelectMenuInteraction,
  Collection,
  PermissionsBitField,
  ChannelType
} from 'discord.js';
// Using jest mocking - no import needed since jest is global

export const createMockClient = (): any => {
  const mockClient = {
    user: {
      id: 'bot123456789',
      username: 'TestBot',
      discriminator: '0000',
      avatar: 'avatar_hash',
      bot: true,
      tag: 'TestBot#0000',
      setPresence: jest.fn(),
      setActivity: jest.fn(),
    },
    guilds: {
      cache: new Collection<string, Guild>(),
      fetch: jest.fn(),
    },
    users: {
      cache: new Collection<string, User>(),
      fetch: jest.fn(),
    },
    channels: {
      cache: new Collection<string, any>(),
      fetch: jest.fn(),
    },
    ws: {
      ping: 50,
      status: 0,
    },
    on: jest.fn(),
    once: jest.fn(),
    off: jest.fn(),
    emit: jest.fn(),
    login: jest.fn().mockResolvedValue('test_token'),
    destroy: jest.fn(),
    isReady: jest.fn().mockReturnValue(true),
    readyAt: new Date(),
    uptime: 60000,
  } as any;

  return mockClient;
};

export const createMockGuild = (overrides: Record<string, unknown> = {}): any => {
  const mockGuild = {
    id: '987654321098765432',
    name: 'Test Guild',
    ownerId: '123456789012345678',
    icon: 'guild_icon_hash',
    memberCount: 100,
    members: {
      cache: new Collection<string, GuildMember>(),
      fetch: jest.fn(),
      me: null,
    },
    channels: {
      cache: new Collection<string, any>(),
      fetch: jest.fn(),
      create: jest.fn(),
    },
    roles: {
      cache: new Collection<string, any>(),
      fetch: jest.fn(),
      create: jest.fn(),
      everyone: {
        id: '987654321098765432',
        name: '@everyone',
        permissions: new PermissionsBitField(),
      },
    },
    systemChannelId: '111111111111111111',
    preferredLocale: 'en-US',
    available: true,
    ...overrides,
  } as any;

  return mockGuild;
};

export const createMockUser = (overrides: Record<string, unknown> = {}): any => {
  const mockUser = {
    id: '123456789012345678',
    username: 'TestUser',
    discriminator: '1234',
    avatar: 'user_avatar_hash',
    bot: false,
    tag: 'TestUser#1234',
    displayAvatarURL: jest.fn().mockReturnValue('https://cdn.discordapp.com/avatars/test.png'),
    ...overrides,
  } as any;

  return mockUser;
};

export const createMockGuildMember = (overrides: Record<string, unknown> = {}): any => {
  const mockMember = {
    id: '123456789012345678',
    user: createMockUser(),
    guild: { id: '987654321098765432', name: 'Test Guild' },
    nickname: null,
    roles: {
      cache: new Collection<string, any>(),
      highest: {
        position: 1,
        id: '222222222222222222',
        name: 'Member',
      },
      add: jest.fn(),
      remove: jest.fn(),
    },
    permissions: new PermissionsBitField(['SendMessages', 'ViewChannel']),
    joinedAt: new Date(),
    joinedTimestamp: Date.now(),
    displayName: overrides.nickname || 'TestUser',
    voice: {
      channel: null,
      channelId: null,
      deaf: false,
      mute: false,
    },
    ban: jest.fn(),
    kick: jest.fn(),
    timeout: jest.fn(),
    send: jest.fn(),
    ...overrides,
  } as any;

  return mockMember;
};

export const createMockTextChannel = (overrides: Record<string, unknown> = {}): any => {
  const mockChannel = {
    id: '333333333333333333',
    name: 'test-channel',
    type: ChannelType.GuildText,
    guild: createMockGuild(),
    guildId: '987654321098765432',
    position: 0,
    parentId: null,
    send: jest.fn().mockResolvedValue({}),
    bulkDelete: jest.fn(),
    createMessageCollector: jest.fn(),
    awaitMessages: jest.fn(),
    permissionsFor: jest.fn().mockReturnValue(new PermissionsBitField(['SendMessages', 'ViewChannel'])),
    ...overrides,
  } as any;

  return mockChannel;
};

export const createMockMessage = (overrides: Partial<Message> = {}): any => {
  const mockMessage = {
    id: '444444444444444444',
    content: 'Test message',
    author: createMockUser(),
    member: createMockGuildMember(),
    channel: {
      id: '333333333333333333',
      send: jest.fn(),
    },
    channelId: '333333333333333333',
    guild: createMockGuild(),
    guildId: '987654321098765432',
    createdAt: new Date(),
    createdTimestamp: Date.now(),
    editedAt: null,
    editedTimestamp: null,
    attachments: new Collection(),
    embeds: [],
    components: [],
    reactions: {
      cache: new Collection(),
    },
    reply: jest.fn(),
    edit: jest.fn(),
    delete: jest.fn(),
    react: jest.fn(),
    ...overrides,
  } as any;

  return mockMessage;
};

export const createMockCommandInteraction = (overrides: Partial<ChatInputCommandInteraction> = {}): any => {
  const mockInteraction = {
    id: '555555555555555555',
    commandName: 'test',
    commandId: '666666666666666666',
    type: 2,
    user: createMockUser(),
    member: createMockGuildMember(),
    guild: createMockGuild(),
    guildId: '987654321098765432',
    channel: createMockTextChannel(),
    channelId: '333333333333333333',
    locale: 'en-US',
    guildLocale: 'en-US',
    deferred: false,
    replied: false,
    ephemeral: false,
    options: {
      getString: jest.fn(),
      getInteger: jest.fn(),
      getNumber: jest.fn(),
      getBoolean: jest.fn(),
      getUser: jest.fn(),
      getMember: jest.fn(),
      getChannel: jest.fn(),
      getRole: jest.fn(),
      getMentionable: jest.fn(),
      getAttachment: jest.fn(),
      getSubcommand: jest.fn(),
      getSubcommandGroup: jest.fn(),
      data: [],
    },
    reply: jest.fn().mockResolvedValue(undefined),
    editReply: jest.fn().mockResolvedValue(undefined),
    deferReply: jest.fn().mockResolvedValue(undefined),
    followUp: jest.fn().mockResolvedValue(undefined),
    deleteReply: jest.fn().mockResolvedValue(undefined),
    fetchReply: jest.fn().mockResolvedValue(createMockMessage()),
    ...overrides,
  } as any;

  return mockInteraction;
};

export const createMockButtonInteraction = (overrides: Partial<ButtonInteraction> = {}): any => {
  const mockInteraction = {
    id: '777777777777777777',
    customId: 'test_button',
    type: 3,
    componentType: 2,
    user: createMockUser(),
    member: createMockGuildMember(),
    guild: createMockGuild(),
    guildId: '987654321098765432',
    channel: createMockTextChannel(),
    channelId: '333333333333333333',
    message: createMockMessage(),
    deferred: false,
    replied: false,
    ephemeral: false,
    reply: jest.fn().mockResolvedValue(undefined),
    editReply: jest.fn().mockResolvedValue(undefined),
    deferReply: jest.fn().mockResolvedValue(undefined),
    deferUpdate: jest.fn().mockResolvedValue(undefined),
    update: jest.fn().mockResolvedValue(undefined),
    followUp: jest.fn().mockResolvedValue(undefined),
    deleteReply: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as any;

  return mockInteraction;
};

export const createMockModalSubmitInteraction = (overrides: Partial<ModalSubmitInteraction> = {}): any => {
  const mockInteraction = {
    id: '888888888888888888',
    customId: 'test_modal',
    type: 5,
    user: createMockUser(),
    member: createMockGuildMember(),
    guild: createMockGuild(),
    guildId: '987654321098765432',
    channel: createMockTextChannel(),
    channelId: '333333333333333333',
    fields: {
      getTextInputValue: jest.fn(),
      getField: jest.fn(),
      components: [],
    },
    deferred: false,
    replied: false,
    ephemeral: false,
    reply: jest.fn().mockResolvedValue(undefined),
    editReply: jest.fn().mockResolvedValue(undefined),
    deferReply: jest.fn().mockResolvedValue(undefined),
    deferUpdate: jest.fn().mockResolvedValue(undefined),
    update: jest.fn().mockResolvedValue(undefined),
    followUp: jest.fn().mockResolvedValue(undefined),
    deleteReply: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as any;

  return mockInteraction;
};

export const createMockSelectMenuInteraction = (overrides: Partial<SelectMenuInteraction> = {}): any => {
  const mockInteraction = {
    id: '999999999999999999',
    customId: 'test_select',
    type: 3,
    componentType: 3,
    user: createMockUser(),
    member: createMockGuildMember(),
    guild: createMockGuild(),
    guildId: '987654321098765432',
    channel: createMockTextChannel(),
    channelId: '333333333333333333',
    message: createMockMessage(),
    values: ['option1'],
    deferred: false,
    replied: false,
    ephemeral: false,
    reply: jest.fn().mockResolvedValue(undefined),
    editReply: jest.fn().mockResolvedValue(undefined),
    deferReply: jest.fn().mockResolvedValue(undefined),
    deferUpdate: jest.fn().mockResolvedValue(undefined),
    update: jest.fn().mockResolvedValue(undefined),
    followUp: jest.fn().mockResolvedValue(undefined),
    deleteReply: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as any;

  return mockInteraction;
};

export const mockDiscordAPI = () => {
  const mockAPI = {
    rest: {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      patch: jest.fn(),
      delete: jest.fn(),
    },
    application: {
      commands: {
        set: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
        edit: jest.fn(),
        delete: jest.fn(),
      },
    },
  };

  return mockAPI;
};
