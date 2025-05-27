# Pegasus Discord Bot

A comprehensive Discord bot with a modern web dashboard, featuring moderation, leveling, polls, giveaways, tickets, and more.

## Features

- 🛡️ **Moderation System** - Warnings, quarantine, auto-moderation
- 📊 **Leveling System** - XP tracking, level rewards, leaderboards
- 📋 **Poll System** - Interactive polls with real-time voting
- 🎁 **Giveaway System** - Automated giveaways with requirements
- 🎫 **Ticket System** - Support ticket management
- 🔊 **Join-to-Create** - Temporary voice channels
- 📱 **Web Dashboard** - Modern Next.js dashboard with real-time updates
- 🔄 **Real-time Updates** - WebSocket integration between bot and dashboard

## Quick Start

### Prerequisites

- Node.js 18+ 
- PostgreSQL database
- Discord Bot Token
- Discord Application with OAuth2 setup

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd pegasus-discord-bot
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Set up the database**
   ```bash
   npm run db:generate
   npm run db:push
   npm run db:seed
   ```

5. **Deploy commands to Discord**
   ```bash
   npm run deploy:commands
   ```

6. **Start the application**
   ```bash
   # Development mode (bot + dashboard)
   npm run dev
   
   # Or start individually
   npm run dev:bot      # Bot only
   npm run dev:dashboard # Dashboard only
   ```

## Configuration

### Environment Variables

Key environment variables you need to set:

```env
# Discord Configuration
DISCORD_BOT_TOKEN=your_bot_token_here
DISCORD_CLIENT_ID=your_client_id_here
DISCORD_CLIENT_SECRET=your_client_secret_here

# Database
DATABASE_URL="postgresql://username:password@localhost:5432/pegasus"

# Guild Settings
TARGET_GUILD_ID=your_guild_id_here

# Dashboard
NEXTAUTH_URL=http://localhost:3001
NEXTAUTH_SECRET=your_secret_here
```

### Discord Bot Setup

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application
3. Go to "Bot" section and create a bot
4. Copy the token to your `.env` file
5. Enable necessary intents:
   - SERVER MEMBERS INTENT
   - MESSAGE CONTENT INTENT
6. Go to "OAuth2" section and set redirect URL:
   - `http://localhost:3001/api/auth/callback/discord`

### Database Setup

The bot uses PostgreSQL with Prisma ORM. Make sure you have PostgreSQL running and update the `DATABASE_URL` in your `.env` file.

## Commands

### General Commands
- `/help` - Show help information
- `/ping` - Check bot latency and status

### Moderation Commands
- `/quarantine add <user> [reason] [duration]` - Quarantine a user
- `/quarantine remove <user> [reason]` - Remove quarantine
- `/quarantine status <user>` - Check quarantine status
- `/quarantine setup` - Setup quarantine system

### Poll Commands
- `/poll create <title> <options> [description] [duration]` - Create a poll
- `/poll end <poll_id>` - End a poll
- `/poll list` - List active polls

### Giveaway Commands
- `/giveaway create <prize> <duration> [winners] [requirements]` - Create a giveaway
- `/giveaway end <id>` - End a giveaway
- `/giveaway reroll <id>` - Reroll winners
- `/giveaway list` - List active giveaways

### Ticket Commands
- `/ticket open <category> <subject> [description]` - Open a support ticket
- `/ticket close [reason]` - Close current ticket
- `/ticket add <user>` - Add user to ticket
- `/ticket remove <user>` - Remove user from ticket

### Voice Commands
- `/join2create setup <category> [name] [limit] [bitrate]` - Setup Join-to-Create
- `/join2create disable` - Disable Join-to-Create
- `/join2create settings` - View current settings

## Dashboard

The web dashboard provides:

- 📊 **Real-time Statistics** - Guild stats, member activity
- 🛡️ **Moderation Panel** - Manage warnings, quarantines
- 📋 **Content Management** - View and manage polls, giveaways, tickets  
- ⚙️ **Settings** - Configure bot features and permissions
- 📱 **Responsive Design** - Works on desktop and mobile

Access the dashboard at `http://localhost:3001` after starting the application.

## Architecture

```
pegasus-discord-bot/
├── src/
│   ├── commands/          # Slash commands
│   ├── events/           # Discord.js event handlers
│   ├── handlers/         # Command, event, and button handlers
│   ├── modules/          # Feature modules (polls, giveaways, etc.)
│   ├── api/              # WebSocket and API management
│   ├── utils/            # Utility functions
│   ├── config/           # Configuration files
│   └── types/            # TypeScript type definitions
├── dashboard/            # Next.js dashboard application
├── prisma/              # Database schema and migrations
└── scripts/             # Utility scripts
```

## Development

### Adding New Commands

1. Create a new file in `src/commands/<category>/`
2. Follow the command structure:
   ```typescript
   export default {
     data: new SlashCommandBuilder()
       .setName('commandname')
       .setDescription('Command description'),
     category: 'category',
     cooldown: 5,
     async execute(interaction, client) {
       // Command logic
     }
   };
   ```
3. Run `npm run deploy:commands` to register with Discord

### Adding New Features

1. Create a manager in `src/modules/<feature>/`
2. Add database models to `prisma/schema.prisma`
3. Update the main client in `src/index.ts`
4. Add dashboard integration if needed

### Database Changes

1. Modify `prisma/schema.prisma`
2. Run `npm run db:generate` to update Prisma client
3. Run `npm run db:push` to apply changes (development)
4. Or create migration: `npx prisma migrate dev`

## Production Deployment

1. **Build the application**
   ```bash
   npm run build
   npm run build:dashboard
   ```

2. **Set production environment variables**
   ```bash
   NODE_ENV=production
   # Update all URLs to production values
   ```

3. **Run database migrations**
   ```bash
   npx prisma migrate deploy
   ```

4. **Start the application**
   ```bash
   npm start
   npm run start:dashboard
   ```

## Monitoring and Logs

The bot uses Winston for logging with different levels:
- `error` - Error messages
- `warn` - Warning messages  
- `info` - General information
- `debug` - Debug information (development only)

Logs are saved to:
- `logs/combined.log` - All logs
- `logs/error.log` - Error logs only

## Support

For support, please:
1. Check the documentation
2. Look at existing issues
3. Create a new issue with detailed information

## License

This project is licensed under the MIT License - see the LICENSE file for details.