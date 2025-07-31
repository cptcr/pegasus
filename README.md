# Pegasus Discord Bot

A comprehensive Discord bot built with TypeScript, Discord.js v14, and PostgreSQL. Features advanced giveaway management, moderation tools, economy system, and much more.

## 🚀 Quick Start

```bash
# Clone the repository
git clone https://github.com/cptcr/pegasus.git
cd pegasus-bot

# Configure environment
cp .env.example .env
# Edit .env with your configuration

# Start the bot (handles everything automatically)
npm start
```

That's it! The startup script will automatically:
- ✓ Check Node.js version compatibility
- ✓ Install dependencies if needed
- ✓ Validate environment configuration
- ✓ Set up and migrate the database
- ✓ Build the TypeScript project
- ✓ Start the bot

## 📋 Requirements

- Node.js 18.0 or higher
- npm 8.0 or higher
- PostgreSQL 14.0 or higher
- Discord Bot Token
- Discord Application Client ID

## 🔧 Configuration

### Environment Variables (.env)

```env
# Discord Configuration
BOT_TOKEN=your_bot_token_here
CLIENT_ID=your_client_id_here

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/pegasus

# Optional Features
ENABLE_PREMIUM=true
ENABLE_ANALYTICS=true
ENABLE_AUTO_BACKUP=false

# Security
ENCRYPTION_KEY=base64_encoded_32_byte_key

# Optional API Keys
STEAM_API_KEY=your_steam_api_key
OPENAI_API_KEY=your_openai_api_key
```

### First Time Setup

1. **Create a Discord Application**
   - Go to https://discord.com/developers/applications
   - Create a new application
   - Go to Bot section and create a bot
   - Copy the bot token

2. **Set up PostgreSQL**
   ```bash
   # Using Docker (optional)
   docker run -d --name postgres \
     -e POSTGRES_PASSWORD=yourpassword \
     -e POSTGRES_DB=pegasus \
     -p 5432:5432 \
     postgres:15
   ```

3. **Configure the bot**
   - Copy `.env.example` to `.env`
   - Add your bot token and database URL
   - Configure optional features

4. **Run the bot**
   ```bash
   npm start
   ```

## 🎮 Features

### Core Systems
- **Advanced Giveaway System** - Interactive embed builder, requirements, bonus entries, templates
- **Moderation Tools** - Automod, warnings, temporary punishments, audit logging
- **Economy System** - Virtual currency, shop, inventory, daily rewards
- **XP & Leveling** - Message/voice tracking, level roles, leaderboards
- **Ticket System** - Categories, priorities, transcripts, auto-close
- **Custom Commands** - Per-guild commands with permissions
- **Multi-language Support** - Full i18n implementation

### Security & Infrastructure
- **Permission System** - Granular role-based permissions
- **Rate Limiting** - Command and API rate limits
- **Input Validation** - SQL injection protection, sanitization
- **Audit Logging** - Track all administrative actions
- **Encryption** - Secure storage of sensitive data
- **Backup System** - Automated backups with retention

### Monitoring & Maintenance
- **Health Checks** - `/health` endpoint for monitoring
- **Metrics Export** - Prometheus-compatible metrics
- **Error Tracking** - Comprehensive error logging
- **Performance Monitoring** - Command execution tracking
- **Resource Management** - Memory and connection pooling

## 📝 Available Commands

### Setup Commands
```bash
npm start          # Start the bot (handles all setup)
npm run dev        # Start in development mode
npm run migrate    # Run database migrations manually
npm run backup     # Create a manual backup
npm run restore    # Restore from backup
```

### Maintenance Commands
```bash
npm run typecheck     # Check TypeScript types
npm run migrate:status # Check migration status
npm run migrate:rollback # Rollback last migration
```

## 🔍 Troubleshooting

### Bot won't start
1. Check Node.js version: `node --version` (must be 18+)
2. Verify `.env` file exists and has correct values
3. Test database connection: `psql DATABASE_URL`
4. Check bot token is valid
5. Look for error messages in console

### Database connection issues
1. Verify PostgreSQL is running
2. Check DATABASE_URL format: `postgresql://user:pass@host:port/db`
3. Ensure database exists and user has permissions
4. Try connecting with psql client

### Missing dependencies
```bash
# Force reinstall all dependencies
rm -rf node_modules package-lock.json
npm install
```

## 🚀 Deployment

### Production Deployment

1. **Server Requirements**
   - Ubuntu 20.04+ or similar Linux distribution
   - 2GB+ RAM recommended
   - PostgreSQL 14+ installed
   - Node.js 18+ installed
   - PM2 for process management

2. **Deployment Steps**
   ```bash
   # Install PM2 globally
   npm install -g pm2

   # Clone and setup
   git clone https://github.com/yourusername/pegasus-bot.git
   cd pegasus-bot
   cp .env.example .env
   # Configure .env with production values

   # Start with PM2
   pm2 start npm --name "pegasus-bot" -- start
   pm2 save
   pm2 startup
   ```

3. **Nginx Reverse Proxy** (optional)
   ```nginx
   server {
       listen 80;
       server_name bot.yourdomain.com;

       location /health {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## 📄 License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Discord Server**: [Join our community](https://discord.gg/yourserver)
- **Documentation**: [Wiki](https://github.com/yourusername/pegasus-bot/wiki)
- **Issues**: [GitHub Issues](https://github.com/yourusername/pegasus-bot/issues)

## 🙏 Acknowledgments

- Built with [Discord.js](https://discord.js.org/)
- Database powered by [PostgreSQL](https://www.postgresql.org/)
- TypeScript for type safety
- All our contributors and supporters

---

Made with ❤️ by the Pegasus Bot Team