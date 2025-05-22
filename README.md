# Hinko Bot 2.0

Ein umfassender Discord Bot mit Moderation, Level-System, Geizhals-Integration, Community Features und Admin Dashboard.

## 🚀 Features

### 🛡️ Moderation
- **Warn System**: Benutzer warnen, editieren, löschen und anzeigen
- **Basic Moderation**: Ban, Kick, Timeout
- **Quarantine System**: Benutzer, Channels und Rollen sperren
- **Automod**: Automatische Moderation mit konfigurierbaren Regeln
- **Rollenhierarchie**: Respektiert Discord-Rollenhierarchien

### 🎮 Community Features
- **Level System**: XP für Messages und Voice-Activity mit Custom Level Cards
- **Leaderboards**: Server und monatliche Ranglisten
- **Level Rewards**: Automatische Rollen bei Level-Ups
- **Polls**: Interaktive Umfragen mit Mehrfachauswahl
- **Giveaways**: Automatische Gewinnspiele mit Anforderungen
- **Ticket System**: Support-Tickets mit Kategorien und Prioritäten
- **Custom Commands**: Benutzerdefinierte Bot-Commands
- **Reaction Roles**: Rollen durch Reaktionen erhalten

### 💰 Geizhals Integration
- **Preisverfolgun**: Hardware-Produkte überwachen
- **Automatische Alerts**: Benachrichtigung bei Zielpreis
- **Kategorie-Deals**: Tägliche Hardware-Deals
- **Produktsuche**: Direktsuche in Geizhals-Datenbank

### 📊 Admin Dashboard
- **Web Interface**: Next.js Dashboard für Verwaltung
- **Statistiken**: Live-Daten aller Server
- **Einstellungen**: Features aktivieren/deaktivieren per Web-UI
- **Überwachung**: Warnungen, Quarantäne, Tickets verwalten
- **Zugriffsschutz**: Nur autorisierte Benutzer haben Zugang

### 🤖 Automod System
- **Spam-Schutz**: Automatische Erkennung von Nachrichten-Spam
- **Content-Filter**: Links, Invites, Schimpfwörter blockieren
- **Caps Lock**: Übermäßige Großschreibung verhindern
- **Emoji/Mention Spam**: Schutz vor Spam
- **Konfigurierbar**: Regeln, Aktionen und Ausnahmen anpassbar

## 🛠️ Installation

### Voraussetzungen
- Node.js 18+
- PostgreSQL (Neon.tech empfohlen)
- Discord Bot Token
- Geizhals API Key (optional)

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

# Geizhals API (optional)
GEIZHALS_USERNAME=dein_username
GEIZHALS_API_KEY=dein_api_key

# Dashboard
NEXTAUTH_SECRET=super-geheimer-schlüssel
NEXTAUTH_URL=http://localhost:3001
ADMIN_USER_ID=797927858420187186

# Development
NODE_ENV=development
```

### 3. Datenbank einrichten
```bash
# Prisma generieren
npm run db:generate

# Datenbank Schema erstellen
npm run db:push

# Seed-Daten laden (optional)
npm run db:seed
```

### 4. Bot starten
```bash
# Development
npm run dev

