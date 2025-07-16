import { readFileSync } from 'fs';
import { join } from 'path';
import { db } from '../database/connection';

interface TranslationData {
  [key: string]: any;
}

interface LanguageCache {
  [locale: string]: TranslationData;
}

interface UserLanguageCache {
  [userId: string]: string;
}

interface GuildLanguageCache {
  [guildId: string]: string;
}

export class I18nHandler {
  private static instance: I18nHandler;
  private translations: LanguageCache = {};
  private userLanguages: UserLanguageCache = {};
  private guildLanguages: GuildLanguageCache = {};
  private defaultLocale = 'en';
  private supportedLocales = ['en', 'es', 'fr'];

  public static getInstance(): I18nHandler {
    if (!I18nHandler.instance) {
      I18nHandler.instance = new I18nHandler();
    }
    return I18nHandler.instance;
  }

  constructor() {
    this.loadTranslations();
    this.loadUserLanguages();
    this.loadGuildLanguages();
  }

  private loadTranslations(): void {
    const localesPath = join(__dirname, 'locales');
    
    for (const locale of this.supportedLocales) {
      try {
        const filePath = join(localesPath, `${locale}.json`);
        const content = readFileSync(filePath, 'utf8');
        this.translations[locale] = JSON.parse(content);
        console.log(`Loaded translations for locale: ${locale}`);
      } catch (error) {
        if (locale === this.defaultLocale) {
          console.error(`Failed to load default locale ${locale}:`, error);
          throw error;
        } else {
          console.warn(`Failed to load locale ${locale}, skipping:`, error);
        }
      }
    }
  }

  private async loadUserLanguages(): Promise<void> {
    try {
      const result = await db.query('SELECT user_id, language FROM user_languages');
      for (const row of result.rows) {
        this.userLanguages[row.user_id] = row.language;
      }
      console.log(`Loaded ${result.rows.length} user language preferences`);
    } catch (error) {
      console.warn('Failed to load user languages:', error);
    }
  }

  private async loadGuildLanguages(): Promise<void> {
    try {
      const result = await db.query('SELECT guild_id, language FROM guild_settings WHERE language IS NOT NULL');
      for (const row of result.rows) {
        this.guildLanguages[row.guild_id] = row.language;
      }
      console.log(`Loaded ${result.rows.length} guild language preferences`);
    } catch (error) {
      console.warn('Failed to load guild languages:', error);
    }
  }

  public async setUserLanguage(userId: string, locale: string): Promise<boolean> {
    if (!this.isValidLocale(locale)) {
      return false;
    }

    try {
      await db.query(
        `INSERT INTO user_languages (user_id, language) VALUES ($1, $2) 
         ON CONFLICT (user_id) DO UPDATE SET language = $2, updated_at = CURRENT_TIMESTAMP`,
        [userId, locale]
      );

      this.userLanguages[userId] = locale;
      return true;
    } catch (error) {
      console.error('Failed to set user language:', error);
      return false;
    }
  }

  public async setGuildLanguage(guildId: string, locale: string): Promise<boolean> {
    if (!this.isValidLocale(locale)) {
      return false;
    }

    try {
      await db.query(
        `INSERT INTO guild_settings (guild_id, language) VALUES ($1, $2)
         ON CONFLICT (guild_id) DO UPDATE SET language = $2, updated_at = CURRENT_TIMESTAMP`,
        [guildId, locale]
      );

      this.guildLanguages[guildId] = locale;
      return true;
    } catch (error) {
      console.error('Failed to set guild language:', error);
      return false;
    }
  }

  public async resetUserLanguage(userId: string): Promise<boolean> {
    try {
      await db.query('DELETE FROM user_languages WHERE user_id = $1', [userId]);
      delete this.userLanguages[userId];
      return true;
    } catch (error) {
      console.error('Failed to reset user language:', error);
      return false;
    }
  }

  public async resetGuildLanguage(guildId: string): Promise<boolean> {
    try {
      await db.query(
        'UPDATE guild_settings SET language = NULL WHERE guild_id = $1',
        [guildId]
      );
      delete this.guildLanguages[guildId];
      return true;
    } catch (error) {
      console.error('Failed to reset guild language:', error);
      return false;
    }
  }

  public getUserLanguage(userId: string): string | null {
    return this.userLanguages[userId] || null;
  }

