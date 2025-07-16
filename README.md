# Pegasus

A comprehensive Discord.js v15 bot with advanced features including moderation tools, AutoMod system, XP system with voice support, economy system, reaction roles, welcome/goodbye messages, join-to-create channels, multi-panel ticket system, community games, statistics tracking, comprehensive logging, Steam integration, i18n language system, reminder system, and advanced security features.

## Features

### 🛡️ Moderation Tools
- **Ban/Kick/Mute/Warn** - Advanced moderation commands with duration support
- **Automatic unmute** - Timed mutes with automatic expiration
- **Moderation logging** - All actions logged to designated channel
- **Permission checks** - Role hierarchy and permission validation

### 🤖 AutoMod System
- **Content filtering** - Profanity, spam, links, invites, excessive caps
- **Custom filters** - Create custom word blacklists and whitelists
- **Configurable actions** - Delete, warn, mute, kick, or ban
- **Role exemptions** - Exempt specific roles from filters
- **Violation tracking** - Track user violations across all filters

### 🎭 Reaction Roles
- **Multiple panel types** - Reactions, buttons, or dropdown menus
- **Role management** - Self-assignable roles with limits
- **Custom styling** - Configurable colors, emojis, and descriptions
- **Requirements system** - Set role or level requirements
- **Bulk operations** - Manage multiple roles efficiently

### 💰 Economy System
- **Virtual currency** - Earn and spend coins throughout the server
- **Banking system** - Store coins safely with configurable limits
- **Work & daily rewards** - Regular income sources with streaks
- **Gambling games** - Coinflip, dice, and slot machines
- **Shop system** - Purchase roles, items, and upgrades
- **Transaction logging** - Complete audit trail of all activities

### 👋 Welcome & Goodbye
- **Custom messages** - Personalized welcome and goodbye messages
- **Welcome cards** - Auto-generated welcome images with user avatars
- **Autoroles** - Automatically assign roles to new members
- **DM messages** - Send private welcome messages
- **Variable support** - Use placeholders for dynamic content

### ⭐ XP System
- **Message XP** - Gain XP from chatting with configurable rates and cooldowns
- **Voice XP** - Earn XP from voice channel activity
- **Leveling system** - Automatic level progression with notifications
- **Leaderboards** - Server-wide XP rankings
- **User profiles** - Detailed statistics and progress tracking

### 🎤 Join-to-Create Channels
- **Dynamic voice channels** - Automatic temporary channel creation
- **Owner permissions** - Channel creators get management permissions
- **Auto-cleanup** - Channels deleted when empty
- **Configurable categories** - Set custom categories for temp channels

### 🎫 Multi-Panel Ticket System
- **Multiple panels** - Create different ticket types with custom panels
- **Role-based support** - Assign specific roles to handle tickets
- **Ticket management** - Claim, close, and track tickets
- **Priority system** - Set ticket priorities (low, medium, high, urgent)
- **Statistics tracking** - Monitor ticket creation and resolution

### 🎮 Community Games
- **Trivia games** - Interactive trivia with multiple categories
- **Leaderboards** - Track game performance and scores
- **Customizable settings** - Configure game duration and difficulty
- **Real-time scoring** - Live score updates during games

### 📊 Statistics System
- **Server analytics** - Member count, activity, and growth tracking
- **User statistics** - Message count, voice time, and engagement
- **Moderation stats** - Track bans, kicks, mutes, and warnings
- **Activity insights** - Most active users and channels

### 📝 Comprehensive Logging
- **Member events** - Join/leave notifications with account age
- **Message logging** - Track edited and deleted messages
- **Voice activity** - Log voice channel joins, leaves, and moves
- **Channel changes** - Monitor channel creation, deletion, and updates
- **Role management** - Track role assignments and modifications
- **Moderation actions** - Log all moderation activities

### 🔒 Security & Safety
- **SQL injection prevention** - Comprehensive query validation and sanitization
- **Input validation** - Secure handling of all user inputs
- **Rate limiting** - Prevent abuse with configurable rate limits
- **Permission validation** - Role hierarchy and permission checks
- **Security logging** - Monitor and log security events

### 🌐 Internationalization (i18n)
- **Multi-language support** - Support for 10+ languages including English, Spanish, French, German, Italian, Portuguese, Russian, Japanese, Korean, and Chinese
- **Per-user preferences** - Users can set their preferred language
- **Per-server defaults** - Server admins can set default language for their server
- **Dynamic translations** - Variable interpolation and fallback support
- **Translation management** - Built-in translation statistics and management tools

### 🎮 Steam Integration
- **Game search** - Search for games on Steam by name
- **Game details** - Get comprehensive information about Steam games including price, reviews, developers, publishers, genres, and platforms
- **Popular games** - Browse popular games with recommendation counts
- **Random discovery** - Get random game suggestions from the database
- **Genre filtering** - Find games by specific genres
- **Intelligent caching** - Efficient API usage with smart caching system
- **Price tracking** - Display current prices and discount information

