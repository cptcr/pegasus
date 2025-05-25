# Pegasus Discord Bot v2.0.0

Ein umfassender Discord-Bot mit Levelsystem, Moderationswerkzeugen, Web-Dashboard und erweiterten Funktionen.

## 🚀 Funktionen

* **Levelsystem**: XP-Verfolgung für Nachrichten und Sprachaktivität
* **Moderationswerkzeuge**: Verwarnungen, Quarantäne, Automod
* **Web-Dashboard**: Echtzeit-Verwaltungsoberfläche
* **Geizhals-Integration**: Preisverfolgung für Hardware
* **Umfragesystem**: Interaktive Community-Abstimmungen
* **Geschenksystem**: Automatisierte Wettbewerbe
* **Ticketsystem**: Verwaltung von Support-Tickets
* **Benutzerdefinierte Befehle**: Gildenspezifische Befehle
* **Join-to-Create**: Temporäre Sprachkanäle
* **Echtzeit-Updates**: WebSocket-gestütztes Dashboard

## 📋 Voraussetzungen

* Node.js 18+
* PostgreSQL 12+
* Discord-Anwendung mit Bot-Token
* (Optional) Redis für Caching
* (Optional) Geizhals API-Zugang

## 🛠️ Installation

### Schnellstart mit Docker

1.  **Repository klonen**
    ```bash
    git clone [https://github.com/cptcr/pegasus](https://github.com/cptcr/pegasus)
    cd pegasus
    ```
2.  **Umgebung konfigurieren**
    ```bash
    cp .env.example .env
    # .env mit Ihrer Konfiguration bearbeiten
    ```
3.  **Mit Docker Compose starten**
    ```bash
    docker-compose up -d
    ```

### Manuelle Installation

1.  **Klonen und Abhängigkeiten installieren**
    ```bash
    git clone [https://github.com/cptcr/pegasus](https://github.com/cptcr/pegasus)
    cd hinko-discord-bot
    npm install
    cd dashboard && npm install && cd ..
    ```
2.  **Datenbank einrichten**
    ```bash
    # PostgreSQL-Datenbank erstellen
    createdb hinko_bot
    
    # Migrationen ausführen
    npm run db:push
    ```
3.  **Umgebung konfigurieren**
    ```bash
    cp .env.example .env
    # .env mit Ihrem Discord-Bot-Token und Ihrer Datenbank-URL bearbeiten
    ```
4.  **Bauen und starten**
    ```bash
    npm run build
    npm start
    ```

## 🔧 Konfiguration

### Erforderliche Umgebungsvariablen

```env
# Discord Bot
DISCORD_BOT_TOKEN="dein_bot_token"
DISCORD_CLIENT_ID="deine_client_id"
DISCORD_CLIENT_SECRET="dein_client_secret"

# Datenbank
DATABASE_URL="postgresql://benutzer:passwort@localhost:5432/hinko_bot"

# Dashboard-Sicherheit
ADMIN_USER_ID="deine_discord_benutzer_id"
TARGET_GUILD_ID="deine_discord_gilden_id"
NEXTAUTH_SECRET="zufaelliger_geheimer_schluessel"
````

### Discord-Anwendung einrichten

1.  Gehen Sie zum [Discord Developer Portal](https://discord.com/developers/applications)
2.  Erstellen Sie eine neue Anwendung
3.  Gehen Sie zum Abschnitt "Bot" und erstellen Sie einen Bot
4.  Kopieren Sie das Bot-Token in `DISCORD_BOT_TOKEN`
5.  Gehen Sie zum Abschnitt "OAuth2" und kopieren Sie Client-ID und Secret
6.  Fügen Sie eine Weiterleitungs-URI hinzu: `http://localhost:3001/api/auth/callback/discord`

### Bot-Berechtigungen

Der Bot benötigt die folgenden Berechtigungen:

  * Nachrichten verwalten
  * Rollen verwalten
  * Kanäle verwalten
  * Kanäle anzeigen
  * Nachrichten senden
  * Links einbetten
  * Dateien anhängen
  * Nachrichtenverlauf lesen
  * Externe Emojis verwenden
  * Reaktionen hinzufügen
  * Verbinden (Sprache)
  * Mitglieder verschieben (Sprache)

**Berechtigungs-Integer**: `8589934592`

## 🚀 Deployment

### Produktions-Deployment

1.  **Mit Docker (Empfohlen)**
    ```bash
    # Produktions-Image erstellen
    docker build -t hinko-bot .

    # Mit docker-compose ausführen
    docker-compose -f docker-compose.prod.yml up -d
    ```
2.  **Manuelles Deployment**
    ```bash
    # Produktionsumgebung setzen
    export NODE_ENV=production

    # Anwendung bauen
    npm run build
    cd dashboard && npm run build && cd ..

    # Mit PM2 starten
    pm2 start ecosystem.config.js
    ```

