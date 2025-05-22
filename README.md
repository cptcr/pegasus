# Hinko 

Ein Discord Bot mit Moderation, Level-System, Geizhals-Integration und Admin Dashboard.

## 🚀 Features

### 🛡️ Moderation
- **Warn System**: Benutzer warnen, editieren, löschen und anzeigen
- **Basic Moderation**: Ban, Kick, Timeout
- **Quarantine System**: Benutzer, Channels und Rollen sperren
- **Rollenhierarchie**: Respektiert Discord-Rollenhierarchien

### 🎮 Community
- **Level System**: XP für Messages und Voice-Activity
- **Leaderboards**: Server und monatliche Ranglisten
- **Level Rewards**: Automatische Rollen bei Level-Ups
- **Custom Level Cards**: Schöne Canva-artige Fortschrittskarten
- **Voice Tracking**: XP für Zeit in Voice Channels

### 💰 Geizhals Integration
- **Preisverfolgun**: Hardware-Produkte überwachen
- **Automatische Alerts**: Benachrichtigung bei Zielpreis
- **Kategorie-Deals**: Tägliche Hardware-Deals
- **Produktsuche**: Direktsuche in Geizhals-Datenbank

### 📊 Admin Dashboard
- **Web Interface**: Next.js Dashboard für Verwaltung
- **Statistiken**: Live-Daten aller Server
- **Einstellungen**: Features aktivieren/deaktivieren
- **Überwachung**: Warnungen und Quarantäne-Einträge

## 🛠️ Installation

### Voraussetzungen
- Node.js 18+
- PostgreSQL (Neon.tech empfohlen)
- Discord Bot Token
- Geizhals API Key

### 1. Projekt klonen
```bash
git clone <repository-url>
cd hinko
npm install
```

### 2. Umgebungsvariablen einrichten
```bash
cp .env.example .env
```

Fülle die `.env` Datei aus:
```env
# Discord
DISCORD_TOKEN=dein_bot_token
DISCORD_ID=deine_bot_id

# Neon.tech Database
DATABASE_URL="postgresql://username:password@ep-xxx.eu-central-1.aws.neon.tech/dbname?sslmode=require"

# Geizhals API
GEIZHALS_USERNAME=dein_username
GEIZHALS_API_KEY=dein_api_key

# Dashboard
NEXTAUTH_SECRET=super-geheimer-schlüssel
ADMIN_USER_ID=deine_discord_user_id
```

### 3. Datenbank einrichten
```bash
# Prisma generieren
npm run db:generate

# Datenbank Schema erstellen
npm run db:push
```

### 4. Bot starten
```bash
# Development
npm run dev

# Production
npm run build
npm start
```

### 5. Dashboard starten (optional)
```bash
# Development
npm run dashboard

# Production
npm run build:dashboard
npm run start:dashboard
```

## 📝 Commands

### Moderation
- `/warn add <user> <reason>` - Benutzer warnen
- `/warn list <user>` - Warnungen anzeigen
- `/warn remove <id>` - Warnung entfernen
- `/warn clear <user>` - Alle Warnungen löschen
- `/quarantine user <user> <reason>` - Benutzer quarantäne
- `/quarantine channel <channel> <reason>` - Channel sperren
- `/quarantine role <role> <reason>` - Rolle sperren
- `/quarantine remove <id>` - Quarantäne aufheben
- `/quarantine setup <role>` - Quarantäne-System einrichten

### Level System
- `/level show [user]` - Level anzeigen
- `/level leaderboard [limit]` - Server Leaderboard
- `/level monthly [month] [year]` - Monatliches Leaderboard

### Geizhals
- `/geizhals search <query> [category]` - Produkte suchen
- `/geizhals track <productid> <targetprice>` - Preis verfolgen
- `/geizhals list` - Eigene Tracker anzeigen
- `/geizhals remove <id>` - Tracker entfernen
- `/geizhals deals [category]` - Aktuelle Deals
- `/geizhals setup <channel>` - System einrichten

## 🏗️ Projektstruktur

```
hinko/
├── src/
│   ├── commands/           # Slash Commands
│   │   ├── moderation/     # Moderation Commands
│   │   ├── leveling/       # Level Commands
│   │   └── geizhals/       # Geizhals Commands
│   ├── events/             # Discord Events
│   ├── lib/                # Utilities
│   │   └── database.ts     # Prisma Client
│   ├── services/           # Business Logic
│   │   └── geizhalsTracker.ts
│   ├── utils/              # Hilfsfunktionen
│   │   └── levelCard.ts    # Canvas Level Cards
│   └── index.ts            # Bot Entry Point
├── dashboard/              # Next.js Admin Dashboard
│   ├── pages/             # Dashboard Pages
│   └── components/        # React Components
├── prisma/
│   └── schema.prisma      # Datenbank Schema
├── geizhals/              # Geizhals API Client
└── config.ts              # Bot Konfiguration
```

## 🗄️ Datenbank Schema

### Haupttabellen
- **guilds**: Server-Einstellungen
- **users**: Benutzer-Daten
- **warns**: Warn-System
- **user_levels**: XP und Level
- **level_rewards**: Level-Belohnungen
- **quarantine_entries**: Quarantäne-System
- **geizhals_trackers**: Preisverfolgun
- **monthly_leaderboards**: Monatliche Stats

## 🎨 Level System

### XP-Vergabe
- **Nachrichten**: 15-25 XP (60s Cooldown)
- **Voice Activity**: 1 XP pro Minute

### Level-Berechnung
```typescript
level = Math.floor(Math.sqrt(xp / 100))
```

### Level Cards
- Automatisch generierte Canvas-Karten
- Avatar, Fortschrittsbalken, Statistiken
- Anpassbare Designs

## 🏪 Geizhals Integration

### Unterstützte Kategorien
- Grafikkarten
- Prozessoren (Intel/AMD)
- Mainboards
- Arbeitsspeicher
- SSDs
- Netzteile
- Gehäuse
- Monitore
- Kühlung

### Funktionen
- Automatische Preisüberwachung (30min Intervall)
- Tägliche Deal-Updates (8:00 Uhr)
- Benutzer-spezifische Tracker (max 10)
- Push-Benachrichtigungen

## 🔧 Konfiguration

### Bot Permissions
```javascript
const intents = [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildMessages,
  GatewayIntentBits.MessageContent,
  GatewayIntentBits.GuildVoiceStates,
  GatewayIntentBits.GuildMembers
];
```

### Erforderliche Bot-Berechtigunen
- Send Messages
- Use Slash Commands
- Manage Roles
- Manage Channels
- View Audit Log
- Moderate Members

## 📊 Dashboard Features

### Übersicht
- Live-Statistiken aller Server
- Feature-Status-Übersicht
- Schnelleinstellungen

### Verwaltung
- Guild-spezifische Einstellungen
- Warn-System Überwachung
- Quarantäne-Verwaltung
- Level-System Konfiguration

## 🚀 Deployment

### Docker (empfohlen)
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

### Railway/Heroku
1. Repository verknüpfen
2. Umgebungsvariablen setzen
3. Build Command: `npm run build`
4. Start Command: `npm start`

## 🔒 Sicherheit

- Rollenhierarchie-Prüfungen
- Permission-basierte Commands
- Eingabevalidierung
- Rate Limiting (Commands)
- Sichere Datenbank-Queries (Prisma)

## 📈 Performance

- Prisma ORM mit Connection Pooling
- Redis Caching (optional)
- Lazy Loading für große Datasets
- Optimierte Canvas-Rendering
- Batch-Processing für Geizhals-Updates

##