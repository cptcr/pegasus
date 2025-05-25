// src/features/index.ts - Features loading system
import fs from 'fs';
import path from 'path';
import { Client, Feature } from '../types';

export async function loadFeatures(client: Client): Promise<void> {
  const featuresPath = path.join(__dirname);
  const featureFolders = fs.readdirSync(featuresPath).filter(
    folder => fs.statSync(path.join(featuresPath, folder)).isDirectory()
  );

  const loadedFeatures: string[] = [];
  const disabledFeatures: string[] = [];

  for (const folder of featureFolders) {
    const featurePath = path.join(featuresPath, folder, 'index.ts');
    const featureJsPath = path.join(featuresPath, folder, 'index.js');
    
    // Skip if the feature doesn't have an index file
    if (!fs.existsSync(featurePath) && !fs.existsSync(featureJsPath)) {
      console.warn(`⚠️ Feature ${folder} does not have an index file. Skipping.`);
      continue;
    }

    try {
      const feature = require(path.join(featuresPath, folder)).default as Feature;
      
      if (!feature.name || !feature.initialize) {
        console.warn(`⚠️ Feature ${folder} is missing required "name" or "initialize" property. Skipping.`);
        continue;
      }

      // Check if the feature is enabled in bot config
      const featureName = feature.name.toLowerCase();
      const isEnabled = feature.enabled !== false && (
        client.config.enabledFeatures[featureName as keyof typeof client.config.enabledFeatures] !== false
      );

      if (!isEnabled) {
        disabledFeatures.push(feature.name);
        continue;
      }

      // Initialize the feature
      await feature.initialize(client);
      loadedFeatures.push(feature.name);
    } catch (error) {
      console.error(`❌ Error loading feature ${folder}:`, error);
    }
  }

  console.log(`✨ Loaded ${loadedFeatures.length} features: ${loadedFeatures.join(', ')}`);
  if (disabledFeatures.length > 0) {
    console.log(`🚫 Disabled features: ${disabledFeatures.join(', ')}`);
  }
}