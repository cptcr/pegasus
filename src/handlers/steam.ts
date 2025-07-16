import axios from 'axios';
import { db } from '../database/connection';
import { security, validateUserInput } from './security';

interface SteamAppDetails {
  appid: number;
  name: string;
  type: string;
  price_overview?: {
    currency: string;
    initial: number;
    final: number;
    discount_percent: number;
    initial_formatted: string;
    final_formatted: string;
  };
  is_free: boolean;
  short_description: string;
  header_image: string;
  website?: string;
  developers: string[];
  publishers: string[];
  release_date: {
    coming_soon: boolean;
    date: string;
  };
  platforms: {
    windows: boolean;
    mac: boolean;
    linux: boolean;
  };
  categories: Array<{
    id: number;
    description: string;
  }>;
  genres: Array<{
    id: string;
    description: string;
  }>;
  screenshots: Array<{
    id: number;
    path_thumbnail: string;
    path_full: string;
  }>;
  achievements?: {
    total: number;
  };
  metacritic?: {
    score: number;
    url: string;
  };
  recommendations?: {
    total: number;
  };
  dlc?: number[];
  supported_languages: string;
  reviews?: string;
}

interface SteamSearchResult {
  appid: number;
  name: string;
  logo: string;
  type: string;
}

interface CachedSteamData {
  appid: number;
  data: SteamAppDetails;
  cached_at: Date;
  expires_at: Date;
}

export class SteamHandler {
  private static instance: SteamHandler;
  private readonly apiUrl = 'https://store.steampowered.com/api';
  private readonly searchUrl = 'https://steamcommunity.com/actions/SearchApps';
  private readonly cacheExpiry = 24 * 60 * 60 * 1000; // 24 hours
  private requestQueue: Array<() => Promise<any>> = [];
  private isProcessingQueue = false;
  private rateLimitDelay = 1000; // 1 second between requests

  public static getInstance(): SteamHandler {
    if (!SteamHandler.instance) {
      SteamHandler.instance = new SteamHandler();
    }
    return SteamHandler.instance;
  }

  constructor() {
    this.initializeDatabase();
    this.startQueueProcessor();
  }

