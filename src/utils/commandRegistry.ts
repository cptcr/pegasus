export interface CommandMetadata {
  name: string;
  description: string;
  category: string;
  usage: string;
  examples: string[];
  permissions?: string[];
  cooldown?: number;
  adminOnly?: boolean;
  guildOnly?: boolean;
}

export const commandRegistry: Record<string, CommandMetadata> = {
  // Admin Commands
  'security': {
    name: 'security',
    description: 'Manage bot security settings',
    category: 'admin',
    usage: '/security <subcommand>',
    examples: [
      '/security permissions view @user',
      '/security permissions grant @role moderation.ban',
      '/security audit @user',
      '/security ratelimits',
      '/security alerts'
    ],
    permissions: ['ADMINISTRATOR'],
    adminOnly: true,
    guildOnly: true
  },
  
  // Moderation Commands
  'ban': {
    name: 'ban',
    description: 'Ban a user from the server',
    category: 'moderation',
    usage: '/ban <user> [reason] [duration]',
    examples: [
      '/ban @user Spamming',
      '/ban @user Breaking rules 7d',
      '/ban 123456789 Harassment 1h'
    ],
    permissions: ['BAN_MEMBERS'],
    adminOnly: true,
    guildOnly: true
  },
  'kick': {
    name: 'kick',
    description: 'Kick a user from the server',
    category: 'moderation',
    usage: '/kick <user> [reason]',
    examples: [
      '/kick @user Inappropriate behavior',
      '/kick 123456789 Warning violation'
    ],
    permissions: ['KICK_MEMBERS'],
    adminOnly: true,
    guildOnly: true
  },
  'mute': {
    name: 'mute',
    description: 'Mute a user for a specified duration',
    category: 'moderation',
    usage: '/mute <user> <duration> [reason]',
    examples: [
      '/mute @user 1h Spamming',
      '/mute 123456789 30m Inappropriate language'
    ],
    permissions: ['MODERATE_MEMBERS'],
    adminOnly: true,
    guildOnly: true
  },
  'unmute': {
    name: 'unmute',
    description: 'Remove mute from a user',
    category: 'moderation',
    usage: '/unmute <user> [reason]',
    examples: [
      '/unmute @user Appeal accepted',
      '/unmute 123456789'
    ],
    permissions: ['MODERATE_MEMBERS'],
    adminOnly: true,
    guildOnly: true
  },
  'warn': {
    name: 'warn',
    description: 'Issue a warning to a user',
    category: 'moderation',
    usage: '/warn <user> <reason>',
    examples: [
      '/warn @user Please follow server rules',
      '/warn 123456789 Inappropriate content'
    ],
    permissions: ['MODERATE_MEMBERS'],
    adminOnly: true,
    guildOnly: true
  },
  'automod': {
    name: 'automod',
    description: 'Configure automatic moderation settings',
    category: 'moderation',
    usage: '/automod <action>',
    examples: [
      '/automod setup',
      '/automod filter add profanity',
      '/automod whitelist add @role'
    ],
    permissions: ['ADMINISTRATOR'],
    adminOnly: true,
    guildOnly: true
  },

  // XP System Commands
  'rank': {
    name: 'rank',
    description: 'Check your or another user\'s XP rank and statistics',
    category: 'xp',
    usage: '/rank [user]',
    examples: [
      '/rank',
      '/rank @user',
      '/rank 123456789'
    ],
    guildOnly: true
  },
  'leaderboard': {
    name: 'leaderboard',
    description: 'View the server XP leaderboard',
    category: 'xp',
    usage: '/leaderboard [limit]',
    examples: [
      '/leaderboard',
      '/leaderboard 15',
      '/leaderboard 5'
    ],
    guildOnly: true
  },

  // Economy Commands
  'balance': {
    name: 'balance',
    description: 'Check your coin balance and economy statistics',
    category: 'economy',
    usage: '/balance [user]',
    examples: [
      '/balance',
      '/balance @user'
    ]
  },
  'daily': {
    name: 'daily',
    description: 'Claim your daily coin reward',
    category: 'economy',
    usage: '/daily',
    examples: ['/daily'],
    cooldown: 86400 // 24 hours
  },
  'work': {
    name: 'work',
    description: 'Work to earn coins',
    category: 'economy',
    usage: '/work',
    examples: ['/work'],
    cooldown: 14400 // 4 hours
  },
  'gamble': {
    name: 'gamble',
    description: 'Gamble your coins in various games',
    category: 'economy',
    usage: '/gamble <game> <amount>',
    examples: [
      '/gamble coinflip 100',
      '/gamble dice 50',
      '/gamble slots 200'
    ]
  },
  'shop': {
    name: 'shop',
    description: 'Browse and purchase items from the server shop',
    category: 'economy',
    usage: '/shop <action>',
    examples: [
      '/shop list',
      '/shop buy role @role',
      '/shop add role @role 1000'
    ],
    guildOnly: true
  },

  // Ticket System
  'ticket': {
    name: 'ticket',
    description: 'Create and manage support tickets',
    category: 'tickets',
    usage: '/ticket <action>',
    examples: [
      '/ticket panel create General Support',
      '/ticket list',
      '/ticket close'
    ],
    guildOnly: true
  },

  // Games
  'trivia': {
    name: 'trivia',
    description: 'Start a trivia game session',
    category: 'games',
    usage: '/trivia [rounds]',
    examples: [
      '/trivia',
      '/trivia 10',
      '/trivia 5'
    ],
    guildOnly: true
  },

  // Steam Integration
  'steam': {
    name: 'steam',
    description: 'Search and get information about Steam games',
    category: 'steam',
    usage: '/steam <action> <query>',
    examples: [
      '/steam search cyberpunk',
      '/steam game 1091500',
      '/steam popular 10',
      '/steam random',
      '/steam genre Action'
    ]
  },

  // Reminder System
  'reminder': {
    name: 'reminder',
    description: 'Set and manage personal reminders',
    category: 'reminders',
    usage: '/reminder <action>',
    examples: [
      '/reminder set 1h30m Meeting with team',
      '/reminder list',
      '/reminder cancel',
      '/reminder set 2d Doctor appointment here:true'
    ]
  },

  // Language System
  'language': {
    name: 'language',
    description: 'Manage your language preferences',
    category: 'language',
    usage: '/language <action>',
    examples: [
      '/language set es',
      '/language current',
      '/language available',
      '/language reset'
    ]
  },

  // Utility Commands
  'ping': {
    name: 'ping',
    description: 'Check bot latency, uptime, and system information',
    category: 'utility',
    usage: '/ping',
    examples: ['/ping']
  },
  'help': {
    name: 'help',
    description: 'Get help with bot commands and features',
    category: 'utility',
    usage: '/help [command|category]',
    examples: [
      '/help',
      '/help ban',
      '/help category:moderation'
    ]
  },
  'stats': {
    name: 'stats',
    description: 'View server and bot statistics',
    category: 'utility',
    usage: '/stats [type]',
    examples: [
      '/stats',
      '/stats server',
      '/stats moderation'
    ],
    guildOnly: true
  },
  'config': {
    name: 'config',
    description: 'Configure bot settings for your server',
    category: 'utility',
    usage: '/config <setting> <value>',
    examples: [
      '/config xp enable',
      '/config welcome channel #general',
      '/config view'
    ],
    permissions: ['ADMINISTRATOR'],
    adminOnly: true,
    guildOnly: true
  },

  // Welcome & Reaction Roles
  'welcome': {
    name: 'welcome',
    description: 'Configure welcome messages and settings',
    category: 'utility',
    usage: '/welcome <action>',
    examples: [
      '/welcome setup',
      '/welcome test',
      '/welcome disable'
    ],
    permissions: ['ADMINISTRATOR'],
    adminOnly: true,
    guildOnly: true
  },
  'reactionroles': {
    name: 'reactionroles',
    description: 'Setup and manage reaction role panels',
    category: 'utility',
    usage: '/reactionroles <action>',
    examples: [
      '/reactionroles create',
      '/reactionroles deploy',
      '/reactionroles list'
    ],
    permissions: ['MANAGE_ROLES'],
    adminOnly: true,
    guildOnly: true
  },

  // Giveaway System
  'giveaway': {
    name: 'giveaway',
    description: 'Create and manage server giveaways',
    category: 'giveaways',
    usage: '/giveaway <action>',
    examples: [
      '/giveaway create "Steam Game" "Random Steam Key" 7d 1',
      '/giveaway list',
      '/giveaway end 123',
      '/giveaway reroll 123'
    ],
    permissions: ['MANAGE_GUILD'],
    adminOnly: true,
    guildOnly: true
  },

  // Polls System
  'poll': {
    name: 'poll',
    description: 'Create interactive polls with multiple options',
    category: 'utility',
    usage: '/poll create <question> <options>',
    examples: [
      '/poll create "What\'s your favorite color?" "Red,Blue,Green"',
      '/poll create "Best programming language?" "Python,JavaScript,Java" duration:1h',
      '/poll end 123456789'
    ],
    guildOnly: true
  },

  // Verification System
  'verification': {
    name: 'verification',
    description: 'Setup server verification system',
    category: 'moderation',
    usage: '/verification <action>',
    examples: [
      '/verification setup',
      '/verification level medium',
      '/verification bypass @user'
    ],
    permissions: ['ADMINISTRATOR'],
    adminOnly: true,
    guildOnly: true
  },

  // Logging System
  'logging': {
    name: 'logging',
    description: 'Configure server event logging',
    category: 'moderation',
    usage: '/logging <action>',
    examples: [
      '/logging setup',
      '/logging set moderation #mod-logs',
      '/logging disable automod',
      '/logging list'
    ],
    permissions: ['ADMINISTRATOR'],
    adminOnly: true,
    guildOnly: true
  },

  // Additional Economy Commands
  'transfer': {
    name: 'transfer',
    description: 'Transfer coins to another user',
    category: 'economy',
    usage: '/transfer <user> <amount>',
    examples: [
      '/transfer @user 500',
      '/transfer 123456789 1000'
    ]
  },
  'deposit': {
    name: 'deposit',
    description: 'Deposit coins into your bank',
    category: 'economy',
    usage: '/deposit <amount>',
    examples: [
      '/deposit 1000',
      '/deposit all'
    ]
  },
  'withdraw': {
    name: 'withdraw',
    description: 'Withdraw coins from your bank',
    category: 'economy',
    usage: '/withdraw <amount>',
    examples: [
      '/withdraw 500',
      '/withdraw all'
    ]
  },
  'inventory': {
    name: 'inventory',
    description: 'View your inventory and manage items',
    category: 'economy',
    usage: '/inventory [user]',
    examples: [
      '/inventory',
      '/inventory @user'
    ]
  },

  // Moderation Enhancements
  'timeout': {
    name: 'timeout',
    description: 'Timeout a user for a specified duration',
    category: 'moderation',
    usage: '/timeout <user> <duration> [reason]',
    examples: [
      '/timeout @user 1h Inappropriate behavior',
      '/timeout 123456789 30m Spamming'
    ],
    permissions: ['MODERATE_MEMBERS'],
    adminOnly: true,
    guildOnly: true
  },
  'slowmode': {
    name: 'slowmode',
    description: 'Set channel slowmode',
    category: 'moderation',
    usage: '/slowmode <seconds>',
    examples: [
      '/slowmode 5',
      '/slowmode 0',
      '/slowmode 30'
    ],
    permissions: ['MANAGE_CHANNELS'],
    adminOnly: true,
    guildOnly: true
  },
  'purge': {
    name: 'purge',
    description: 'Delete multiple messages at once',
    category: 'moderation',
    usage: '/purge <amount> [user]',
    examples: [
      '/purge 10',
      '/purge 50 @user',
      '/purge 25'
    ],
    permissions: ['MANAGE_MESSAGES'],
    adminOnly: true,
    guildOnly: true
  },

  // Custom Commands (Guild-Installed)
  'customcommand': {
    name: 'customcommand',
    description: 'Create and manage guild-installed custom commands (Premium Feature)',
    category: 'premium',
    usage: '/customcommand <action>',
    examples: [
      '/customcommand create rules "Server Rules" embed',
      '/customcommand list',
      '/customcommand delete rules',
      '/customcommand info'
    ],
    permissions: ['MANAGE_GUILD'],
    adminOnly: true,
    guildOnly: true
  },
  'premium': {
    name: 'premium',
    description: 'Manage premium features (Bot Admin Only)',
    category: 'admin',
    usage: '/premium <action>',
    examples: [
      '/premium grant premium 30',
      '/premium status',
      '/premium revoke'
    ],
    permissions: ['ADMINISTRATOR'],
    adminOnly: true,
    guildOnly: true
  }
};

export function getCommandMetadata(commandName: string): CommandMetadata | null {
  return commandRegistry[commandName.toLowerCase()] || null;
}

export function getCommandsByCategory(category: string): CommandMetadata[] {
  return Object.values(commandRegistry).filter(cmd => cmd.category === category);
}

export function getAllCategories(): string[] {
  const categories = new Set(Object.values(commandRegistry).map(cmd => cmd.category));
  return Array.from(categories).sort();
}

export function searchCommands(query: string): CommandMetadata[] {
  const searchTerm = query.toLowerCase();
  return Object.values(commandRegistry).filter(cmd => 
    cmd.name.toLowerCase().includes(searchTerm) ||
    cmd.description.toLowerCase().includes(searchTerm) ||
    cmd.category.toLowerCase().includes(searchTerm)
  );
}