### Umgebungsspezifische Konfigurationen

**Entwicklung**

```bash
npm run dev:concurrent  # Startet Bot und Dashboard
```

**Produktion**

```bash
npm start  # Startet nur den Bot
npm run start:dashboard  # Startet nur das Dashboard
```

## 📊 Dashboard-Funktionen

Greifen Sie auf das Web-Dashboard unter `http://localhost:3001` zu

  * **Echtzeit-Statistiken**: Live-Gildenmetriken
  * **Benutzerverwaltung**: Übersicht über das Levelsystem
  * **Moderationswerkzeuge**: Verwaltung von Verwarnungen und Quarantäne
  * **Systemeinstellungen**: Funktionsschalter und Konfiguration
  * **Aktivitätsüberwachung**: Aktuelle Ereignisse und Analysen

### Dashboard-Authentifizierung

Nur Benutzer mit der angegebenen Rolle in der Zielgilde können auf das Dashboard zugreifen. Konfigurieren Sie dies in Ihrer `.env`:

```env
ADMIN_USER_ID="deine_discord_benutzer_id"
TARGET_GUILD_ID="deine_discord_gilden_id"
```

## 🎮 Bot-Befehle

### Nützlichkeitsbefehle

  * `/ping` - Bot-Latenz und Status
  * `/hilfe` - Hilfesystem für Befehle
  * `/serverinfo` - Serverinformationen

### Level-Befehle

  * `/level [benutzer]` - Benutzerlevel anzeigen
  * `/rangliste` - Server-Rangliste
  * `/rang [benutzer]` - Benutzerrang

### Moderationsbefehle

  * `/verwarnen <benutzer> <grund>` - Verwarnung aussprechen
  * `/verwarnungen [benutzer]` - Verwarnungen anzeigen
  * `/verwarnungenloeschen <benutzer>` - Verwarnungen löschen
  * `/quarantaene <benutzer> <grund>` - Benutzer in Quarantäne versetzen

### Community-Befehle

  * `/umfrage erstellen` - Umfrage erstellen
  * `/geschenk erstellen` - Geschenk erstellen
  * `/ticket erstellen` - Support-Ticket erstellen

### Geizhals-Befehle (falls aktiviert)

  * `/geizhals suche <produkt>` - Produkte suchen
  * `/geizhals verfolgen <produkt> <preis>` - Preis verfolgen
  * `/geizhals deals [kategorie]` - Angebote anzeigen

## 🔧 API-Endpunkte

### Zustandsprüfung

```
GET /health
```

### Dashboard-API

```
GET /api/dashboard/guild/{guildId}
GET /api/dashboard/stats/{guildId}
GET /api/dashboard/activity/{guildId}
POST /api/dashboard/settings/{guildId}
```

## 🏗️ Architektur

### Projektstruktur

```
hinko-discord-bot/
├── src/
│   ├── commands/           # Slash-Befehle
│   ├── events/            # Discord-Event-Handler
│   ├── lib/               # Kernbibliotheken
│   ├── services/          # Hintergrunddienste
│   └── utils/             # Hilfsfunktionen
├── dashboard/             # Next.js Web-Dashboard
│   ├── pages/             # Dashboard-Seiten
│   ├── components/        # React-Komponenten
│   ├── lib/               # Dashboard-Hilfsprogramme
│   └── styles/            # CSS-Stile
├── prisma/                # Datenbankschema und Migrationen
├── geizhals/              # Geizhals API-Integration
└── docker/                # Docker-Konfiguration
```

### Technologie-Stack

**Backend**

  * Node.js + TypeScript
  * Discord.js v14
  * Prisma ORM
  * PostgreSQL
  * Socket.IO

**Frontend**

  * Next.js 14
  * React 18
  * TailwindCSS
  * NextAuth.js

**Infrastruktur**

  * Docker & Docker Compose
  * Nginx (Reverse Proxy)
  * Redis (Caching)
  * PM2 (Prozessmanagement)

## 🔍 Überwachung & Protokollierung

### Zustandsprüfungen

Der Bot enthält umfassende Zustandsüberwachung:

```bash
# Bot-Zustand prüfen
curl http://localhost:3000/health

# Dashboard-Zustand prüfen
curl http://localhost:3001/api/health
```

### Protokollierung

Protokolle sind strukturiert und enthalten:

  * Discord-Ereignisse
  * Datenbankoperationen
  * API-Anfragen
  * Fehlerverfolgung
  * Leistungsmetriken

### Leistungsüberwachung

  * Speichernutzungsverfolgung
  * Datenbankverbindungsüberwachung
  * Echtzeit-Benutzeraktivität
  * Befehlsnutzungsanalysen

## 🛡️ Sicherheitsfunktionen

### Authentifizierung

  * Discord OAuth2-Integration
  * Rollenbasierte Zugriffskontrolle
  * Sitzungsverwaltung
  * CSRF-Schutz

