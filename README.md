# Pegasus Bot v2.0.0 - Setup Instructions

## 🚀 Quick Start

### 1. Prerequisites
- Node.js 18+ installed
- PostgreSQL database
- Discord Bot Token

### 2. Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd pegasus-bot

# Install dependencies
npm install

# Copy environment file
cp .env.example .env
```

### 3. Environment Configuration

Edit your `.env` file with your actual values:

```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/pegasus_bot"

# Discord Bot
DISCORD_BOT_TOKEN="your_bot_token_here"
DISCORD_CLIENT_ID="your_client_id_here"
DISCORD_CLIENT_SECRET="your_client_secret_here"

# Security
NEXTAUTH_SECRET="generate_a_secure_secret"
ADMIN_USER_ID="your_discord_user_id"
TARGET_GUILD_ID="your_main_guild_id"

# Optional
NODE_ENV="development"
```

### 4. Database Setup

```bash
# Generate Prisma client
npm run db:generate

# Push database schema
npm run db:push

# Seed with example data (optional)
npm run db:seed
```

### 5. Build and Start

```bash
# Development
npm run dev

# Production
npm run build
npm start
```

## 🔧 Available Commands

### General Commands
- `/help` - Show all commands or get help for a specific command
- `/ping` - Check bot latency and status

### Moderation Commands
- `/quarantine add <user> [reason] [duration]` - Put user in quarantine
- `/quarantine remove <user> [reason]` - Remove user from quarantine
- `/quarantine status <user>` - Check quarantine status
- `/quarantine list` - List all active quarantines

### Fun & Engagement
- `/poll create <title> <options>` - Create a poll
- `/poll end <poll_id>` - End an active poll
- `/giveaway create <title> <prize> <duration>` - Create a giveaway
- `/giveaway end <giveaway_id>` - End a giveaway

### Support System
- `/ticket open <category> <subject>` - Open a support ticket
- `/ticket close [reason]` - Close a ticket
- `/ticket list` - List your tickets

## 🐳 Docker Deployment

### Using Docker Compose (Recommended)

```bash
# Copy and edit environment file
cp .env.example .env

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f hinko-bot
```

### Using Docker Only

```bash
# Build image
docker build -t pegasus-bot .

# Run container
docker run -d \
  --name pegasus-bot \
  --env-file .env \
  -p 3000:3000 \
  -p 3001:3001 \
  pegasus-bot
```

## 📊 Features

### ✅ Implemented Features

- **Moderation System**
  - Quarantine system with role-based restrictions
  - Automatic expiration timers
  - Full logging and audit trail

- **Poll System**
  - Multiple choice polls
  - Anonymous voting option
  - Automatic expiration
  - Real-time vote counting

- **Giveaway System**
  - Role and level requirements
  - Multiple winners support
  - Automatic winner selection
  - Reroll functionality

- **Ticket System**
  - Category-based tickets
  - Priority levels
  - Automatic transcripts
  - Staff management

- **Level System**
  - XP and leveling
  - Level rewards
  - Voice time tracking
  - Leaderboards

- **Database Integration**
  - PostgreSQL with Prisma ORM
  - Full type safety
  - Migration system
  - Data persistence

### 🔄 Additional Features Ready for Extension

- Custom Commands
- Automod Rules
- Music System (placeholder)
- Web Dashboard (WebSocket ready)
- Geizhals Price Tracking

## 🛠️ Development

### Project Structure
```
src/
├── commands/          # Slash commands
│   ├── general/       # General commands
│   ├── giveaway/      # Giveaway commands
│   ├── polls/         # Poll commands
│   ├── quarantine/    # Quarantine commands
│   └── tickets/       # Ticket commands
├── config/            # Configuration
├── database/          # Database manager
├── events/            # Discord events
├── handlers/          # Event and command handlers
├── modules/           # Feature modules
│   ├── giveaways/     # Giveaway system
│   ├── polls/         # Poll system
│   ├── quarantine/    # Quarantine system
│   └── tickets/       # Ticket system
├── utils/             # Utilities
└── index.ts           # Main entry point
```

### Adding New Commands

1. Create command file in appropriate directory
2. Export default object with `data` and `execute` properties
3. Command will be automatically loaded

### Adding New Features

1. Create manager in `src/modules/`
2. Add database models to `prisma/schema.prisma`
3. Run `npm run db:generate` after schema changes
4. Initialize manager in main bot file

## 🔍 Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Check DATABASE_URL format
   - Ensure PostgreSQL is running
   - Verify credentials

2. **Commands Not Registering**
   - Check DISCORD_CLIENT_ID is correct
   - Bot needs `applications.commands` scope
   - Wait up to 1 hour for global commands

3. **Permission Errors**
   - Bot needs proper permissions in guild
   - Check role hierarchy
   - Verify bot has required intents

### Debug Mode

Set `NODE_ENV=development` for verbose logging:

```bash
NODE_ENV=development npm run dev
```

## 📞 Support

- Check logs in `logs/` directory
- Use `/ping` command to test bot connectivity
- Review database with `npm run db:studio`

## 🚀 Production Deployment

1. Set `NODE_ENV=production`
2. Use strong database passwords
3. Enable SSL for database connections
4. Set up proper logging
5. Configure reverse proxy (nginx)
6. Set up monitoring and alerts

## 📄 License

Apache-2.0 License - See LICENSE file for details