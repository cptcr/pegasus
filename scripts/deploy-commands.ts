// scripts/deploy-commands.ts - Deploy Commands to Discord
import { REST, Routes } from 'discord.js';
import { readdirSync } from 'fs';
import { join } from 'path';
import 'dotenv/config';

const commands: any[] = [];
const commandsPath = join(process.cwd(), 'src', 'commands');
const commandFolders = readdirSync(commandsPath);

console.log('🔄 Loading commands...');

for (const folder of commandFolders) {
  const folderPath = join(commandsPath, folder);
  const commandFiles = readdirSync(folderPath).filter(file => file.endsWith('.ts') || file.endsWith('.js'));

  for (const file of commandFiles) {
    const filePath = join(folderPath, file);
    try {
      const { default: command } = await import(`file://${filePath}`);
      if ('data' in command && 'execute' in command) {
        commands.push(command.data.toJSON());
        console.log(`✅ Loaded command: /${command.data.name}`);
      } else {
        console.log(`⚠️ [WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
      }
    } catch (error) {
      console.log(`❌ [ERROR] Failed to load command at ${filePath}:`, error);
    }
  }
}

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN!);

(async () => {
  try {
    console.log(`🚀 Started refreshing ${commands.length} application (/) commands.`);

    const clientId = process.env.DISCORD_CLIENT_ID!;
    const guildId = process.env.TARGET_GUILD_ID;

    if (guildId) {
      // Deploy to specific guild (faster for development)
      const data = await rest.put(
        Routes.applicationGuildCommands(clientId, guildId),
        { body: commands },
      ) as any[];

      console.log(`✅ Successfully reloaded ${data.length} guild application (/) commands for guild ${guildId}.`);
    } else {
      // Deploy globally (takes up to an hour to update)
      const data = await rest.put(
        Routes.applicationCommands(clientId),
        { body: commands },
      ) as any[];

      console.log(`✅ Successfully reloaded ${data.length} global application (/) commands.`);
    }
  } catch (error) {
    console.error('❌ Error deploying commands:', error);
  }
})();