### ⏰ Reminder System
- **Personal reminders** - Set reminders for yourself with custom messages
- **Flexible timing** - Support for various time formats (1h30m, 2d, 30s, etc.)
- **Repeating reminders** - Set up recurring reminders with custom intervals
- **Multiple delivery methods** - Receive reminders via DM or in specific channels
- **Reminder management** - List, cancel, and modify your active reminders
- **Smart notifications** - Automatic cleanup and reminder history tracking

### 🤖 Dynamic Help System
- **Interactive help menus** - Browse commands by category with dropdown menus
- **Detailed command information** - Usage examples, permissions, and descriptions
- **Multi-language support** - Help system adapts to user's language preference
- **Smart command discovery** - Search and filter commands dynamically
- **Category organization** - Commands organized by feature type for easy navigation
- **Real-time system info** - Bot statistics, uptime, and performance metrics

## Installation

1. Clone the repository:
```bash
git clone https://github.com/cptcr/pegasus.git
cd pegasus
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

Edit `.env` with your configuration:
```env
BOT_TOKEN=your_bot_token_here
CLIENT_ID=your_client_id_here
DATABASE_URL=your_postgres_connection_string_here
NODE_ENV=development
```

4. Set up PostgreSQL/Neon database:
- Create a PostgreSQL database or use Neon
- Update the `DATABASE_URL` in your `.env` file
- The bot will automatically create the required tables on first run

5. Build and run:
```bash
npm run build
npm start
```

For development:
```bash
npm run dev
```

## Configuration

Use the `/config` command to set up the bot:

### XP System
- `/config xp enable` - Enable/disable XP system
- `/config xp rate` - Set XP gain rate (1-100)
- `/config xp cooldown` - Set XP cooldown (1-300 seconds)
- `/config xp levelup-channel` - Set level up notification channel

### Voice Features
- `/config voice join-to-create` - Set join-to-create channel
- `/config voice temp-category` - Set category for temporary channels

### Logging
- `/config log-channel` - Set logging channel for events

### View Configuration
- `/config view` - View current server configuration

## Commands

### Moderation
- `/ban <user> [reason] [duration]` - Ban a user
- `/kick <user> [reason]` - Kick a user
- `/mute <user> <duration> [reason]` - Mute a user
- `/unmute <user> [reason]` - Unmute a user
- `/warn <user> <reason>` - Warn a user

### XP System
- `/rank [user]` - Check XP rank and statistics
- `/leaderboard [limit]` - View server XP leaderboard

### Tickets
- `/ticket panel` - Create a new ticket panel
- `/ticket list` - List all ticket panels
- `/ticket stats` - View ticket statistics

### Games
- `/trivia [rounds]` - Start a trivia game

### Steam Integration
- `/steam search <query>` - Search for games on Steam
- `/steam game <name/id>` - Get detailed game information
- `/steam popular [limit]` - Show popular games
- `/steam random` - Get a random game
- `/steam genre <genre> [limit]` - Search games by genre

### Reminders
- `/reminder set <time> <message>` - Set a new reminder
- `/reminder list` - List your active reminders
- `/reminder cancel [id]` - Cancel a reminder

### Language
- `/language set <language>` - Set your personal language
- `/language server <language>` - Set server default language (Admin)
- `/language current` - Show current language preferences
- `/language available` - List available languages
- `/language reset` - Reset to server default

### Utility
- `/ping` - Check bot latency, uptime, and system information
- `/help [command|category]` - Dynamic help system with interactive menus
- `/stats [type]` - View server statistics
- `/config` - Configure bot settings

## Database Schema

The bot uses PostgreSQL with the following main tables:
- `guild_settings` - Server configuration
- `user_profiles` - User XP and statistics
- `mod_actions` - Moderation action history
- `tickets` - Ticket system data
- `ticket_panels` - Ticket panel configuration
- `temp_channels` - Temporary voice channels
- `game_sessions` - Community game data
- `guild_stats` - Server statistics
- `log_events` - Event logging
- `voice_sessions` - Voice activity tracking
- `user_languages` - User language preferences
- `steam_cache` - Steam game data cache
- `reminders` - User reminder system

## Development

### Project Structure
```
src/
├── commands/          # Slash commands
│   ├── moderation/   # Moderation commands
│   ├── xp/           # XP system commands
│   ├── tickets/      # Ticket system commands
│   ├── games/        # Game commands
│   └── utility/      # Utility commands
├── events/           # Discord.js event handlers
├── handlers/         # Feature handlers
├── database/         # Database connection and queries
├── types/            # TypeScript type definitions
├── i18n/            # Internationalization files
│   └── locales/     # Translation files
└── utils/            # Utility functions and configuration
```

### Contributing
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the Apache License 2.0. See the [LICENSE](LICENSE) file for details.

## Support

For support and questions:
- Create an issue on GitHub
- Check the documentation in the code comments
- Review the configuration examples

## Credits

Created by **cptcr** - A comprehensive Discord bot solution for modern Discord servers.

---

**Note**: This bot requires Discord.js v15 and Node.js 18+. Make sure to set up proper permissions for the bot in your Discord server.