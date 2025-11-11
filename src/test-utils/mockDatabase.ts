// Using jest mocking - no import needed since jest is global

export const createMockDb = () => {
  const mockDb = {
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    having: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue([]),

    insert: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    returning: jest.fn().mockReturnThis(),
    onConflictDoUpdate: jest.fn().mockReturnThis(),
    onConflictDoNothing: jest.fn().mockReturnThis(),

    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),

    delete: jest.fn().mockReturnThis(),

    transaction: jest.fn().mockImplementation(async (callback: any) => {
      const mockTx = createMockTransaction();
      return await callback(mockTx);
    }),

    batch: jest.fn().mockResolvedValue([]),

    $executeRaw: jest.fn().mockResolvedValue({ rowCount: 0 }),
    $queryRaw: jest.fn().mockResolvedValue([]),
  };

  return mockDb;
};

export const createMockTransaction = () => {
  const mockTx = {
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue([]),

    insert: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    returning: jest.fn().mockResolvedValue([]),

    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),

    delete: jest.fn().mockReturnThis(),

    rollback: jest.fn(),
    commit: jest.fn(),
  };

  return mockTx;
};

export const createMockGuildData = (overrides = {}) => ({
  id: '987654321098765432',
  name: 'Test Guild',
  ownerId: '123456789012345678',
  icon: 'guild_icon_hash',
  preferredLocale: 'en',
  systemChannelId: '111111111111111111',
  rulesChannelId: null,
  memberCount: 100,
  premiumTier: 0,
  premiumSubscriptionCount: 0,
  prefix: '!',
  welcomeEnabled: true,
  welcomeChannelId: '111111111111111111',
  welcomeMessage: 'Welcome {user} to {server}!',
  goodbyeEnabled: false,
  goodbyeChannelId: null,
  goodbyeMessage: null,
  loggingEnabled: true,
  loggingChannelId: '222222222222222222',
  autoRoleEnabled: false,
  autoRoleId: null,
  xpEnabled: true,
  xpRate: 15,
  xpCooldown: 60,
  economyEnabled: true,
  economyCurrency: '💰',
  economyDailyAmount: 100,
  moderationAutomodEnabled: false,
  moderationMaxWarnings: 3,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const createMockUserData = (overrides = {}) => ({
  id: '123456789012345678',
  username: 'TestUser',
  discriminator: '1234',
  avatar: 'user_avatar_hash',
  bot: false,
  globalBanned: false,
  globalBanReason: null,
  preferredLocale: 'en',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const createMockGuildMemberData = (overrides = {}) => ({
  id: '1',
  guildId: '987654321098765432',
  userId: '123456789012345678',
  xp: 100,
  level: 1,
  balance: 1000,
  lastDaily: null,
  lastWork: null,
  lastRob: null,
  warnings: 0,
  timeouts: 0,
  kicks: 0,
  bans: 0,
  joinedAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const createMockWarningData = (overrides = {}) => ({
  id: '1',
  guildId: '987654321098765432',
  userId: '123456789012345678',
  moderatorId: '999999999999999999',
  reason: 'Test warning',
  severity: 1,
  createdAt: new Date(),
  expiresAt: null,
  ...overrides,
});

export const createMockGiveawayData = (overrides = {}) => ({
  id: '1',
  guildId: '987654321098765432',
  channelId: '333333333333333333',
  messageId: '444444444444444444',
  hostId: '999999999999999999',
  prize: 'Test Prize',
  description: 'Test giveaway description',
  winnersCount: 1,
  participants: [],
  winners: [],
  endTime: new Date(Date.now() + 86400000),
  ended: false,
  requirements: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const createMockTicketData = (overrides = {}) => ({
  id: '1',
  guildId: '987654321098765432',
  channelId: '555555555555555555',
  userId: '123456789012345678',
  claimedBy: null,
  category: 'support',
  subject: 'Test ticket',
  status: 'open',
  priority: 'normal',
  createdAt: new Date(),
  updatedAt: new Date(),
  closedAt: null,
  closedBy: null,
  closeReason: null,
  ...overrides,
});

export const createMockEconomyTransactionData = (overrides = {}) => ({
  id: '1',
  guildId: '987654321098765432',
  userId: '123456789012345678',
  type: 'daily',
  amount: 100,
  balance: 1100,
  description: 'Daily reward claimed',
  createdAt: new Date(),
  ...overrides,
});

export const createMockShopItemData = (overrides = {}) => ({
  id: '1',
  guildId: '987654321098765432',
  name: 'Test Item',
  description: 'A test shop item',
  price: 500,
  stock: 10,
  roleId: null,
  emoji: '🎁',
  category: 'general',
  requiresLevel: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const createMockXpRoleRewardData = (overrides = {}) => ({
  id: '1',
  guildId: '987654321098765432',
  level: 10,
  roleId: '777777777777777777',
  createdAt: new Date(),
  ...overrides,
});

export const mockDatabaseResponses = {
  guilds: {
    findById: jest.fn().mockResolvedValue(createMockGuildData()),
    findAll: jest.fn().mockResolvedValue([createMockGuildData()]),
    create: jest.fn().mockResolvedValue(createMockGuildData()),
    update: jest.fn().mockResolvedValue(createMockGuildData()),
    delete: jest.fn().mockResolvedValue(true),
  },
  users: {
    findById: jest.fn().mockResolvedValue(createMockUserData()),
    findAll: jest.fn().mockResolvedValue([createMockUserData()]),
    create: jest.fn().mockResolvedValue(createMockUserData()),
    update: jest.fn().mockResolvedValue(createMockUserData()),
    delete: jest.fn().mockResolvedValue(true),
  },
  guildMembers: {
    findByGuildAndUser: jest.fn().mockResolvedValue(createMockGuildMemberData()),
    findByGuild: jest.fn().mockResolvedValue([createMockGuildMemberData()]),
    create: jest.fn().mockResolvedValue(createMockGuildMemberData()),
    update: jest.fn().mockResolvedValue(createMockGuildMemberData()),
    delete: jest.fn().mockResolvedValue(true),
  },
  warnings: {
    findById: jest.fn().mockResolvedValue(createMockWarningData()),
    findByUser: jest.fn().mockResolvedValue([createMockWarningData()]),
    create: jest.fn().mockResolvedValue(createMockWarningData()),
    update: jest.fn().mockResolvedValue(createMockWarningData()),
    delete: jest.fn().mockResolvedValue(true),
  },
  giveaways: {
    findById: jest.fn().mockResolvedValue(createMockGiveawayData()),
    findActive: jest.fn().mockResolvedValue([createMockGiveawayData()]),
    create: jest.fn().mockResolvedValue(createMockGiveawayData()),
    update: jest.fn().mockResolvedValue(createMockGiveawayData()),
    delete: jest.fn().mockResolvedValue(true),
  },
  tickets: {
    findById: jest.fn().mockResolvedValue(createMockTicketData()),
    findByGuild: jest.fn().mockResolvedValue([createMockTicketData()]),
    create: jest.fn().mockResolvedValue(createMockTicketData()),
    update: jest.fn().mockResolvedValue(createMockTicketData()),
    delete: jest.fn().mockResolvedValue(true),
  },
};
