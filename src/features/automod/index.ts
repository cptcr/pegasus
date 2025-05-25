import { ClientWithCommands, Feature } from '../../types';

const automodFeature: Feature = {
  name: 'automod',
  description: 'Verwaltet automatische Moderationsregeln und -aktionen.',
  enabled: true,
  async initialize(client: ClientWithCommands) {
    if (!client.config.enabledFeatures.automod) {
      return;
    }
  },
  async shutdown(client: ClientWithCommands) {
  }
};

export default automodFeature;