  private async initializeDatabase(): Promise<void> {
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS steam_cache (
          appid INTEGER PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          data JSONB NOT NULL,
          cached_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          expires_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP + INTERVAL '24 hours',
          search_terms TEXT[] DEFAULT '{}',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_steam_cache_expires 
        ON steam_cache(expires_at)
      `);

      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_steam_cache_search 
        ON steam_cache USING GIN(search_terms)
      `);

      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_steam_cache_name 
        ON steam_cache USING GIN(to_tsvector('english', name))
      `);

      console.log('Steam cache database initialized');
    } catch (error) {
      console.error('Failed to initialize steam cache database:', error);
    }
  }

  private startQueueProcessor(): void {
    setInterval(() => {
      this.processQueue();
    }, this.rateLimitDelay);
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;
    const request = this.requestQueue.shift();
    
    if (request) {
      try {
        await request();
      } catch (error) {
        console.error('Error processing Steam API request:', error);
      }
    }
    
    this.isProcessingQueue = false;
  }

  private queueRequest<T>(request: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push(async () => {
        try {
          const result = await request();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  public async searchGames(query: string, limit: number = 10): Promise<SteamSearchResult[]> {
    const input = validateUserInput({ text: query, number: limit });
    if (!input || !input.text) {
      throw new Error('Invalid search query');
    }

    // First check cache for exact matches
    const cached = await this.searchCache(input.text, input.number || 10);
    if (cached.length > 0) {
      return cached;
    }

    // Search Steam API
    return this.queueRequest(async () => {
      try {
        const response = await axios.get(this.searchUrl, {
          params: {
            term: input.text,
            f: 'games',
            cc: 'US',
            l: 'english',
            v: Date.now()
          },
          timeout: 10000
        });

        const results = response.data.slice(0, input.number || 10).map((app: any) => ({
          appid: parseInt(app.appid),
          name: security.sanitizeInput(app.name),
          logo: app.logo,
          type: 'game'
        }));

        // Cache search results
        for (const result of results) {
          await this.updateSearchTerms(result.appid, input.text!);
        }

        return results;
      } catch (error) {
        console.error('Steam search API error:', error);
        return [];
      }
    });
  }

  private async searchCache(query: string, limit: number): Promise<SteamSearchResult[]> {
    try {
      const result = await db.query(`
        SELECT appid, name, (data->>'header_image') as logo
        FROM steam_cache 
        WHERE 
          expires_at > CURRENT_TIMESTAMP 
          AND (
            $1 = ANY(search_terms) 
            OR to_tsvector('english', name) @@ plainto_tsquery('english', $1)
            OR LOWER(name) LIKE LOWER($2)
          )
        ORDER BY 
          CASE WHEN LOWER(name) = LOWER($1) THEN 1 ELSE 2 END,
          name
        LIMIT $3
      `, [query, `%${query}%`, limit]);

      return result.rows.map((row: any) => ({
        appid: row.appid,
        name: row.name,
        logo: row.logo || '',
        type: 'game'
      }));
    } catch (error) {
      console.error('Error searching cache:', error);
      return [];
    }
  }

  public async getGameDetails(appId: number | string): Promise<SteamAppDetails | null> {
    const input = validateUserInput({ number: Number(appId) });
    if (!input || !input.number) {
      throw new Error('Invalid app ID');
    }

    // Check cache first
    const cached = await this.getCachedData(input.number);
    if (cached) {
      return cached.data;
    }

    // Fetch from Steam API
    return this.queueRequest(async () => {
      try {
        const response = await axios.get(`${this.apiUrl}/appdetails`, {
          params: {
            appids: input.number,
            cc: 'US',
            l: 'english'
          },
          timeout: 15000
        });

        const appData = response.data[input.number!];
        
        if (!appData?.success || !appData.data) {
          return null;
        }

        const gameData: SteamAppDetails = {
          appid: input.number!,
          name: security.sanitizeInput(appData.data.name),
          type: appData.data.type,
          price_overview: appData.data.price_overview,
          is_free: appData.data.is_free || false,
          short_description: security.sanitizeInput(appData.data.short_description || ''),
          header_image: appData.data.header_image || '',
          website: appData.data.website,
          developers: (appData.data.developers || []).map((dev: string) => security.sanitizeInput(dev)),
          publishers: (appData.data.publishers || []).map((pub: string) => security.sanitizeInput(pub)),
          release_date: appData.data.release_date || { coming_soon: false, date: 'Unknown' },
          platforms: appData.data.platforms || { windows: false, mac: false, linux: false },
          categories: appData.data.categories || [],
          genres: appData.data.genres || [],
          screenshots: (appData.data.screenshots || []).slice(0, 5),
          achievements: appData.data.achievements,
          metacritic: appData.data.metacritic,
          recommendations: appData.data.recommendations,
          dlc: appData.data.dlc,
          supported_languages: security.sanitizeInput(appData.data.supported_languages || ''),
          reviews: appData.data.reviews
        };

        // Cache the data
        await this.cacheData(gameData);
        
        return gameData;
      } catch (error) {
        console.error('Steam API error:', error);
        return null;
      }
    });
  }

  private async getCachedData(appId: number): Promise<CachedSteamData | null> {
    try {
      const result = await db.query(
        'SELECT * FROM steam_cache WHERE appid = $1 AND expires_at > CURRENT_TIMESTAMP',
        [appId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        appid: row.appid,
        data: row.data,
        cached_at: row.cached_at,
        expires_at: row.expires_at
      };
    } catch (error) {
      console.error('Error retrieving cached data:', error);
      return null;
    }
  }

  private async cacheData(gameData: SteamAppDetails): Promise<void> {
    try {
      const expiresAt = new Date(Date.now() + this.cacheExpiry);
      
      await db.query(`
        INSERT INTO steam_cache (appid, name, data, expires_at, search_terms)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (appid) 
        DO UPDATE SET 
          name = $2,
          data = $3,
          expires_at = $4,
          updated_at = CURRENT_TIMESTAMP
      `, [
        gameData.appid,
        gameData.name,
        JSON.stringify(gameData),
        expiresAt,
        [gameData.name.toLowerCase()]
      ]);
    } catch (error) {
      console.error('Error caching steam data:', error);
    }
  }

  private async updateSearchTerms(appId: number, searchTerm: string): Promise<void> {
    try {
      await db.query(`
        UPDATE steam_cache 
        SET search_terms = array_append(
          COALESCE(search_terms, '{}'), 
          $2
        )
        WHERE appid = $1 
        AND NOT ($2 = ANY(COALESCE(search_terms, '{}')))
      `, [appId, searchTerm.toLowerCase()]);
    } catch (error) {
      console.error('Error updating search terms:', error);
    }
  }

  public async cleanExpiredCache(): Promise<number> {
    try {
      const result = await db.query(
        'DELETE FROM steam_cache WHERE expires_at < CURRENT_TIMESTAMP'
      );
      return result.rowCount || 0;
    } catch (error) {
      console.error('Error cleaning expired cache:', error);
      return 0;
    }
  }

  public async getRandomGame(): Promise<SteamAppDetails | null> {
    try {
      const result = await db.query(`
        SELECT data 
        FROM steam_cache 
        WHERE expires_at > CURRENT_TIMESTAMP 
        ORDER BY RANDOM() 
        LIMIT 1
      `);

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0].data;
    } catch (error) {
      console.error('Error getting random game:', error);
      return null;
    }
  }

  public async getPopularGames(limit: number = 10): Promise<SteamAppDetails[]> {
    const input = validateUserInput({ number: limit });
    if (!input || !input.number) {
      throw new Error('Invalid limit');
    }

    try {
      const result = await db.query(`
        SELECT data 
        FROM steam_cache 
        WHERE 
          expires_at > CURRENT_TIMESTAMP 
          AND (data->>'recommendations') IS NOT NULL
        ORDER BY CAST(data->'recommendations'->>'total' AS INTEGER) DESC NULLS LAST
        LIMIT $1
      `, [input.number]);

      return result.rows.map((row: any) => row.data);
    } catch (error) {
      console.error('Error getting popular games:', error);
      return [];
    }
  }

  public async searchByGenre(genre: string, limit: number = 10): Promise<SteamAppDetails[]> {
    const input = validateUserInput({ text: genre, number: limit });
    if (!input || !input.text) {
      throw new Error('Invalid genre');
    }

    try {
      const result = await db.query(`
        SELECT data 
        FROM steam_cache 
        WHERE 
          expires_at > CURRENT_TIMESTAMP 
          AND data->'genres' @> $1
        ORDER BY name
        LIMIT $2
      `, [
        JSON.stringify([{ description: input.text }]),
        input.number || 10
      ]);

      return result.rows.map((row: any) => row.data);
    } catch (error) {
      console.error('Error searching by genre:', error);
      return [];
    }
  }

  public async getCacheStats(): Promise<any> {
    try {
      const stats = await db.query(`
        SELECT 
          COUNT(*) as total_games,
          COUNT(*) FILTER (WHERE expires_at > CURRENT_TIMESTAMP) as valid_cache,
          COUNT(*) FILTER (WHERE expires_at < CURRENT_TIMESTAMP) as expired_cache,
          MIN(cached_at) as oldest_cache,
          MAX(cached_at) as newest_cache
        FROM steam_cache
      `);

      return stats.rows[0];
    } catch (error) {
      console.error('Error getting cache stats:', error);
      return null;
    }
  }

  public formatPrice(priceData: any): string {
    if (!priceData) return 'Free';
    
    if (priceData.discount_percent > 0) {
      return `~~${priceData.initial_formatted}~~ **${priceData.final_formatted}** (${priceData.discount_percent}% off)`;
    }
    
    return priceData.final_formatted;
  }

  public getPlatformEmojis(platforms: any): string {
    const emojis: string[] = [];
    if (platforms.windows) emojis.push('🪟');
    if (platforms.mac) emojis.push('🍎');
    if (platforms.linux) emojis.push('🐧');
    return emojis.join(' ') || '❓';
  }

  public getReviewScore(reviews: string): string {
    if (!reviews) return 'No reviews';
    
    const reviewLower = reviews.toLowerCase();
    if (reviewLower.includes('overwhelmingly positive')) return '🟢 Overwhelmingly Positive';
    if (reviewLower.includes('very positive')) return '🟢 Very Positive';
    if (reviewLower.includes('positive')) return '🟢 Positive';
    if (reviewLower.includes('mostly positive')) return '🟡 Mostly Positive';
    if (reviewLower.includes('mixed')) return '🟡 Mixed';
    if (reviewLower.includes('mostly negative')) return '🔴 Mostly Negative';
    if (reviewLower.includes('negative')) return '🔴 Negative';
    if (reviewLower.includes('very negative')) return '🔴 Very Negative';
    if (reviewLower.includes('overwhelmingly negative')) return '🔴 Overwhelmingly Negative';
    
    return reviews;
  }
}

export const steam = SteamHandler.getInstance();