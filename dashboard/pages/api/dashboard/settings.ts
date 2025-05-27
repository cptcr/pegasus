import { NextApiRequest, NextApiResponse } from 'next';

// Mock data for guild settings
const mockGuildSettings: Record<string, Record<string, unknown>> = {
  '111222333': {
    id: '111222333',
    name: 'Test Server 1',
    prefix: '!',
    modLogChannelId: '123456789',
    levelUpChannelId: '123456790',
    quarantineRoleId: '123456791',
    geizhalsChannelId: '123456792',
    welcomeChannelId: '123456793',
    enableLeveling: true,
    enableModeration: true,
    enableGeizhals: true,
    enablePolls: true,
    enableGiveaways: true,
    enableAutomod: true,
    enableTickets: true,
    enableMusic: true,
    welcomeMessage: 'Welcome to the server, {user}!',
    leaveMessage: 'Goodbye, {user}!'
  },
  '444555666': {
    id: '444555666',
    name: 'Test Server 2',
    prefix: '?',
    modLogChannelId: '987654321',
    levelUpChannelId: '987654320',
    quarantineRoleId: null,
    geizhalsChannelId: null,
    welcomeChannelId: '987654322',
    enableLeveling: true,
    enableModeration: false,
    enableGeizhals: false,
    enablePolls: true,
    enableGiveaways: false,
    enableAutomod: false,
    enableTickets: true,
    enableMusic: true,
    welcomeMessage: 'Hey {user}, welcome!',
    leaveMessage: '{user} has left the server.'
  }
};

// Helper functions for mock database operations
const getMockGuildSettings = (guildId: string) => {
  return mockGuildSettings[guildId] || {
    id: guildId,
    name: 'Unknown Guild',
    prefix: '!',
    enableLeveling: false,
    enableModeration: false,
    enableGeizhals: false,
    enablePolls: false,
    enableGiveaways: false,
    enableAutomod: false,
    enableTickets: false,
    enableMusic: false
  };
};

const updateMockGuildSettings = (guildId: string, data: Record<string, unknown>) => {
  const currentSettings = getMockGuildSettings(guildId);
  mockGuildSettings[guildId] = { ...currentSettings, ...data };
  return mockGuildSettings[guildId];
};

// Access control
async function checkAccess(): Promise<boolean> {
  // In a real implementation, this would validate session/token
  // For demo purposes, we assume the user is authorized
  return true;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Access control
  const hasAccess = await checkAccess();
  if (!hasAccess) {
    return res.status(403).json({ error: 'Access denied' });
  }

  if (req.method === 'GET') {
    return handleGet(req, res);
  } else if (req.method === 'POST') {
    return handlePost(req, res);
  } else {
    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }
}

async function handleGet(req: NextApiRequest, res: NextApiResponse) {
  const { guildId } = req.query;

  if (!guildId || typeof guildId !== 'string') {
    return res.status(400).json({ error: 'Guild ID required' });
  }

  try {
    const guildSettings = getMockGuildSettings(guildId);
    return res.status(200).json(guildSettings);
  } catch (error) {
    console.error('Error loading guild settings:', error);
    return res.status(500).json({ error: 'Server error loading settings' });
  }
}

async function handlePost(req: NextApiRequest, res: NextApiResponse) {
  const { guildId, ...updateData } = req.body;

  if (!guildId) {
    return res.status(400).json({ error: 'Guild ID required' });
  }

  try {
    // Validate input data
    const validatedData = validateSettingsData(updateData);
    
    // Update settings
    const updatedSettings = updateMockGuildSettings(guildId, validatedData);
    
    return res.status(200).json({ 
      success: true, 
      message: 'Settings updated successfully',
      data: updatedSettings 
    });
  } catch (error) {
    console.error('Error updating settings:', error);
    return res.status(500).json({ error: 'Server error saving settings' });
  }
}

function validateSettingsData(data: Record<string, unknown>): Record<string, unknown> {
  const allowedFields = [
    'prefix',
    'modLogChannelId',
    'levelUpChannelId',
    'quarantineRoleId',
    'geizhalsChannelId',
    'welcomeChannelId',
    'enableLeveling',
    'enableModeration',
    'enableGeizhals',
    'enablePolls',
    'enableGiveaways',
    'enableAutomod',
    'enableTickets',
    'enableMusic',
    'welcomeMessage',
    'leaveMessage'
  ];

  const validatedData: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    if (allowedFields.includes(key)) {
      // Type-specific validation
      if (key === 'prefix' && typeof value === 'string') {
        validatedData[key] = value.slice(0, 5); // Max 5 characters
      } else if (key.startsWith('enable') && typeof value === 'boolean') {
        validatedData[key] = value;
      } else if (key.endsWith('ChannelId') || key.endsWith('RoleId')) {
        validatedData[key] = value === '' ? null : value;
      } else if ((key === 'welcomeMessage' || key === 'leaveMessage') && typeof value === 'string') {
        validatedData[key] = value.slice(0, 2000); // Max 2000 characters
      }
    }
  }

  return validatedData;
}