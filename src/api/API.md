# Pegasus API Reference

This document describes every HTTP endpoint exposed by the Pegasus bot’s built‑in API server.  
The API is intended for use by the companion dashboard and trusted automation tooling running
outside of the bot process.

---

## Base URL & Version

```
http(s)://<host>:<port>
```

* The port defaults to `config.API_PORT` (2000 by default).
* All endpoints respond with JSON. Set `Accept: application/json`.
* There is no versioned prefix at the moment; paths are rooted at `/`.

---

## Authentication

| Requirement | Details |
|-------------|---------|
| Scheme      | Bearer token |
| Header      | `Authorization: Bearer <config.BOT_API_TOKEN>` |
| Notes       | The token is compared verbatim; expired/rotated tokens must be updated everywhere. |

**Exceptions:** `GET /health` is public and does **not** require authentication.

If the header is missing or invalid, the API returns `401 Unauthorized` with:

```json
{
  "error": "Unauthorized",
  "message": "Missing or invalid Authorization header"
}
```

---

## Rate Limits & Caching

| Limit scope                  | Policy                                                |
|-----------------------------|--------------------------------------------------------|
| Global IP limit             | 200 requests per minute per IP (`ipRateLimiter`)       |
| Stats endpoints             | 2 requests / 500 ms (`RateLimitPresets.stats`)         |
| Batch guild endpoint        | 5 requests per second                                  |
| Per-guild write endpoints   | 10 requests per second per guild (`guildRateLimiter`)  |

When rate limits are exceeded the API returns `429 Too Many Requests`.

Several read endpoints are cached by `cacheMiddleware`. Responses include:

* `X-Cache: HIT | MISS`
* `X-Cache-TTL: <milliseconds>`

Cache TTLs (see `CacheTTL` enum):

| Cache key            | TTL (ms) |
|----------------------|----------|
| `stats` + dashboard  | 5 000    |
| Guild summaries      | 10 000   |
| Member lists         | 7 500    |

Cache invalidation is automatically triggered for write routes via `invalidateCache`.

---

## Error Format

Unless stated otherwise, error responses follow the shape:

```json
{
  "error": "<Short slug>",
  "message": "<Human-readable description>",
  "details": [ ... ] // optional, usually validation issues
}
```

Common status codes:

* `200 OK` – successful read or idempotent write.
* `201 Created` – resource created (POST routes).
* `204 No Content` – not currently used.
* `400 Bad Request` – missing/invalid payload (includes Zod validation errors).
* `401 Unauthorized` – missing/invalid bearer token.
* `403 Forbidden` – bot lacks required Discord permissions.
* `404 Not Found` – unknown guild/resource.
* `409 Conflict` – duplicate resource (e.g., XP reward already exists).
* `429 Too Many Requests` – rate limit exceeded.
* `500 Internal Server Error` – unexpected exception.

---

## Endpoint Reference

### 1. Health & Diagnostics

#### GET `/health` _(public)_

Returns basic liveness information, cache stats, and aggregator age.

Response snippet:

```json
{
  "status": "ok",
  "timestamp": "2024-05-04T17:21:09.123Z",
  "cache": { "size": 12, "hits": 85, ... },
  "aggregator": { "running": true, "age": 215 }
}
```

#### GET `/cache/stats`
Requires auth. Returns the same cache statistics as `/monitoring/cache`.

---

### 2. Status API (`/status`)

#### GET `/status`

Comprehensive runtime snapshot including:

* `bot` – username, ID, status, uptime, guild/user counts, WS ping, memory usage.
* `system`/`cpu`/`memory`/`gpu`/`disk`/`network` – host diagnostics.
* `services` – Discord shards, database latency, availability of Steam/Weather/News APIs.
* `timestamp`.

No request parameters. Useful for infrastructure dashboards or ping alerts.

---

### 3. Stats API (`/stats`)

#### GET `/stats`

Returns cached aggregates from `statsAggregator` (auto-refreshes every ~5 s):