# Production
npm run build
npm start
```

### 5. Dashboard starten
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
- `/quarantine setup <role>` - Quarantäne-System einrichten
- `/automod setup` - Automod-System einrichten
- `/automod rule <type> <name> <action>` - Neue Automod-Regel

### Level System
- `/level show [user]` - Level anzeigen
- `/level leaderboard [limit]` - Server Leaderboard
- `/level monthly [month] [year]` - Monatliches Leaderboard

### Community Features
- `/poll create <title> <options>` - Umfrage erstellen
- `/poll end <id>` - Umfrage beenden
- `/giveaway create <prize> <duration> <winners>` - Giveaway erstellen
- `/giveaway end <id>` - Giveaway beenden
- `/ticket setup <category> <channel>` - Ticket-System einrichten
- `/ticket close [reason]` - Ticket schließen

### Geizhals
- `/geizhals search <query> [category]` - Produkte suchen
- `/geizhals track <productid> <targetprice>` - Preis verfolgen
- `/geizhals list` - Eigene Tracker anzeigen
- `/geizhals deals [category]` - Aktuelle Deals
- `/geizhals setup <channel>` - System einrichten

## 🏗️ Projektstruktur

```
hinko/
├── src/
│   ├── commands/           # Slash Commands
│   │   ├── moderation/     # Moderation Commands
│   │   ├── leveling/       # Level Commands
│   │   ├── community/      # Poll/Giveaway Commands
│   │   ├── geizhals/       # Geizhals Commands
│   │   └── utility/        # Utility Commands
│   ├── events/             # Discord Events
│   │   ├── levelSystem.ts  # Level Event Handler
│   │   ├── automodHandler.ts # Automod Event Handler
│   │   └── interactionHandler.ts # Button/Modal Handler
│   ├── lib/                # Utilities
│   │   └── database.ts     # Extended Prisma Client
│   ├── services/           # Business Logic
│   │   ├── geizhalsTracker.ts # Geizhals Service
│   │   └── cronJobs.ts     # Scheduled Tasks
│   ├── utils/              # Helper Functions
│   │   └── levelCard.ts    # Canvas Level Cards
│   └── index.ts            # Bot Entry Point (optimiert)
├── dashboard/              # Next.js Admin Dashboard
│   ├── pages/              # Dashboard Pages
│   │   ├── index.tsx       # Main Dashboard
│   │   ├── settings.tsx    # Settings Page
│   │   └── api/            # API Routes
│   ├── components/         # React Components
│   └── styles/             # TailwindCSS Styles
├── prisma/
│   ├── schema.prisma       # Extended Database Schema
│   └── seed.ts             # Seed Data
├── geizhals/               # Geizhals API Client
└── config.ts               # Bot Configuration
```

## 🗄️ Erweiterte Datenbank

### Neue Tabellen
- **polls**: Umfrage-System
- **poll_options**: Umfrage-Optionen
- **poll_votes**: Umfrage-Stimmen
- **giveaways**: Gewinnspiel-System
- **giveaway_entries**: Teilnehmer
- **automod_rules**: Automod-Regeln
- **tickets**: Support-Ticket-System
- **custom_commands**: Benutzerdefinierte Commands
- **reaction_roles**: Reaktions-Rollen

### Erweiterte Features
- **Monthly Leaderboards**: Monatliche Statistiken
- **Advanced Analytics**: Detaillierte Server-Statistiken
- **Flexible Permissions**: Granulare Berechtigungen

## 🎨 Level System 2.0

### XP-Vergabe
- **Nachrichten**: 15-25 XP (60s Cooldown)
- **Voice Activity**: 1 XP pro Minute
- **Event Participation**: Bonus XP für Umfragen/Giveaways

### Erweiterte Features
- **Custom Level Cards**: Automatisch generierte Canvas-Karten
- **Seasonal Events**: Temporäre XP-Boosts
- **Role Rewards**: Automatische Rollen bei Level-Ups
- **Monthly Competitions**: Monatliche Leaderboards

## 🏪 Erweiterte Geizhals Integration

### Neue Features
- **Kategorie-spezifische Deals**: Tägliche Updates
- **Batch-Processing**: Optimierte API-Nutzung
- **Advanced Filtering**: Preisvergleiche und Trends
- **Notification System**: Erweiterte Benachrichtigungen

## 📊 Admin Dashboard 2.0

### Features
- **Real-time Statistics**: Live-Updates
- **Feature Management**: Toggle Features per Web-UI
- **User Management**: Moderation über Dashboard
- **Analytics**: Detaillierte Insights
- **Responsive Design**: TailwindCSS + React

### Zugriffsschutz
- Nur User mit ID `797927858420187186` haben Zugang
- Zusätzliche Rollenberechtigung auf Server `554266392262737930`
- Session-basierte Authentifizierung

## 🤖 Automod System

### Regeltypen
- **SPAM**: Nachrichten-Spam Erkennung
- **CAPS**: Großschreibung-Filter
- **MENTIONS**: Mention-Spam Schutz
- **LINKS**: Link-Filter
- **INVITES**: Discord-Invite Schutz
- **PROFANITY**: Schimpfwort-Filter
- **REPEATED_TEXT**: Wiederholter Text
- **ZALGO**: Unleserlicher Text
- **EMOJI_SPAM**: Emoji-Spam

### Aktionen
- **DELETE**: Nachricht löschen
- **WARN**: Warnung erteilen
- **TIMEOUT**: Temporärer Ausschluss
- **KICK**: Vom Server entfernen
- **BAN**: Permanent bannen

## 🎫 Ticket System

### Features
- **Kategorie-basiert**: Support, Bug Reports, Vorschläge
- **Prioritäten**: Low, Medium, High, Urgent
- **Auto-Assignment**: Automatische Moderator-Zuweisung
- **Templates**: Vordefinierte Ticket-Formulare
- **History**: Ticket-Verlauf und Statistiken

## 🔧 Performance Optimierungen

### Bot Performance
- **Optimierte Intents**: Nur notwendige Events
- **Cache Management**: Intelligentes Caching
- **Memory Optimization**: Garbage Collection
- **Connection Pooling**: Datenbankoptimierung

### Dashboard Performance
- **Server-Side Rendering**: Next.js SSR
- **API Optimization**: Efficient Endpoints
- **Caching Strategy**: Redis-Integration möglich
- **Responsive Loading**: Progressive Enhancement

## 🚀 Deployment

### Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
RUN npm run build:dashboard
EXPOSE 3000 3001
CMD ["npm", "start"]
```

