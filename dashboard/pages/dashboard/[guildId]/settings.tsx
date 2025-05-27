// dashboard/pages/api/dashboard/settings.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth, AuthenticatedRequest } from '../../../lib/auth';
import databaseEvents from '../../../lib/database';
import { GuildSettings } from '@/types/index';

interface SettingsUpdateRequest {
  enableLeveling?: boolean;
  enableModeration?: boolean;
  enablePolls?: boolean;
  enableGiveaways?: boolean;
  enableTickets?: boolean;
  enableGeizhals?: boolean;
  enableAutomod?: boolean;
  enableMusic?: boolean;
  enableJoinToCreate?: boolean;
  prefix?: string;
  logChannel?: string | null;
  modLogChannel?: string | null;
  quarantineRoleId?: string | null;
  staffRoleId?: string | null;
  welcomeChannel?: string | null;
  autorole?: string | null;
  welcomeMessage?: string | null;
  goodbyeMessage?: string | null;
  geizhalsChannelId?: string | null;
  levelUpChannelId?: string | null;
  joinToCreateChannelId?: string | null;
  joinToCreateCategoryId?: string | null;
}

async function handler(req: AuthenticatedRequest, res: NextApiResponse<GuildSettings | { message: string; error?: string }>) {
  const { guildId } = req.query;

  if (!guildId || typeof guildId !== 'string') {
    return res.status(400).json({ message: 'Guild ID is required' });
  }

  if (req.method === 'GET') {
    try {
      const settings = await databaseEvents.getGuildSettings(guildId);
      
      if (!settings) {
        return res.status(404).json({ message: 'Guild settings not found' });
      }

      res.status(200).json(settings);
    } catch (error: unknown) {
      console.error('Error fetching guild settings:', error);
      res.status(500).json({
        message: 'Failed to fetch guild settings',
        error: process.env.NODE_ENV === 'development' && error instanceof Error ? error.message : undefined
      });
    }
  } else if (req.method === 'PUT') {
    try {
      const updateData: SettingsUpdateRequest = req.body;

      // Validate the update data
      const validatedUpdate: Partial<GuildSettings> = {};

      if (typeof updateData.enableLeveling === 'boolean') {
        validatedUpdate.enableLeveling = updateData.enableLeveling;
      }
      if (typeof updateData.enableModeration === 'boolean') {
        validatedUpdate.enableModeration = updateData.enableModeration;
      }
      if (typeof updateData.enablePolls === 'boolean') {
        validatedUpdate.enablePolls = updateData.enablePolls;
      }
      if (typeof updateData.enableGiveaways === 'boolean') {
        validatedUpdate.enableGiveaways = updateData.enableGiveaways;
      }
      if (typeof updateData.enableTickets === 'boolean') {
        validatedUpdate.enableTickets = updateData.enableTickets;
      }
      if (typeof updateData.enableGeizhals === 'boolean') {
        validatedUpdate.enableGeizhals = updateData.enableGeizhals;
      }
      if (typeof updateData.enableAutomod === 'boolean') {
        validatedUpdate.enableAutomod = updateData.enableAutomod;
      }
      if (typeof updateData.enableMusic === 'boolean') {
        validatedUpdate.enableMusic = updateData.enableMusic;
      }
      if (typeof updateData.enableJoinToCreate === 'boolean') {
        validatedUpdate.enableJoinToCreate = updateData.enableJoinToCreate;
      }
      if (typeof updateData.prefix === 'string') {
        validatedUpdate.prefix = updateData.prefix;
      }
      if (updateData.logChannel !== undefined) {
        validatedUpdate.logChannel = updateData.logChannel;
      }
      if (updateData.modLogChannel !== undefined) {
        validatedUpdate.modLogChannel = updateData.modLogChannel;
      }
      if (updateData.quarantineRoleId !== undefined) {
        validatedUpdate.quarantineRoleId = updateData.quarantineRoleId;
      }
      if (updateData.staffRoleId !== undefined) {
        validatedUpdate.staffRoleId = updateData.staffRoleId;
      }
      if (updateData.welcomeChannel !== undefined) {
        validatedUpdate.welcomeChannel = updateData.welcomeChannel;
      }
      if (updateData.autorole !== undefined) {
        validatedUpdate.autorole = updateData.autorole;
      }
      if (updateData.welcomeMessage !== undefined) {
        validatedUpdate.welcomeMessage = updateData.welcomeMessage;
      }
      if (updateData.goodbyeMessage !== undefined) {
        validatedUpdate.goodbyeMessage = updateData.goodbyeMessage;
      }
      if (updateData.geizhalsChannelId !== undefined) {
        validatedUpdate.geizhalsChannelId = updateData.geizhalsChannelId;
      }
      if (updateData.levelUpChannelId !== undefined) {
        validatedUpdate.levelUpChannelId = updateData.levelUpChannelId;
      }
      if (updateData.joinToCreateChannelId !== undefined) {
        validatedUpdate.joinToCreateChannelId = updateData.joinToCreateChannelId;
      }
      if (updateData.joinToCreateCategoryId !== undefined) {
        validatedUpdate.joinToCreateCategoryId = updateData.joinToCreateCategoryId;
      }

      const updatedGuild = await databaseEvents.updateGuildSettings(guildId, validatedUpdate);
      const updatedSettings = updatedGuild.settings as GuildSettings;

      res.status(200).json(updatedSettings);
    } catch (error: unknown) {
      console.error('Error updating guild settings:', error);
      res.status(500).json({
        message: 'Failed to update guild settings',
        error: process.env.NODE_ENV === 'development' && error instanceof Error ? error.message : undefined
      });
    }
  } else {
    res.setHeader('Allow', ['GET', 'PUT']);
    res.status(405).json({ message: 'Method not allowed' });
  }
}

export default function protectedHandler(req: NextApiRequest, res: NextApiResponse) {
  return requireAuth(req as AuthenticatedRequest, res, handler);
}