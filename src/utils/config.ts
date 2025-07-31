// Re-export from the new config location
export * from '../config';

// Export specific properties from the config for backward compatibility
import { config as mainConfig } from '../config';
export const limits = mainConfig.limits;
export const emojis = mainConfig.emojis;
export const colors = mainConfig.colors;
export const messages = mainConfig.messages;
export const features = mainConfig.features;