### Railway/Heroku
1. Repository verknüpfen
2. Umgebungsvariablen setzen
3. Build Commands:
   - `npm run build`
   - `npm run build:dashboard`
4. Start Command: `npm start`

### Production Checklist
- [ ] Umgebungsvariablen gesetzt
- [ ] Datenbank migriert
- [ ] Redis konfiguriert (optional)
- [ ] SSL-Zertifikate
- [ ] Monitoring eingerichtet
- [ ] Backup-Strategie

## 🔒 Sicherheit

### Bot Security
- **Permission Checks**: Rollenhierarchie-Validierung
- **Input Validation**: Sichere Eingabeprüfung
- **Rate Limiting**: Command-Cooldowns
- **Audit Logging**: Vollständige Protokollierung

### Dashboard Security
- **Authentication**: Discord OAuth + Custom Auth
- **Authorization**: Rollenbasierte Zugriffskontrolle
- **CSRF Protection**: Token-basierte Sicherheit
- **Input Sanitization**: XSS-Schutz

## 📈 Monitoring & Analytics

### Metriken
- **Performance**: Latenz, Memory Usage
- **Usage**: Command-Statistiken
- **Errors**: Fehler-Tracking
- **Business**: Feature-Adoption

### Tools
- **Custom Dashboard**: Eigene Analytics
- **Error Tracking**: Sentry-Integration möglich
- **Performance Monitoring**: APM-Tools
- **Log Aggregation**: Strukturierte Logs

## 🤝 Beitragen

### Development Setup
```bash
# Entwicklungsumgebung
npm run dev

# Tests ausführen
npm test

# Linting
npm run lint:fix

# Dashboard Development
npm run dashboard
```

### Code Standards
- **TypeScript**: Strenge Typisierung
- **ESLint**: Code-Qualität
- **Prettier**: Code-Formatierung
- **Husky**: Pre-commit Hooks

## 📄 Lizenz

MIT License - siehe LICENSE Datei für Details.

## 🙏 Credits

- **Discord.js**: Discord API Library
- **Prisma**: Database ORM
- **Next.js**: React Framework
- **TailwindCSS**: Utility-First CSS
- **Geizhals**: Preisvergleich API

---

**Hinko Bot 2.0** - Ein umfassender Discord Bot für moderne Communities.