  public getGuildLanguage(guildId: string): string {
    return this.guildLanguages[guildId] || this.defaultLocale;
  }

  public getLocale(userId?: string, guildId?: string): string {
    // Priority: User language > Guild language > Default
    if (userId && this.userLanguages[userId]) {
      return this.userLanguages[userId];
    }
    
    if (guildId && this.guildLanguages[guildId]) {
      return this.guildLanguages[guildId];
    }
    
    return this.defaultLocale;
  }

  public t(key: string, options: { 
    userId?: string; 
    guildId?: string; 
    variables?: Record<string, any>;
    fallback?: string;
  } = {}): string {
    const locale = this.getLocale(options.userId, options.guildId);
    const translation = this.getTranslation(key, locale) || 
                       this.getTranslation(key, this.defaultLocale) ||
                       options.fallback ||
                       key;

    return this.interpolate(translation, options.variables || {});
  }

  private getTranslation(key: string, locale: string): string | null {
    const translations = this.translations[locale];
    if (!translations) return null;

    const keys = key.split('.');
    let current = translations;

    for (const k of keys) {
      if (current && typeof current === 'object' && k in current) {
        current = current[k];
      } else {
        return null;
      }
    }

    return typeof current === 'string' ? current : null;
  }

  private interpolate(text: string, variables: Record<string, any>): string {
    return text.replace(/\{(\w+)\}/g, (match, key) => {
      return variables[key] !== undefined ? String(variables[key]) : match;
    });
  }

  public isValidLocale(locale: string): boolean {
    return this.supportedLocales.includes(locale);
  }

  public getSupportedLocales(): string[] {
    return [...this.supportedLocales];
  }

  public getLocaleName(locale: string): string {
    const localeNames: Record<string, string> = {
      'en': 'English',
      'es': 'Español',
      'fr': 'Français',
      'de': 'Deutsch',
      'it': 'Italiano',
      'pt': 'Português',
      'ru': 'Русский',
      'ja': '日本語',
      'ko': '한국어',
      'zh': '中文'
    };

    return localeNames[locale] || locale;
  }

  public getAvailableLanguages(): Array<{ code: string; name: string }> {
    return this.supportedLocales
      .filter(locale => this.translations[locale])
      .map(locale => ({
        code: locale,
        name: this.getLocaleName(locale)
      }));
  }

  // Helper method for commands that need translations
  public createTranslator(userId?: string, guildId?: string) {
    return (key: string, variables?: Record<string, any>, fallback?: string) => {
      return this.t(key, { userId, guildId, variables, fallback });
    };
  }

  // Method to reload translations from disk
  public reloadTranslations(): void {
    this.translations = {};
    this.loadTranslations();
  }

  // Method to get translation statistics
  public getTranslationStats(): Record<string, any> {
    const stats: Record<string, any> = {};
    
    for (const locale of this.supportedLocales) {
      if (this.translations[locale]) {
        stats[locale] = {
          name: this.getLocaleName(locale),
          loaded: true,
          keyCount: this.countKeys(this.translations[locale])
        };
      } else {
        stats[locale] = {
          name: this.getLocaleName(locale),
          loaded: false,
          keyCount: 0
        };
      }
    }

    return stats;
  }

  private countKeys(obj: any, depth = 0): number {
    if (depth > 10) return 0; // Prevent infinite recursion
    
    let count = 0;
    for (const key in obj) {
      if (typeof obj[key] === 'string') {
        count++;
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        count += this.countKeys(obj[key], depth + 1);
      }
    }
    return count;
  }

  // Method to check for missing translations
  public getMissingTranslations(targetLocale: string): string[] {
    const baseKeys = this.getAllKeys(this.translations[this.defaultLocale] || {});
    const targetKeys = this.getAllKeys(this.translations[targetLocale] || {});
    
    return baseKeys.filter(key => !targetKeys.includes(key));
  }

  private getAllKeys(obj: any, prefix = ''): string[] {
    const keys: string[] = [];
    
    for (const key in obj) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      
      if (typeof obj[key] === 'string') {
        keys.push(fullKey);
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        keys.push(...this.getAllKeys(obj[key], fullKey));
      }
    }
    
    return keys;
  }
}

export const i18n = I18nHandler.getInstance();