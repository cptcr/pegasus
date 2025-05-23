# Hinko Discord Bot v2.0.0

A comprehensive Discord bot with leveling system, moderation tools, web dashboard, and advanced features.

## 🚀 Features

- **Leveling System**: XP tracking for messages and voice activity
- **Moderation Tools**: Warnings, quarantine, automod
- **Web Dashboard**: Real-time management interface
- **Geizhals Integration**: Price tracking for hardware
- **Poll System**: Interactive community voting
- **Giveaway System**: Automated contests
- **Ticket System**: Support ticket management
- **Custom Commands**: Guild-specific commands
- **Join-to-Create**: Temporary voice channels
- **Real-time Updates**: WebSocket-powered dashboard

## 📋 Prerequisites

- Node.js 18+
- PostgreSQL 12+
- Discord Application with Bot Token
- (Optional) Redis for caching
- (Optional) Geizhals API access

## 🛠️ Installation

### Quick Start with Docker

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/hinko-discord-bot.git
   cd hinko-discord-bot
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start with Docker Compose**
   ```bash
   docker-compose up -d
   ```

### Manual Installation

1. **Clone and install dependencies**
   ```bash
   git clone https://github.com/yourusername/hinko-discord-bot.git
   cd hinko-discord-bot
   npm install
   cd dashboard && npm install && cd ..
   ```

2. **Set up database**
   ```bash
   # Create PostgreSQL database
   createdb hinko_bot
   
   # Run migrations
   npm run db:push
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your Discord bot token and database URL
   ```

4. **Build and start**
   ```bash
   npm run build
   npm start
   ```

## 🔧 Configuration

### Required Environment Variables

```env
# Discord Bot
DISCORD_BOT_TOKEN="your_bot_token"
DISCORD_CLIENT_ID="your_client_id"
DISCORD_CLIENT_SECRET="your_client_secret"

# Database
DATABASE_URL="postgresql://user:password@localhost:5432/hinko_bot"

# Dashboard Security
ADMIN_USER_ID="your_discord_user_id"
TARGET_GUILD_ID="your_discord_guild_id"
NEXTAUTH_SECRET="random_secret_key"
```

### Discord Application Setup

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application
3. Go to "Bot" section and create a bot
4. Copy the bot token to `DISCORD_BOT_TOKEN`
5. Go to "OAuth2" section and copy Client ID and Secret
6. Add redirect URI: `http://localhost:3001/api/auth/callback/discord`

### Bot Permissions

The bot requires the following permissions:
- Manage Messages
- Manage Roles
- Manage Channels
- View Channels
- Send Messages
- Embed Links
- Attach Files
- Read Message History
- Use External Emojis
- Add Reactions
- Connect (Voice)
- Move Members (Voice)

**Permission Integer**: `8589934592`

## 🚀 Deployment

### Production Deployment

1. **Using Docker (Recommended)**
   ```bash
   # Build production image
   docker build -t hinko-bot .
   
   # Run with docker-compose
   docker-compose -f docker-compose.prod.yml up -d
   ```

2. **Manual Deployment**
   ```bash
   # Set production environment
   export NODE_ENV=production
   
   # Build application
   npm run build
   cd dashboard && npm run build && cd ..
   
   # Start with PM2
   pm2 start ecosystem.config.js
   ```

### Environment-Specific Configurations

**Development**
```bash
npm run dev:concurrent  # Starts both bot and dashboard
```

**Production**
```bash
npm start  # Starts bot only
npm run start:dashboard  # Starts dashboard only
```

## 📊 Dashboard Features

Access the web dashboard at `http://localhost:3001`

- **Real-time Statistics**: Live guild metrics
- **User Management**: Level system oversight
- **Moderation Tools**: Warnings and quarantine management
- **System Settings**: Feature toggles and configuration
- **Activity Monitoring**: Recent events and analytics

### Dashboard Authentication

Only users with the specified role in the target guild can access the dashboard. Configure these in your `.env`:

```env
ADMIN_USER_ID="your_discord_user_id"
TARGET_GUILD_ID="your_discord_guild_id"
```

## 🎮 Bot Commands

### Utility Commands
- `/ping` - Bot latency and status
- `/help` - Command help system
- `/serverinfo` - Server information

### Leveling Commands
- `/level [user]` - Show user level
- `/leaderboard` - Server leaderboard
- `/rank [user]` - User ranking

### Moderation Commands
- `/warn <user> <reason>` - Issue warning
- `/warnings [user]` - View warnings
- `/clearwarns <user>` - Clear warnings
- `/quarantine <user> <reason>` - Quarantine user

### Community Commands
- `/poll create` - Create poll
- `/giveaway create` - Create giveaway
- `/ticket create` - Create support ticket

### Geizhals Commands (if enabled)
- `/geizhals search <product>` - Search products
- `/geizhals track <product> <price>` - Track price
- `/geizhals deals [category]` - Show deals

