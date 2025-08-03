# Pegasus Discord Bot

<div align="center">
  <img src="https://img.shields.io/badge/Discord.js-v14-blue?style=for-the-badge&logo=discord" alt="Discord.js">
  <img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL">
  <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" alt="License">
</div>

<div align="center">
  <h3>A powerful, feature-rich Discord bot built with TypeScript and Discord.js</h3>
  <p>
    <a href="https://discord.gg/vaultscope">Support Server</a> •
    <a href="https://cptcr.dev">Developer</a> •
    <a href="#features">Features</a> •
    <a href="#installation">Installation</a> •
    <a href="#configuration">Configuration</a>
  </p>
</div>

---

## 📋 Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Commands](#commands)
- [Contributing](#contributing)
- [License](#license)
- [Support](#support)

## ✨ Features

Pegasus is a comprehensive Discord bot that offers a wide range of features to enhance your server experience:

### 🛡️ Moderation & Security
- **Advanced Warning System**: Create, edit, and track warnings with customizable levels and automation rules
- **Comprehensive Moderation Tools**: Ban, kick, timeout, and manage users efficiently
- **Blacklist System**: Manage user blacklists with ease
- **Auto-moderation**: Automated actions based on warning levels

### 🎉 Engagement & Entertainment
- **Giveaway System**: Create and manage giveaways with advanced features like re-entry and requirement-based entries
- **Economy System**: Complete economy with daily rewards, comprehensive gambling games, shops, work, and robbery mechanics
- **XP & Leveling System**: Track user activity with customizable XP rewards and role rewards
- **Interactive Games**: Multiple gambling games including dice, coinflip, slots, blackjack, and roulette

### 🎫 Support & Management
- **Advanced Ticket System**: Create support panels, manage tickets with claiming, closing, and freezing capabilities
- **Multi-language Support**: Full support for German, English, Spanish, and French
- **Customizable Configuration**: Extensive configuration options for all systems

### 🛠️ Utility
- **User Information**: Avatar, banner, and detailed user/server information commands
- **Server Management**: Welcome/goodbye messages, auto-roles, and server configuration
- **Steam Integration**: View Steam profiles and game information

## 🔧 Tech Stack

- **Language**: TypeScript
- **Framework**: Discord.js v14
- **Database**: PostgreSQL with Drizzle ORM
- **Multi-language**: i18n with support for 4 languages (DE, EN, ES, FR)
- **Architecture**: Modular command and event handling system

## 📦 Prerequisites

Before installing Pegasus, ensure you have the following:

- Node.js 18.0.0 or higher
- PostgreSQL 14 or higher
- npm or yarn package manager
- A Discord Bot Token ([Create one here](https://discord.com/developers/applications))

## 🚀 Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/cptcr/pegasus.git
   cd pegasus
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   yarn install
   ```

3. **Set up environment variables**
   
   Create a `.env` file in the root directory:
   ```env
   # Discord Configuration
   DISCORD_TOKEN=your_bot_token_here
   CLIENT_ID=your_client_id_here
   GUILD_ID=your_development_guild_id # Optional, for guild-specific commands
   
   # Database Configuration
   DATABASE_URL=postgresql://user:password@localhost:5432/pegasus
   
   # Optional Configuration
   NODE_ENV=development
   LOG_LEVEL=info
   ```

4. **Set up the database**
   ```bash
   # Run database migrations
   npm run db:migrate
   # or
   yarn db:migrate
   ```

5. **Build the project**
   ```bash
   npm run build
   # or
   yarn build
   ```

6. **Start the bot**
   ```bash
   # Production
   npm start
   # or
   yarn start
   
   # Development (with hot reload)
   npm run dev
   # or
   yarn dev
   ```

## ⚙️ Configuration

### Initial Setup

After inviting the bot to your server, use the following commands to configure it:

1. **Set server language**: `/config lang`
2. **Configure XP system**: `/config xp`
3. **Set up economy**: `/config eco`
4. **Configure welcome messages**: `/config welcome`
5. **Set up auto-roles**: `/config autorole`

### Database Schema

Pegasus uses Drizzle ORM with PostgreSQL. The database schema is automatically managed through migrations. Key tables include:

- `users` - User data and preferences
- `guilds` - Server configurations
- `warnings` - Warning system data
- `tickets` - Support ticket information
- `giveaways` - Active and past giveaways
- `economy` - User balances and transactions
- `xp_data` - XP and leveling information

## 📝 Commands

### Warning System
- `/warn` - Display all warning commands
- `/warn create` - Issue a warning to a user
- `/warn edit` - Edit an existing warning
- `/warn lookup` - Look up a specific warning
- `/warn view` - View all warnings for a user
- `/warn automation create` - Create warning automation rules
- `/warn automation view` - View all automations
- `/warn automation delete` - Delete an automation

### Moderation
- `/moderation ban` - Ban a user
- `/moderation kick` - Kick a user
- `/moderation timeout` - Timeout a user
- `/moderation reset-xp` - Reset a user's XP

### Giveaways
- `/gw start` - Start a customizable giveaway
- `/gw end` - End an active giveaway
- `/gw configure` - Configure an active giveaway
- `/gw reroll` - Reroll giveaway winners
- `/gw simple` - Create a simple giveaway

### Economy
- `/eco balance` - Check your balance
- `/eco daily` - Claim daily rewards
- `/eco gamble dice` - Roll dice against the dealer
- `/eco gamble coinflip` - Flip a coin (heads or tails)
- `/eco gamble slots` - Play the slot machine
- `/eco gamble blackjack` - Play blackjack against the dealer
- `/eco gamble roulette` - Play roulette with various betting options
- `/eco shop view` - View available shop items
- `/eco shop buy` - Purchase items from the shop
- `/eco shop inventory` - View your purchased items
- `/eco work` - Work for rewards
- `/eco rob` - Attempt to rob another user

### Tickets
- `/ticket panel create` - Create a support panel
- `/ticket panel load` - Load a saved panel
- `/ticket panel delete` - Delete a panel
- `/ticket claim` - Claim a ticket
- `/ticket close` - Close a ticket

### XP System
- `/xp rank` - View your rank
- `/xp leaderboard` - View server leaderboard
- `/xp configuration` - View XP configuration
- `/xp card` - Customize your rank card

### Utility
- `/utils avatar` - View user avatar
- `/utils banner` - View user banner
- `/utils steam` - View Steam profile
- `/utils userinfo` - Get user information
- `/utils whois` - Detailed user lookup
- `/utils roleinfo` - Get role information
- `/utils serverinfo` - Get server information
- `/utils help` - Get help with commands
- `/utils support` - Get support server link

### Configuration
- `/config xp` - Configure XP system
- `/config eco` - Configure economy
- `/config lang` - Set server language
- `/config welcome` - Configure welcome messages
- `/config autorole` - Configure auto-roles
- `/config goodbye` - Configure goodbye messages

### Language
- `/language available` - View available languages
- `/language current` - View current language
- `/language set` - Set your preferred language

### Blacklist
- `/blacklist user` - Blacklist a user
- `/blacklist view` - View blacklisted users
- `/blacklist remove` - Remove from blacklist

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 💬 Support

- **Support Server**: [discord.gg/vaultscope](https://discord.gg/vaultscope)
- **Developer**: [cptcr.dev](https://cptcr.dev)
- **GitHub Issues**: [Report bugs or request features](https://github.com/cptcr/pegasus/issues)

## 🔒 Security

For security concerns, please refer to our [Security Policy](SECURITY.md).

---

<div align="center">
  <p>Made with ❤️ by <a href="https://cptcr.dev">cptcr</a></p>
</div>