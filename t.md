Here is your prompt for Claude to generate a shell script that fully automates the setup process:

You are to create a POSIX-compliant shell script (setup-pegasus.sh) that does the following, compatible with Debian 12, Ubuntu 22.04, and 24.04.

✅ Script Requirements

🔁 1. Repository Initialization

Clone this repository: https://github.com/cptcr/pegasus

Navigate into the pegasus directory

Install Node.js 18+, npm, and PostgreSQL 12+

Install Docker and Docker Compose

Install NGINX and Certbot

⚙️ 2. .env Configuration via CLI Prompt

Prompt the user to enter:

DISCORD_BOT_TOKEN

DISCORD_CLIENT_ID

DISCORD_CLIENT_SECRET

DATABASE_URL (PostgreSQL URI)

ADMIN_USER_ID

TARGET_GUILD_ID

NEXTAUTH_SECRET (generate random fallback)

Generate .env file in project root from those values

🌐 3. NGINX Configuration for Dashboard

Ask for a domain name (e.g., bot.example.com)

Set up NGINX to serve the Next.js dashboard on port 3001 under this domain

Redirect HTTP to HTTPS

Create a /etc/nginx/sites-available/pegasus-dashboard config and symlink it

🔒 4. Let's Encrypt SSL

Use certbot to get an SSL certificate for the domain

Set up a cron job for automatic renewal

Include --nginx plugin usage

Schedule via crontab with certbot renew --quiet

🚀 5. Service Initialization

Run npm install in both root and dashboard/ folders

Run Prisma migrations: npx prisma db push

Build and launch both the bot and the dashboard:

npm run build && npm start for bot

cd dashboard && npm run build && npm run start:dashboard

🧠 6. OS Detection

Auto-detect Debian or Ubuntu version and adjust apt commands if needed

Ensure all required packages (curl, jq, nodejs, npm, postgresql, nginx, certbot, etc.) are installed

📝 Additional Requirements

The script must:

Work non-interactively if variables are passed via environment variables

Be idempotent (can run multiple times safely)

Provide status outputs and error handling

Include optional logging to setup.log

Not overwrite an existing .env unless explicitly confirmed

Generate a complete, working setup-pegasus.sh file with all these features, using best practices for security, portability, and maintainability.





### 🛒 Geizhals System

#### Dashboard:

1. Set tracking channel for auto-deals (CPU, GPU, RAM, etc.)
2. Add/delete personal trackers (limit 3 per user)

#### Discord:

1. `/gh search`, `/gh deals`, `/gh tracker add/remove`

#### Backend:

* `geizhals_products` auto-tracked per guild
* `CustomTracker` stores user-defined trackers
* Periodic fetch + price diff detection
* Send price drop DMs

---

### 🎙️ Join to Create System

#### Dashboard:

1. Set JTC channel
2. Configure name format, max users, auto-delete timeout
3. View temp VC activity

#### Discord:

1. `/vc rename`, `/limit`, `/lock`, `/permit`, `/kick`
2. Admin: `/jtc setchannel`, `/list`

#### Backend:

* Temp VC ownership tracked
* Command-based permission control (no manual role edits)
* Delete VC after inactivity

---

## 🧩 Prisma Schema Additions

```prisma
model PollVote {
  id        Int      @id @default(autoincrement())
  poll      Poll     @relation(fields: [pollId], references: [id])
  pollId    Int
  user      User     @relation(fields: [userId], references: [id])
  userId    String
  option    String
  votedAt   DateTime @default(now())
}

model GiveawayParticipant {
  id          Int       @id @default(autoincrement())
  giveaway    Giveaway  @relation(fields: [giveawayId], references: [id])
  giveawayId  Int
  user        User      @relation(fields: [userId], references: [id])
  userId      String
  enteredAt   DateTime  @default(now())
}

model TicketMessage {
  id        Int      @id @default(autoincrement())
  ticket    Ticket   @relation(fields: [ticketId], references: [id])
  ticketId  Int
  authorId  String
  content   String
  createdAt DateTime @default(now())
}

model CustomTracker {
  id         Int      @id @default(autoincrement())
  user       User     @relation(fields: [userId], references: [id])
  userId     String
  productUrl String
  productId  String
  lastPrice  Float
  threshold  Float?
  createdAt  DateTime @default(now())
}

model TempChannelPermission {
  id            Int      @id @default(autoincrement())
  tempChannel   TempVoiceChannel @relation(fields: [tempChannelId], references: [id])
  tempChannelId Int
  userId        String
  permission    String
}
```

Enhance existing `Poll`, `Giveaway`, `QuarantineEntry` as:

```prisma
model Poll {
  id         Int      @id @default(autoincrement())
  guildId    String
  question   String
  options    Json
  messageId  String?
  channelId  String?
  status     String
  creatorId  String
  createdAt  DateTime  @default(now())
  endsAt     DateTime?
  votes      PollVote[]
}

model Giveaway {
  id           Int       @id @default(autoincrement())
  guildId      String
  title        String
  prize        String
  messageId    String?
  channelId    String?
  winnerCount  Int
  endsAt       DateTime
  roleRequired String?
  createdBy    String
  createdAt    DateTime  @default(now())
  participants GiveawayParticipant[]
}

model QuarantineEntry {
  id           Int      @id @default(autoincrement())
  guild        Guild    @relation(fields: [guildId], references: [id])
  guildId      String
  user         User     @relation(fields: [userId], references: [id])
  userId       String
  reason       String
  moderatorId  String
  createdAt    DateTime @default(now())
  expiresAt    DateTime?
  isActive     Boolean  @default(true)
}
```

---

Ensure all modules are implemented with command syncing, permissions, auditing, and dashboard interfaces. All logic must be secure, scalable, and conform to the Pegasus v2.0.0 architecture.