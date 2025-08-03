import i18next from 'i18next';
import Backend from 'i18next-fs-backend';
import { join } from 'path';
import { logger } from '../utils/logger';

export async function initializeI18n(): Promise<void> {
  try {
    await i18next
      .use(Backend)
      .init({
        backend: {
          loadPath: join(__dirname, 'locales', '{{lng}}.json'),
        },
        fallbackLng: 'en',
        supportedLngs: ['en', 'es', 'fr', 'de', 'nl', 'pt', 'ru', 'ja', 'ko', 'zh'],
        preload: ['en'],
        interpolation: {
          escapeValue: false,
        },
        returnObjects: true,
        debug: process.env.NODE_ENV === 'development',
      });
    
    logger.info('i18n initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize i18n:', error);
    throw error;
  }
}

export function t(key: string, options?: any): string {
  return i18next.t(key, options);
}

export function setLanguage(language: string): void {
  i18next.changeLanguage(language);
}

// Guild locale management
const guildLocales = new Map<string, string>();

export function setGuildLocale(guildId: string, locale: string): void {
  guildLocales.set(guildId, locale);
}

export function getGuildLocale(guildId: string): string {
  return guildLocales.get(guildId) || 'en';
}

export function clearGuildLocale(guildId: string): void {
  guildLocales.delete(guildId);
}

// User locale management
const userLocales = new Map<string, string>();

export function setUserLocale(userId: string, locale: string): void {
  userLocales.set(userId, locale);
}

export function getUserLocale(userId: string): string {
  return userLocales.get(userId) || 'en';
}

export function clearUserLocale(userId: string): void {
  userLocales.delete(userId);
}

export const availableLocales = ['en', 'de', 'es', 'fr'];

export { i18next };