* `status`, `uptime`, `guilds`, `users`, `commands` (incl. `per_minute`, `topCommands`), `system`.
* `features.activity` per module.
* `version` (static `3.2.1`), `cache_age`.

Rate-limited to match the dashboard refresh cadence (2 req / 500 ms).

---

### 4. Dashboard API (`/dashboard`)

All routes require auth and are cached (`CacheTTL.STATS`).

#### GET `/dashboard/overview`

Aggregates bot-wide KPIs plus recent activity feeds.

Response highlights:

* `bot`, `guilds` (totals + top guilds by member count), `users`, `commands`, `system`.
* `totals` – tickets, moderation case counts, configured guilds.
* `recentActivity` – latest tickets/moderation events/economy transactions.
* `cacheAge`, `generatedAt`.

#### GET `/dashboard/guilds`

Query parameters:

| Param   | Type   | Default | Notes                             |
|---------|--------|---------|-----------------------------------|
| `limit` | int    | 25      | Max 100 per page.                 |
| `offset`| int    | 0       | Pagination offset.                |
| `search`| string | —       | Case-insensitive matches on name or ID. |

Returns paginated guild summaries with online counts, role/channel stats, booster info, and whether settings are configured.

#### GET `/dashboard/guilds/:guildId/overview`

Combines live Discord data and database snapshots for a single guild.

Sections:

* `guild` – name, icon, member & booster counts, shard, owner, createdAt.
* `settings` – prefix, language, feature toggles.
* `metrics` – moderation, tickets (incl. average resolution time & panel count), economy, XP, engagement.
* `recentActivity` – most recent moderation cases, tickets, economy transactions.
* `modules` – booleans and key statistics per feature group.

Returns 404 if the bot is not in the guild.

---

### 5. Batch API (`/batch`)

#### POST `/batch/guilds`

Bulk-fetch guild summaries to minimise dashboard round-trips.

Request body:

```json
{
  "guildIds": ["123", "456"],
  "fields": ["basic", "features", "settings", "stats"]
}
```

* `guildIds` – **required** array (max 50).
* `fields` – optional subset of `["basic","features","settings","stats"]`.

Response:

```json
{
  "guilds": [
    {
      "id": "123",
      "name": "Example",
      "memberCount": 420,
      "onlineCount": 87,
      "features": { ... },
      "settings": { "prefix": "!", "language": "en" },
      "stats": { "totalMembers": 420, "activeMembers": 80, "economyBalance": 12345 }
    }
  ],
  "cached": 1,
  "uncached": 1
}
```

Returns cached responses when available; otherwise populates the cache for subsequent calls.

---

### 6. Monitoring API (`/monitoring`)

All routes require auth. Intended for ops dashboards and alerting.

| Method | Path                     | Description |
|--------|-------------------------|-------------|
| GET    | `/monitoring/health`    | Extended health report (cache, rate limiter, stats aggregator, DB pool, system memory/CPU). |
| GET    | `/monitoring/metrics`   | Performance metrics (cache efficiency, database query stats, aggregator freshness). |
| GET    | `/monitoring/cache`     | Cache statistics + quick advice. |
| POST   | `/monitoring/cache/clear` | Clears cache. Body `{ "pattern": "<regex>" }` (optional); without pattern clears everything. |
| GET    | `/monitoring/queries`   | Historical query metrics & top slow queries. |
| POST   | `/monitoring/queries/reset` | Resets stored query metrics. Empty body. |
| GET    | `/monitoring/rate-limits` | Current rate-limiter state plus configured limits. |
| GET    | `/monitoring/dashboard` | Combined snapshot for monitoring dashboards (uptime, cache, DB pool, aggregator). |

---

### 7. Guild Data API (`/guilds`)

Read-only analytics endpoints that feed the dashboard. All require auth.

