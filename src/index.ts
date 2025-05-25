import fs from 'fs';
import path from 'path';
import { ClientWithCommands, Feature } from '../types';

export async function loadFeatures(client: ClientWithCommands): Promise<void> {
  const featuresPath = path.join(__dirname);
  const featureFolders = fs.readdirSync(featuresPath).filter(
    folder => fs.statSync(path.join(featuresPath, folder)).isDirectory()
  );

  for (const folder of featureFolders) {
    const indexPath = path.join(featuresPath, folder, 'index.ts');
    const indexPathJs = path.join(featuresPath, folder, 'index.js');
    let featureFilePath: string | null = null;

    if (fs.existsSync(indexPath)) {
      featureFilePath = indexPath;
    } else if (fs.existsSync(indexPathJs)) {
      featureFilePath = indexPathJs;
    }

    if (!featureFilePath) {
      continue;
    }

    try {
      const featureModule = await import(featureFilePath);
      const feature = (featureModule.default || featureModule) as Feature;

      if (!feature.name || typeof feature.initialize !== 'function') {
        continue;
      }

      const featureConfigKey = feature.name.toLowerCase() as keyof BotConfig['enabledFeatures'];
      const isGloballyEnabled = client.config.enabledFeatures[featureConfigKey] !== false;
      const isFeatureSelfEnabled = feature.enabled !== false;

      if (!isGloballyEnabled || !isFeatureSelfEnabled) {
        continue;
      }
      await feature.initialize(client);
    } catch (error) {
      console.error(`Fehler beim Laden des Features ${folder}:`, error);
    }
  }
}