## 🔧 API Endpoints

### Health Check
```
GET /health
```

### Dashboard API
```
GET /api/dashboard/guild/{guildId}
GET /api/dashboard/stats/{guildId}
GET /api/dashboard/activity/{guildId}
POST /api/dashboard/settings/{guildId}
```

## 🏗️ Architecture

### Project Structure
```
hinko-discord-bot/
├── src/
│   ├── commands/           # Slash commands
│   ├── events/            # Discord event handlers
│   ├── lib/               # Core libraries
│   ├── services/          # Background services
│   └── utils/             # Utility functions
├── dashboard/             # Next.js web dashboard
│   ├── pages/             # Dashboard pages
│   ├── components/        # React components
│   ├── lib/               # Dashboard utilities
│   └── styles/            # CSS styles
├── prisma/                # Database schema and migrations
├── geizhals/              # Geizhals API integration
└── docker/                # Docker configuration
```

### Technology Stack

**Backend**
- Node.js + TypeScript
- Discord.js v14
- Prisma ORM
- PostgreSQL
- Socket.IO

**Frontend**
- Next.js 14
- React 18
- TailwindCSS
- NextAuth.js

**Infrastructure**
- Docker & Docker Compose
- Nginx (reverse proxy)
- Redis (caching)
- PM2 (process management)

## 🔍 Monitoring & Logging

### Health Checks
The bot includes comprehensive health monitoring:

```bash
# Check bot health
curl http://localhost:3000/health

# Check dashboard health
curl http://localhost:3001/api/health
```

### Logging
Logs are structured and include:
- Discord events
- Database operations
- API requests
- Error tracking
- Performance metrics

### Performance Monitoring
- Memory usage tracking
- Database connection monitoring
- Real-time user activity
- Command usage analytics

## 🛡️ Security Features

### Authentication
- Discord OAuth2 integration
- Role-based access control
- Session management
- CSRF protection

### Data Protection
- Environment variable encryption
- Database connection security
- Input validation and sanitization
- Rate limiting

### Access Control
- Guild-specific permissions
- Admin-only dashboard access
- Command permission checks
- Audit logging

## 🔧 Development

### Development Setup
```bash
# Install dependencies
npm install
cd dashboard && npm install && cd ..

# Set up database
npm run db:generate
npm run db:push

# Start development servers
npm run dev:concurrent
```

### Database Management
```bash
# Generate Prisma client
npm run db:generate

# Push schema changes
npm run db:push

# Create migration
npm run db:migrate

# Reset database
npm run db:reset

# Seed database
npm run db:seed
```

### Code Quality
```bash
# Lint code
npm run lint

# Fix linting issues
npm run lint:fix

# Type checking
npm run type-check

# Run tests
npm test
```

## 📝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Ensure code quality checks pass
6. Submit a pull request

### Development Guidelines
- Use TypeScript for type safety
- Follow ESLint configuration
- Write meaningful commit messages
- Document new features
- Test your changes thoroughly

## 🚨 Troubleshooting

### Common Issues

**Bot not responding to commands**
- Check bot token is correct
- Verify bot has necessary permissions
- Ensure bot is in the target guild
- Check database connection

**Dashboard not loading**
- Verify NextAuth configuration
- Check Discord OAuth2 settings
- Ensure user has required role
- Check console for errors

**Database connection issues**
- Verify DATABASE_URL format
- Check PostgreSQL is running
- Ensure database exists
- Check firewall settings

**Permission errors**
- Verify bot permissions in Discord
- Check role hierarchy
- Ensure bot role is above target roles
- Verify channel permissions

### Debug Mode
Enable debug logging:
```env
DEBUG=true
LOG_LEVEL=debug
```

### Getting Help
- Check the [Issues](https://github.com/yourusername/hinko-discord-bot/issues) page
- Join our [Discord Server](https://discord.gg/your-server)
- Read the [Wiki](https://github.com/yourusername/hinko-discord-bot/wiki)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Discord.js community
- Prisma team
- Next.js team
- All contributors

## 🔄 Changelog

### v2.0.0 (Current)
- Complete rewrite in TypeScript
- Web dashboard with real-time updates
- Enhanced leveling system
- Improved moderation tools
- Docker support
- Performance optimizations

### v1.0.0
- Initial release
- Basic bot functionality
- Level system
- Simple moderation

## 🚀 Roadmap

### Upcoming Features
- [ ] Advanced analytics dashboard
- [ ] Multi-language support
- [ ] Plugin system
- [ ] Advanced automod rules
- [ ] Music bot integration
- [ ] Custom themes for dashboard
- [ ] Mobile app companion
- [ ] API for third-party integrations

### Performance Improvements
- [ ] Database query optimization
- [ ] Caching strategy enhancement
- [ ] Load balancing support
- [ ] Microservices architecture

---

**Made with ❤️ for the Discord community**

For support and updates, join our Discord server or check the GitHub repository.