| Method | Path                               | Returns |
|--------|------------------------------------|---------|
| GET    | `/guilds/:guildId/economy`         | Shop items (DB), top user balances, basic economy settings stub. |
| GET    | `/guilds/:guildId/moderation`      | Latest warnings/cases, aggregated moderation counts, default settings stub. |
| GET    | `/guilds/:guildId/tickets`         | Ticket queue summaries, configured panels, stats (open/closed, avg response time). |
| GET    | `/guilds/:guildId/xp`              | XP leaderboard (top 10), guild XP settings, role rewards. |
| GET    | `/guilds/:guildId/giveaways`       | Active & ended giveaways, participant counts, aggregate stats. |
| GET    | `/guilds/:guildId/settings`        | Basic guild configuration snapshot (prefix, language, notifications, automod, logging). |
| GET    | `/guilds/:guildId/members`         | First 20 member summaries + counts of online/bots/humans. |
| GET    | `/guilds/:guildId/logs`            | Placeholder audit log feed (returns empty list currently). |
| GET    | `/guilds/:guildId/notifications`   | Notification settings + list of text channels. |

All endpoints return `404` if the bot is not in the guild or records are missing. Response structures match the dashboard’s expectations (see the source for precise field names).

---

### 8. Tickets Management API (`/tickets`)

Mutates ticket panel configuration and individual ticket state.

| Method | Path | Body schema | Notes |
|--------|------|-------------|-------|
| POST   | `/:guildId/tickets/panels` | `{ title, description, categoryId, channelId, welcomeMessage?, buttonLabel?, buttonEmoji?, buttonStyle?, supportRoles?, maxTicketsPerUser? }` | Creates a new panel, posts embed & button, returns panel metadata. |
| PATCH  | `/:guildId/tickets/panels/:panelId` | Partial of creation schema. | Updates panel record and edits the embed if title/description changed. |
| DELETE | `/:guildId/tickets/panels/:panelId` | — | Removes panel (and message if still present). |
| POST   | `/:guildId/tickets/:ticketId/close` | `{ closedBy?, reason? }` | Marks ticket closed, deletes channel, DMs creator. |
| GET    | `/:guildId/tickets/:ticketId` | — | Returns ticket metadata (status, close info). |

Status codes: `201 Created` for panel creation, `400` for invalid data, `404` for missing panel/ticket.

---

### 9. Economy Management API (`/economy`)

| Method | Path | Body | Description |
|--------|------|------|-------------|
| POST   | `/:guildId/economy/shop-items` | `{ name, price, description?, type?, effectType?, effectValue?, stock?, requiresRole?, enabled? }` | Creates shop item, returns newly created record. |
| PATCH  | `/:guildId/economy/shop-items/:itemId` | Partial of the above schema. | Updates existing shop item. |
| DELETE | `/:guildId/economy/shop-items/:itemId` | — | Deletes shop item. |
| PATCH  | `/:guildId/economy/settings` | Partial settings schema (currency, rewards, cooldowns). | Currently acknowledges request; real storage is handled elsewhere. |
| POST   | `/:guildId/economy/reset` | `{ resetBalances?: boolean, resetShop?: boolean, resetTransactions?: boolean }` | Transactionally wipes balances/shop/transactions as requested. |

Validation uses Zod; error details are returned on `400`.

---

### 10. Moderation Management API (`/moderation`)

All endpoints require that the bot has the relevant Discord permissions; otherwise `403` is returned.

| Method | Path | Body | Description |
|--------|------|------|-------------|
| POST   | `/:guildId/moderation/warn` | `{ userId, moderatorId, reason, level? }` | Records a warning, logs case, attempts DM. |
| POST   | `/:guildId/moderation/ban` | `{ userId, moderatorId, reason, duration?, deleteMessageDays? }` | Issues ban (temporary if `duration` supplied). |
| POST   | `/:guildId/moderation/kick` | `{ userId, moderatorId, reason }` | Kicks a member. |
| POST   | `/:guildId/moderation/mute` | `{ userId, moderatorId, reason, duration? }` | Applies or creates a “Muted” role, optionally schedules unmute. |
| PATCH  | `/:guildId/moderation/settings` | `{ antiSpamEnabled?, logChannelId?, ... }` | Persists limited moderation settings (currently anti-spam + log channel). |

