# Pegasus Bot API Documentation

## Overview

Pegasus Bot provides several internal APIs for monitoring, health checks, and metrics collection. This document covers all available endpoints and their usage.

## Base URLs

- **Health Check API**: `http://localhost:3000`
- **Metrics API**: `http://localhost:9090`
- **Monitoring Dashboard**: `http://localhost:3001`

## Authentication

Currently, the APIs are designed for internal use and don't require authentication. In production, these should be secured behind a reverse proxy or VPN.

## Health Check API

### GET /health

Returns the overall health status of the bot.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 3600,
  "version": "1.0.0",
  "checks": {
    "discord": {
      "status": "healthy",
      "latency": 45,
      "guilds": 150,
      "users": 50000
    },
    "database": {
      "status": "healthy",
      "connections": {
        "active": 5,
        "idle": 15,
        "total": 20
      }
    },
    "memory": {
      "status": "healthy",
      "usage": {
        "heapUsed": 134217728,
        "heapTotal": 268435456,
        "rss": 402653184,
        "external": 12582912
      }
    }
  }
}
```

### GET /ready

Returns whether the bot is ready to handle requests.

**Response:**
```json
{
  "ready": true,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### GET /metrics

Returns Prometheus-formatted metrics.

**Response:**
```
# HELP pegasus_bot_guilds Total number of guilds
# TYPE pegasus_bot_guilds gauge
pegasus_bot_guilds 150

# HELP pegasus_bot_users Total number of users
# TYPE pegasus_bot_users gauge
pegasus_bot_users 50000

# HELP pegasus_bot_commands_total Total number of commands executed
# TYPE pegasus_bot_commands_total counter
pegasus_bot_commands_total{command="giveaway"} 1234
```

## Monitoring Dashboard API

### GET /api/stats

Returns comprehensive bot statistics.

**Response:**
```json
{
  "bot": {
    "guilds": 150,
    "users": 50000,
    "channels": 3000,
    "uptime": 3600,
    "memory": {
      "heapUsed": 134217728,
      "heapTotal": 268435456
    }
  },
  "database": {
    "guilds": 150,
    "users": 45000,
    "tracked_guilds": 150,
    "economy_users": 25000,
    "open_tickets": 45,
    "active_giveaways": 12
  },
  "activity": {
    "daily_actions": 15000,
    "weekly_actions": 95000,
    "daily_active_users": 5000,
    "daily_active_guilds": 120
  },
  "topCommands": [
    { "command": "help", "count": 5000 },
    { "command": "giveaway", "count": 3000 }
  ],
  "rateLimit": {
    "totalEntries": 50,
    "blacklistedCount": 2,
    "topOffenders": []
  }
}
```

### GET /api/logs

Returns recent audit log entries.

**Response:**
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "user_id": "123456789012345678",
    "guild_id": "987654321098765432",
    "action": "command_executed",
    "category": "user_action",
    "details": {
      "command": "giveaway",
      "subcommand": "create"
    },
    "created_at": "2024-01-01T00:00:00.000Z"
  }
]
```

### GET /api/health

Returns health status information.

**Response:**
```json
{
  "status": "healthy",
  "checks": {
    "bot": true,
    "database": true,
    "memory": true
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Database Schema

### Core Tables

#### guilds
```sql
CREATE TABLE guilds (
    id VARCHAR(20) PRIMARY KEY,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    settings JSONB DEFAULT '{}',
    premium_until TIMESTAMP
);
```

#### users
```sql
CREATE TABLE users (
    id VARCHAR(20) PRIMARY KEY,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    global_name VARCHAR(32),
    avatar_url TEXT
);
```

#### guild_members
```sql
CREATE TABLE guild_members (
    guild_id VARCHAR(20),
    user_id VARCHAR(20),
    xp INTEGER DEFAULT 0,
    level INTEGER DEFAULT 0,
    PRIMARY KEY (guild_id, user_id)
);
```

### Feature Tables

#### giveaways
```sql
CREATE TABLE giveaways (
    id UUID PRIMARY KEY,
    guild_id VARCHAR(20) NOT NULL,
    channel_id VARCHAR(20) NOT NULL,
    message_id VARCHAR(20),
    host_id VARCHAR(20) NOT NULL,
    title VARCHAR(256) NOT NULL,
    description TEXT,
    prize VARCHAR(256) NOT NULL,
    winner_count INTEGER DEFAULT 1,
    ends_at TIMESTAMP NOT NULL,
    requirements JSONB,
    bonus_entries JSONB,
    embed_config JSONB,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### tickets
```sql
CREATE TABLE tickets (
    id SERIAL PRIMARY KEY,
    guild_id VARCHAR(20) NOT NULL,
    channel_id VARCHAR(20) NOT NULL,
    user_id VARCHAR(20) NOT NULL,
    status VARCHAR(20) DEFAULT 'open',
    category VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    closed_at TIMESTAMP
);
```

### Security Tables

#### audit_logs
```sql
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY,
    user_id VARCHAR(20) NOT NULL,
    guild_id VARCHAR(20) NOT NULL,
    action VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL,
    details JSONB DEFAULT '{}',
    ip VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### user_permissions
```sql
CREATE TABLE user_permissions (
    guild_id VARCHAR(20) NOT NULL,
    user_id VARCHAR(20) NOT NULL,
    permission VARCHAR(100) NOT NULL,
    allowed BOOLEAN DEFAULT true,
    granted_by VARCHAR(20),
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (guild_id, user_id, permission)
);
```

## Error Codes

### HTTP Status Codes

- `200 OK`: Request successful
- `400 Bad Request`: Invalid request parameters
- `401 Unauthorized`: Authentication required
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Resource not found
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Server error
- `503 Service Unavailable`: Bot is not ready

### Application Error Codes

| Code | Description | Resolution |
|------|-------------|------------|
| `E001` | Database connection failed | Check database configuration |
| `E002` | Discord API error | Check bot token and permissions |
| `E003` | Rate limit exceeded | Wait before retrying |
| `E004` | Invalid input | Validate input parameters |
| `E005` | Permission denied | Check user permissions |
| `E006` | Resource not found | Verify resource exists |
| `E007` | Operation timeout | Retry operation |
| `E008` | Configuration error | Check bot configuration |

## Rate Limits

### Command Rate Limits

| Category | Max Requests | Window |
|----------|--------------|--------|
| Default | 5 | 60s |
| Economy | 3 | 60s |
| Admin | 10 | 60s |
| API | 30 | 60s |
| Heavy | 1 | 300s |

### API Rate Limits

All API endpoints are rate limited to prevent abuse:
- 30 requests per minute per IP
- 1000 requests per hour per IP

## Webhooks

### Error Webhook

Sends critical errors to a Discord webhook.

**Payload:**
```json
{
  "embeds": [{
    "title": "Critical Error",
    "description": "Error description",
    "color": 16711680,
    "fields": [
      {
        "name": "Error Type",
        "value": "DatabaseError",
        "inline": true
      },
      {
        "name": "Stack Trace",
        "value": "...",
        "inline": false
      }
    ],
    "timestamp": "2024-01-01T00:00:00.000Z"
  }]
}
```

### Audit Webhook

Sends audit log entries to a Discord webhook.

**Payload:**
```json
{
  "embeds": [{
    "title": "Audit Log Entry",
    "color": 39423,
    "fields": [
      {
        "name": "Action",
        "value": "ban_user",
        "inline": true
      },
      {
        "name": "User ID",
        "value": "123456789012345678",
        "inline": true
      }
    ],
    "timestamp": "2024-01-01T00:00:00.000Z"
  }]
}
```

## WebSocket Events

The bot doesn't currently expose a WebSocket API, but internally uses Discord's WebSocket for real-time events.

## SDK Usage

### JavaScript/TypeScript

```typescript
// Example: Fetching bot stats
async function getBotStats() {
  const response = await fetch('http://localhost:3001/api/stats');
  const data = await response.json();
  return data;
}

// Example: Checking health
async function checkHealth() {
  const response = await fetch('http://localhost:3000/health');
  const data = await response.json();
  return data.status === 'healthy';
}
```

### Python

```python
import requests

# Example: Fetching bot stats
def get_bot_stats():
    response = requests.get('http://localhost:3001/api/stats')
    return response.json()

# Example: Checking health
def check_health():
    response = requests.get('http://localhost:3000/health')
    data = response.json()
    return data['status'] == 'healthy'
```

### cURL

```bash
# Get health status
curl http://localhost:3000/health

# Get bot statistics
curl http://localhost:3001/api/stats

# Get Prometheus metrics
curl http://localhost:9090/metrics
```

## Best Practices

1. **Monitoring**: Set up alerts based on health check endpoints
2. **Rate Limiting**: Implement client-side rate limiting to avoid 429 errors
3. **Error Handling**: Always handle potential errors gracefully
4. **Caching**: Cache responses when appropriate to reduce load
5. **Security**: Use HTTPS in production and implement authentication

## Migration Guide

### From v0.x to v1.0

1. Update all API endpoints to use new paths
2. Update response parsing for new data structures
3. Implement proper error handling for new error codes
4. Update rate limiting logic

## Changelog

### v1.0.0 (2024-01-01)
- Initial API documentation
- Health check endpoints
- Monitoring dashboard
- Prometheus metrics support

## Support

For API support and questions:
- Discord: [discord.gg/yourserver](https://discord.gg/yourserver)
- Email: api-support@yourdomain.com
- GitHub Issues: [github.com/yourorg/pegasus-bot/issues](https://github.com/yourorg/pegasus-bot/issues)