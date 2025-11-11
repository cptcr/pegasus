import axios from 'axios';
import { logger } from '../utils/logger';
import { t } from '../i18n';

interface SteamProfile {
  steamid: string;
  personaname: string;
  profileurl: string;
  avatar: string;
  avatarmedium: string;
  avatarfull: string;
  personastate: number;
  communityvisibilitystate: number;
  profilestate?: number;
  lastlogoff?: number;
  commentpermission?: number;
  realname?: string;
  primaryclanid?: string;
  timecreated?: number;
  gameid?: string;
  gameserverip?: string;
  gameextrainfo?: string;
  loccountrycode?: string;
  locstatecode?: string;
  loccityid?: number;
}

export class SteamService {
  private apiKey: string;
  private apiUrl = 'https://api.steampowered.com';

  constructor() {
    this.apiKey = process.env.STEAM_API_KEY || '';
    if (!this.apiKey) {
      logger.warn('Steam API key not configured');
    }
  }

  async getProfile(usernameOrUrl: string): Promise<SteamProfile | null> {
    if (!this.apiKey) {
      throw new Error('Steam API key not configured');
    }

    try {
      // Extract Steam ID from various formats
      const steamId = await this.resolveSteamId(usernameOrUrl);

      if (!steamId) {
        return null;
      }

      // Get player summary
      const response = await axios.get(`${this.apiUrl}/ISteamUser/GetPlayerSummaries/v2/`, {
        params: {
          key: this.apiKey,
          steamids: steamId,
        },
      });

      const responseData = response.data as {
        response: {
          players: SteamProfile[];
        };
      };
      const players = responseData.response.players;

      if (players.length === 0) {
        return null;
      }

      return players[0];
    } catch (error) {
      logger.error('Error fetching Steam profile:', error);
      throw error;
    }
  }

  private async resolveSteamId(input: string): Promise<string | null> {
    // Check if it's already a Steam ID (17 digits)
    if (/^\d{17}$/.test(input)) {
      return input;
    }

    // Check if it's a Steam profile URL
    const profileUrlMatch = input.match(/steamcommunity\.com\/profiles\/(\d{17})/);
    if (profileUrlMatch) {
      return profileUrlMatch[1];
    }

    // Check if it's a custom URL
    const customUrlMatch = input.match(/steamcommunity\.com\/id\/([^/]+)/);
    const vanityUrlName = customUrlMatch ? customUrlMatch[1] : input;

    try {
      // Resolve vanity URL
      const response = await axios.get(`${this.apiUrl}/ISteamUser/ResolveVanityURL/v1/`, {
        params: {
          key: this.apiKey,
          vanityurl: vanityUrlName,
        },
      });

      const responseData = response.data as {
        response: {
          success: number;
          steamid?: string;
        };
      };

      if (responseData.response.success === 1) {
        return responseData.response.steamid ?? null;
      }

      return null;
    } catch (error) {
      logger.error('Error resolving Steam vanity URL:', error);
      return null;
    }
  }

  getStatusText(status: number, locale: string): string {
    const statusMap: Record<number, string> = {
      0: t('commands.utils.steam.statusOffline', { lng: locale }),
      1: t('commands.utils.steam.statusOnline', { lng: locale }),
      2: t('commands.utils.steam.statusBusy', { lng: locale }),
      3: t('commands.utils.steam.statusAway', { lng: locale }),
      4: t('commands.utils.steam.statusSnooze', { lng: locale }),
      5: t('commands.utils.steam.statusLookingToTrade', { lng: locale }),
      6: t('commands.utils.steam.statusLookingToPlay', { lng: locale }),
    };

    return statusMap[status] || t('commands.utils.steam.unknown', { lng: locale });
  }

  getVisibilityText(visibility: number, locale: string): string {
    const visibilityMap: Record<number, string> = {
      1: t('commands.utils.steam.visibilityPrivate', { lng: locale }),
      2: t('commands.utils.steam.visibilityFriendsOnly', { lng: locale }),
      3: t('commands.utils.steam.visibilityPublic', { lng: locale }),
    };

    return visibilityMap[visibility] || t('commands.utils.steam.unknown', { lng: locale });
  }

  async getRecentGames(steamId: string, count: number = 3): Promise<unknown[]> {
    if (!this.apiKey) {
      throw new Error('Steam API key not configured');
    }

    try {
      const response = await axios.get(`${this.apiUrl}/IPlayerService/GetRecentlyPlayedGames/v1/`, {
        params: {
          key: this.apiKey,
          steamid: steamId,
          count,
        },
      });

      const responseData = response.data as {
        response: {
          games?: unknown[];
        };
      };
      return responseData.response.games || [];
    } catch (error) {
      logger.error('Error fetching recent games:', error);
      return [];
    }
  }

  async getOwnedGames(steamId: string): Promise<unknown> {
    if (!this.apiKey) {
      throw new Error('Steam API key not configured');
    }

    try {
      const response = await axios.get(`${this.apiUrl}/IPlayerService/GetOwnedGames/v1/`, {
        params: {
          key: this.apiKey,
          steamid: steamId,
          include_appinfo: true,
          include_played_free_games: true,
        },
      });

      const responseData = response.data as {
        response: unknown;
      };
      return responseData.response;
    } catch (error) {
      logger.error('Error fetching owned games:', error);
      return { game_count: 0, games: [] };
    }
  }

  async getPlayerLevel(steamId: string): Promise<number> {
    if (!this.apiKey) {
      throw new Error('Steam API key not configured');
    }

    try {
      const response = await axios.get(`${this.apiUrl}/IPlayerService/GetSteamLevel/v1/`, {
        params: {
          key: this.apiKey,
          steamid: steamId,
        },
      });

      const responseData = response.data as {
        response: {
          player_level?: number;
        };
      };
      return responseData.response.player_level || 0;
    } catch (error) {
      logger.error('Error fetching player level:', error);
      return 0;
    }
  }

  async getPlayerBans(steamId: string): Promise<unknown> {
    if (!this.apiKey) {
      throw new Error('Steam API key not configured');
    }

    try {
      const response = await axios.get(`${this.apiUrl}/ISteamUser/GetPlayerBans/v1/`, {
        params: {
          key: this.apiKey,
          steamids: steamId,
        },
      });

      const responseData = response.data as {
        players: unknown[];
      };
      return responseData.players[0] || null;
    } catch (error) {
      logger.error('Error fetching player bans:', error);
      return null;
    }
  }
}