Successful responses include `success: true` and relevant case/penalty metadata.

---

### 11. XP Management API (`/xp`)

| Method | Path | Body | Description |
|--------|------|------|-------------|
| PATCH  | `/:guildId/xp/settings` | `{ enabled?, xpRate?, xpCooldown?, levelUpMessage?, levelUpChannel?, announceLevelUp?, xpBlacklistRoles?, xpBlacklistChannels?, xpMultiplierRoles? }` | Updates XP settings stored in `guildSettings`. |
| POST   | `/:guildId/xp/rewards` | `{ level, roleId }` | Creates level → role reward mapping (`409` if level already has reward). |
| DELETE | `/:guildId/xp/rewards/:level` | — | Deletes reward for specified level. |
| POST   | `/:guildId/xp/reset` | `{ resetLevels?, resetRewards?, keepSettings? }` | Bulk-reset member XP, role rewards, and optionally settings. |
| GET    | `/:guildId/xp/user/:userId` | — | Returns XP, level, progress to next level for a member. |
| PATCH  | `/:guildId/xp/user/:userId` | `{ xp?, addXp?, level?, addLevel? }` | Directly sets or increments XP/level. Creates member row if absent. |

---

### 12. Giveaways API (`/giveaways`)

| Method | Path | Body | Description |
|--------|------|------|-------------|
| POST   | `/:guildId/giveaways` | `{ prize, channelId, duration, winnerCount, hostedBy, description?, requiredRole?, bonusEntries?, allowedRoles?, blockedRoles? }` | Creates giveaway message in Discord, stores DB record, schedules auto-end. |
| PATCH  | `/:guildId/giveaways/:giveawayId` | Partial of creation schema (plus `endTime`). | Updates giveaway metadata and Discord message (must still be active). |
| DELETE | `/:guildId/giveaways/:giveawayId` | — | Deletes giveaway, removes Discord message, clears entries. |

Auto-ending is handled internally via timeouts (`endGiveaway`). Responses include success messages; 404 if giveaway missing.

---

### 13. Settings API (`/settings`)

| Method | Path | Body | Description |
|--------|------|------|-------------|
| PATCH  | `/:guildId/settings` | Composite settings object (prefix/language + nested `notifications`, `automod`, `logging`, `features`). | Updates `guilds` and `guild_settings` tables (fields mapped where schema permits). |
| GET    | `/:guildId/settings/export` | — | Returns full export (prefix, language, guild settings, economy shop items, XP rewards, ticket panels, warning automations). |
| POST   | `/:guildId/settings/import` | `{ data, options }` | Imports exported data. Options: `importSettings`, `importEconomy`, `importXp`, `importTickets`, `importModeration`, `overwrite`. Data version must include `version`. Uses transactions where possible. |

---

### 14. Tickets Close Helper (`/tickets/:ticketId/close`)

Documented under Tickets API, but special attention: request body requires `closedBy` (Discord user ID) and optional `reason`. Channel deletion is attempted; DM is sent to ticket creator.

---

### 15. Cache & Utility Endpoints

Already covered under Monitoring (`/monitoring/cache`, `/monitoring/cache/clear`) and root `/cache/stats`.

---

## Headers & Types Summary

| Header               | Required | Value                                    |
|----------------------|----------|------------------------------------------|
| `Authorization`      | Most routes | `Bearer <config.BOT_API_TOKEN>`       |
| `Content-Type`       | POST/PATCH bodies | `application/json`            |
| `Accept`             | Recommended | `application/json`                   |

Request payloads must be valid JSON. Numeric values use native JSON numbers (integers unless otherwise stated). Timestamps are ISO 8601 strings (`new Date().toISOString()`).

---

## Support & Logging

* All write endpoints log successes and failures via the shared logger.
* For debugging, consult the API process logs or query the `/monitoring` endpoints.
* When extending the API, add new routes here to keep the documentation accurate.

---

_Generated from the current TypeScript implementation under `src/api/routes/*`._