### Datenschutz

  * Verschlüsselung von Umgebungsvariablen
  * Sicherheit der Datenbankverbindung
  * Eingabevalidierung und -bereinigung
  * Ratenbegrenzung

### Zugriffskontrolle

  * Gildenspezifische Berechtigungen
  * Admin-exklusiver Dashboard-Zugriff
  * Befehlsberechtigungsprüfungen
  * Audit-Protokollierung

## 🔧 Entwicklung

### Entwicklungseinrichtung

```bash
# Abhängigkeiten installieren
npm install
cd dashboard && npm install && cd ..

# Datenbank einrichten
npm run db:generate
npm run db:push

# Entwicklungsserver starten
npm run dev:concurrent
```

### Datenbankverwaltung

```bash
# Prisma-Client generieren
npm run db:generate

# Schemaänderungen pushen
npm run db:push

# Migration erstellen
npm run db:migrate

# Datenbank zurücksetzen
npm run db:reset

# Datenbank mit Seed-Daten füllen
npm run db:seed
```

### Code-Qualität

```bash
# Code linten
npm run lint

# Linting-Probleme beheben
npm run lint:fix

# Typüberprüfung
npm run type-check

# Tests ausführen
npm test
```

## 📝 Mitwirken

1.  Forken Sie das Repository
2.  Erstellen Sie einen Feature-Branch
3.  Machen Sie Ihre Änderungen
4.  Fügen Sie gegebenenfalls Tests hinzu
5.  Stellen Sie sicher, dass die Code-Qualitätsprüfungen bestehen
6.  Senden Sie einen Pull-Request

### Entwicklungsrichtlinien

  * Verwenden Sie TypeScript für Typsicherheit
  * Folgen Sie der ESLint-Konfiguration
  * Schreiben Sie aussagekräftige Commit-Nachrichten
  * Dokumentieren Sie neue Funktionen
  * Testen Sie Ihre Änderungen gründlich

## 🚨 Fehlerbehebung

### Häufige Probleme

**Bot reagiert nicht auf Befehle**

  * Überprüfen Sie, ob das Bot-Token korrekt ist
  * Stellen Sie sicher, dass der Bot die erforderlichen Berechtigungen hat
  * Stellen Sie sicher, dass der Bot in der Zielgilde ist
  * Überprüfen Sie die Datenbankverbindung

**Dashboard lädt nicht**

  * Überprüfen Sie die NextAuth-Konfiguration
  * Überprüfen Sie die Discord OAuth2-Einstellungen
  * Stellen Sie sicher, dass der Benutzer die erforderliche Rolle hat
  * Überprüfen Sie die Konsole auf Fehler

**Datenbankverbindungsprobleme**

  * Überprüfen Sie das `DATABASE_URL`-Format
  * Überprüfen Sie, ob PostgreSQL läuft
  * Stellen Sie sicher, dass die Datenbank existiert
  * Überprüfen Sie die Firewall-Einstellungen

**Berechtigungsfehler**

  * Überprüfen Sie die Bot-Berechtigungen in Discord
  * Überprüfen Sie die Rollenhierarchie
  * Stellen Sie sicher, dass die Bot-Rolle über den Zielrollen liegt
  * Überprüfen Sie die Kanalberechtigungen

### Debug-Modus

Debug-Protokollierung aktivieren:

```env
DEBUG=true
LOG_LEVEL=debug
```
## 📄 Lizenz

Dieses Projekt ist unter der Apache-2.0-Lizenz lizenziert - siehe die [LICENSE](https://github.com/cptcr/pegasus?tab=Apache-2.0-1-ov-file)-Datei für Details.

## 🙏 Thanks
  * Discord.js | https://discord.js.org/
  * Prisma  | https://www.prisma.io/
  * Next.js/Vercel | https://nextjs.org/
  * Neon Inc. | https://neon.tech/

## 🔄 Changelog

### v2.0.0 (Aktuell)
  * Vollständige Neufassung in TypeScript
  * Web-Dashboard mit Echtzeit-Updates
  * Verbessertes Levelsystem
  * Verbesserte Moderationswerkzeuge
  * Docker-Unterstützung
  * Leistungsoptimierungen

## 🚀 Roadmap

### Zukünftige Funktionen

  * [ ] Erweitertes Analyse-Dashboard
  * [ ] Mehrsprachige Unterstützung
  * [ ] Plugin-System
  * [ ] Erweiterte Automod-Regeln
  * [ ] Musikbot-Integration
  * [ ] Benutzerdefinierte Themes für das Dashboard

### Leistungsverbesserungen
  * [ ] Optimierung von Datenbankabfragen
  * [ ] Verbesserung der Caching-Strategie
  * [ ] Unterstützung für Lastverteilung

-----

**Mit ❤️ von CPTCR**