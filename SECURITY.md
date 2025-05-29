# Security Policy for Pegasus Discord Bot

This document outlines the security procedures and policies for the Pegasus Discord Bot project. Our goal is to maintain a secure and trustworthy application for all users.

### 1. Supported Versions

We are committed to providing security updates for the latest stable release of Pegasus. Users are encouraged to keep their instances up-to-date to benefit from the latest security patches and features.

| Version | Supported          |
| ------- | ------------------ |
| NodeJS 18+   | :white_check_mark: |
| Discord.js v14   | :white_check_mark: |
| Discord.js v15   | :x: |
| Postgres 16   | :white_check_mark: |
| Prisma   | :white_check_mark: |
| Next.js v14   | :white_check_mark: |
| Next.js v15   | :x: |
### 2. Reporting a Vulnerability

We take all security vulnerabilities seriously. If you discover a security vulnerability, please report it to us privately.

**How to Report:**

* **Email:** Please send an email to `cptcr@proton.me` (this is a placeholder; you should replace this with a real, monitored email address).
* **Subject Line:** Please use a subject line like: `SECURITY VULNERABILITY REPORT - Pegasus Bot - [Brief Description]`
* **Details:** In your report, please include:
    * A detailed description of the vulnerability, including the potential impact.
    * Steps to reproduce the vulnerability.
    * Any relevant files, screenshots, or PoC code.
    * The version of Pegasus affected (if known).
    * Your contact information for follow-up.

**Our Commitment:**

* We will acknowledge receipt of your vulnerability report within 48 hours.
* We will investigate the report promptly and work to validate the vulnerability.
* We will keep you informed of our progress.
* We will publicly credit you for your discovery (unless you prefer to remain anonymous) once the vulnerability is fixed and a patch is released.
* We aim to address critical vulnerabilities as quickly as possible.

**Please do not report security vulnerabilities through public GitHub issues, Discord, or other public channels.**

### 3. Security Best Practices & Considerations

The Pegasus project incorporates several security considerations:

**3.1. Authentication & Authorization:**

* **Dashboard Access:** The web dashboard utilizes NextAuth.js for authentication, primarily through Discord OAuth2.
* **Access Control:** Dashboard access is restricted based on Discord Guild ID and Role ID, configured via environment variables (`TARGET_GUILD_ID`, `REQUIRED_ROLE_ID`). Session validation checks for `hasRequiredAccess` flags.
* **Bot Token:** The Discord Bot Token (`DISCORD_BOT_TOKEN`) is a critical credential and must be kept secret.
* **API Authentication:** API routes are protected using the `requireAuth` middleware, which validates user sessions and permissions.

**3.2. Data Handling & Storage:**

* **Database:** Pegasus uses a PostgreSQL database. The connection string (`DATABASE_URL`) is a sensitive credential.
* **Sensitive Data:** Configuration files (e.g., `src/config/Config.ts`) and environment variables store sensitive information like API keys and tokens. These must be protected.
* **User Data:** The bot handles user data from Discord, including user IDs, usernames, roles, messages, etc. This data is stored in the PostgreSQL database.
* **Secrets Management:** `NEXTAUTH_SECRET` is used for session encryption.
* **Message Content Intent:** The bot requires the Message Content Intent, meaning it can access message content. This access should be handled responsibly and only used for intended features.

**3.3. Dependencies & Vulnerability Management:**

* **Dependency Updates:** Regular updates to dependencies (listed in `package.json` files) are crucial to patch known vulnerabilities. Tools like `npm audit` should be used.
* **Prisma:** The project uses Prisma as its ORM. Keep Prisma client and CLI updated.

**3.4. Code Practices:**

* **Linting:** ESLint is used for code quality and consistency, which can help catch potential security issues.
* **Input Validation:** All user-provided input, especially in API endpoints and bot commands, should be strictly validated to prevent injection attacks and other vulnerabilities. Zod schemas are used for some API validation.
* **Error Handling:** Robust error handling is implemented in API endpoints and command execution to prevent information leakage and ensure stability.

**3.5. Deployment & Infrastructure:**

* **Environment Variables:** Critical configuration, including API keys and secrets, is managed through environment variables. These should be securely managed in deployment environments.
* **Docker:** The `docker-compose.yml` file defines the services and their configurations, including environment variables for sensitive data. Ensure Docker images are kept up-to-date.
* **HTTPS:** For production deployments, ensure the dashboard (`NEXTAUTH_URL`) is served over HTTPS. The `deploy.sh` script includes Nginx and Cloudflare Tunnel setup, which can facilitate this.
* **WebSockets:** The bot and dashboard communicate via WebSockets. Secure WebSocket connections (WSS) should be used in production. The WebSocket server allows CORS from `DASHBOARD_URL` or `http://localhost:3001`.

**3.6. Bot Permissions:**

* The bot requests specific Discord Intents (e.g., `Guilds`, `GuildMembers`, `GuildMessages`, `MessageContent`). These should be reviewed to ensure they are necessary for the bot's functionality and adhere to the principle of least privilege.
* Commands have permission flags set (e.g., `PermissionFlagsBits.ManageEvents`, `PermissionFlagsBits.BanMembers`).

**3.7. Specific Feature Security:**

* **Giveaways/Polls/Tickets:** These systems involve user interactions and data storage. Ensure proper authorization checks for managing these features (e.g., only admins or creators can end/modify them).
* **Moderation Commands (ban, kick, clear, timeout, quarantine):** These commands have significant impact. They are protected by `DefaultMemberPermissions` and should have robust logging. Hierarchy checks are implemented to prevent lower-ranked moderators from actioning higher-ranked ones.
* **Join-to-Create:** Ensure proper permission handling for temporary voice channels created by this feature.

### 4. Security Audits

While no formal external audits are currently scheduled, we encourage the community to review the codebase and report any potential issues according to the "Reporting a Vulnerability" section. Internal code reviews will be conducted periodically.

### 5. Data Privacy

* User data collected by Pegasus is primarily sourced from Discord and is used to provide the bot's features (e.g., leveling, moderation logs, user-specific commands).
* Refer to Discord's Privacy Policy for information on how Discord handles your data.
* Pegasus aims to store only necessary data for its functionality. Specific data retention policies are not yet formalized but will be considered for future development.

### 6. Incident Response

In the event of a security incident:

1.  **Containment:** The immediate priority will be to contain the incident and prevent further impact. This may involve temporarily disabling affected features or the entire service.
2.  **Assessment:** We will assess the scope and severity of the incident.
3.  **Eradication & Recovery:** Vulnerabilities will be patched, and systems restored to a secure state.
4.  **Post-Incident Analysis:** A review will be conducted to understand the cause and improve security measures.
5.  **Notification:** If user data is compromised or a significant service disruption occurs, users will be notified through appropriate channels (e.g., Discord server announcements, project README).

### 7. Future Security Enhancements

* Implementation of a more formal data retention policy.
* Regular automated dependency vulnerability scanning.
* Consideration of Content Security Policy (CSP) for the web dashboard.
* Enhanced rate limiting and input sanitization across all API endpoints and bot commands.

This Security Policy is a living document and may be updated as the project evolves. We appreciate the community's help in keeping Pegasus secure.
