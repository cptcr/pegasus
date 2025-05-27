// scripts/test-token.ts - Test Discord Bot Token
import { Client, GatewayIntentBits } from 'discord.js';
import 'dotenv/config';

console.log('🔐 Testing Discord Bot Token...\n');

const token = process.env.DISCORD_BOT_TOKEN;

if (!token) {
  console.error('❌ DISCORD_BOT_TOKEN is not set in environment variables');
  process.exit(1);
}

console.log(`Token preview: ${token.substring(0, 10)}...${token.substring(token.length - 5)}`);

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.once('ready', (readyClient) => {
  console.log('✅ Bot token is valid!');
  console.log(`✅ Logged in as: ${readyClient.user?.tag}`);
  console.log(`✅ Bot ID: ${readyClient.user?.id}`);
  console.log(`✅ Guilds: ${readyClient.guilds.cache.size}`);
  
  readyClient.guilds.cache.forEach(guild => {
    console.log(`   - ${guild.name} (${guild.id})`);
  });
  
  console.log('\n🎉 Discord connection test successful!');
  process.exit(0);
});

client.on('error', error => {
  console.error('❌ Discord client error:', error);
  process.exit(1);
});

console.log('🔄 Attempting to login...');

client.login(token).catch(error => {
  console.error('❌ Failed to login to Discord:', error);
  
  if (error.code === 'TOKEN_INVALID') {
    console.error('💡 Your bot token is invalid. Please check:');
    console.error('   1. The token is correct in your .env file');
    console.error('   2. The bot hasn\'t been regenerated');
    console.error('   3. There are no extra spaces or characters');
  }
  
  process.exit(1);
});