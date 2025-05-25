// src/features/index.ts - Ladesystem für Features
import fs from 'fs';
import path from 'path';
import { ClientWithCommands, Feature } from '../types'; // ClientWithCommands verwenden

export async function loadFeatures(client: ClientWithCommands): Promise<void> {
  const featuresPath = path.join(__dirname);
  const featureFolders = fs.readdirSync(featuresPath).filter(
    folder => fs.statSync(path.join(featuresPath, folder)).isDirectory()
  );

  const loadedFeatures: string[] = [];
  const disabledFeatures: string[] = [];
  let count = 0;

  console.log(`🔎 Lade Features aus ${featureFolders.length} Ordner(n)...`);

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
      console.warn(`⚠️ Feature-Ordner ${folder} enthält keine index.ts oder index.js. Überspringe.`);
      continue;
    }

    try {
      const featureModule = require(featureFilePath);
      const feature = (featureModule.default || featureModule) as Feature;

      if (!feature.name || typeof feature.initialize !== 'function') {
        console.warn(`⚠️ Feature in ${folder} (${featureFilePath}) exportiert kein gültiges Feature-Objekt.`);
        continue;
      }

      // Prüft, ob das Feature in der Bot-Konfiguration aktiviert ist
      const featureConfigKey = feature.name.toLowerCase() as keyof BotConfig['enabledFeatures'];
      const isGloballyEnabled = client.config.enabledFeatures[featureConfigKey] !== false;
      const isFeatureSelfEnabled = feature.enabled !== false; // Feature-eigene Aktivierung

      if (!isGloballyEnabled || !isFeatureSelfEnabled) {
        disabledFeatures.push(feature.name);
        console.log(`  🚫 Feature übersprungen (deaktiviert): ${feature.name}`);
        continue;
      }

      // Initialisiert das Feature
      await feature.initialize(client);
      loadedFeatures.push(feature.name);
      count++;
      console.log(`  👍 Feature geladen und initialisiert: ${feature.name}`);
    } catch (error) {
      console.error(`❌ Fehler beim Laden des Features ${folder}:`, error);
    }
  }

  console.log(`✨ ${count} Feature(s) erfolgreich geladen: ${loadedFeatures.join(', ') || 'Keine'}`);
  if (disabledFeatures.length > 0) {
    console.log(`🚫 Deaktivierte Features: ${disabledFeatures.join(', ')}`);
  }
}
