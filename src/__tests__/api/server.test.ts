import { describe, it, expect, jest, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import express, { Express } from 'express';
import { 
  createMockDb,
  createMockGuildData,
  createMockGuildMemberData,
  createMockWarningData,
  createMockGiveawayData,
  createMockTicketData
} from '../utils/mockDatabase';
import { createMockClient } from '../utils/mockDiscord';
import { cleanupMocks } from '../utils/testHelpers';

jest.mock('../../database/connection', () => ({
  db: createMockDb(),
}));

jest.mock('discord.js', () => ({
  Client: jest.fn(() => createMockClient()),
  GatewayIntentBits: {},
  Partials: {},
  Collection: Map,
}));

describe('API Server', () => {
  let app: Express;
  let server: any;
  let mockDb: ReturnType<typeof createMockDb>;
  let mockClient: ReturnType<typeof createMockClient>;
  
  beforeAll(async () => {
    process.env.BOT_API_TOKEN = 'test_api_token';
    process.env.API_PORT = '0';
    
    const apiModule = await import('../../api/server');
    app = apiModule.app;
    mockDb = createMockDb();
    mockClient = createMockClient();
  });
  
  afterAll(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });
  
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('GET /health', () => {
    it('should return health status without authentication', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);
      
      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('timestamp');
    });
  });
  
  describe('GET /stats', () => {
    it('should return bot statistics with authentication', async () => {
      mockClient.guilds.cache.size = 10;
      mockClient.users.cache.size = 1000;
      
      const response = await request(app)
        .get('/stats')
        .set('Authorization', 'Bearer test_api_token')
        .expect(200);
      
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('guilds');
      expect(response.body.guilds).toHaveProperty('total', 10);
      expect(response.body).toHaveProperty('users');
      expect(response.body.users).toHaveProperty('total', 1000);
      expect(response.body).toHaveProperty('system');
      expect(response.body).toHaveProperty('uptime');
    });
    
    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .get('/stats')
        .expect(401);
      
      expect(response.body).toHaveProperty('error', 'Unauthorized');
    });
    
    it('should return 401 with invalid token', async () => {
      const response = await request(app)
        .get('/stats')
        .set('Authorization', 'Bearer invalid_token')
        .expect(401);
      
      expect(response.body).toHaveProperty('error', 'Invalid token');
    });
  });
  
  describe('GET /guilds/:guildId/settings', () => {
    it('should return guild settings', async () => {
      const guildData = createMockGuildData();
      
      mockDb.select.mockReturnThis();
      mockDb.from.mockReturnThis();
      mockDb.where.mockReturnThis();
      mockDb.execute.mockResolvedValue([guildData]);
      
      const response = await request(app)
        .get('/guilds/987654321098765432/settings')
        .set('Authorization', 'Bearer test_api_token')
        .expect(200);
      
      expect(response.body).toHaveProperty('id', guildData.id);
      expect(response.body).toHaveProperty('prefix', guildData.prefix);
      expect(response.body).toHaveProperty('welcomeEnabled', guildData.welcomeEnabled);
    });
    
    it('should return 404 for non-existent guild', async () => {
      mockDb.select.mockReturnThis();
      mockDb.from.mockReturnThis();
      mockDb.where.mockReturnThis();
      mockDb.execute.mockResolvedValue([]);
      
      const response = await request(app)
        .get('/guilds/000000000000000000/settings')
        .set('Authorization', 'Bearer test_api_token')
        .expect(404);
      
      expect(response.body).toHaveProperty('error', 'Guild not found');
    });
  });
  
  describe('PATCH /guilds/:guildId/settings', () => {
    it('should update guild settings', async () => {
      const guildData = createMockGuildData();
      
      mockDb.update.mockReturnThis();
      mockDb.set.mockReturnThis();
      mockDb.where.mockReturnThis();
      mockDb.returning.mockResolvedValue([{
        ...guildData,
        prefix: '?',
        welcomeEnabled: false,
      }]);
      
      const response = await request(app)
        .patch('/guilds/987654321098765432/settings')
        .set('Authorization', 'Bearer test_api_token')
        .send({
          prefix: '?',
          welcomeEnabled: false,
        })
        .expect(200);
      
      expect(response.body).toHaveProperty('prefix', '?');
      expect(response.body).toHaveProperty('welcomeEnabled', false);
    });
    
    it('should validate input data', async () => {
      const response = await request(app)
        .patch('/guilds/987654321098765432/settings')
        .set('Authorization', 'Bearer test_api_token')
        .send({
          prefix: '',
          welcomeEnabled: 'not_a_boolean',
        })
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
    });
  });
  
  describe('GET /guilds/:guildId/members', () => {
    it('should return guild members with pagination', async () => {
      const members = [
        createMockGuildMemberData({ userId: '111' }),
        createMockGuildMemberData({ userId: '222' }),
        createMockGuildMemberData({ userId: '333' }),
      ];
      
      mockDb.select.mockReturnThis();
      mockDb.from.mockReturnThis();
      mockDb.where.mockReturnThis();
      mockDb.orderBy.mockReturnThis();
      mockDb.limit.mockReturnThis();
      mockDb.offset.mockReturnThis();
      mockDb.execute.mockResolvedValue(members);
      
      const response = await request(app)
        .get('/guilds/987654321098765432/members')
        .query({ page: 1, limit: 10 })
        .set('Authorization', 'Bearer test_api_token')
        .expect(200);
      
      expect(response.body).toHaveProperty('members');
      expect(response.body.members).toHaveLength(3);
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.pagination).toHaveProperty('page', 1);
      expect(response.body.pagination).toHaveProperty('limit', 10);
    });
  });
  
  describe('GET /guilds/:guildId/moderation', () => {
    it('should return moderation logs', async () => {
      const warnings = [
        createMockWarningData({ userId: '111', reason: 'Warning 1' }),
        createMockWarningData({ userId: '222', reason: 'Warning 2' }),
      ];
      
      mockDb.select.mockReturnThis();
      mockDb.from.mockReturnThis();
      mockDb.where.mockReturnThis();
      mockDb.orderBy.mockReturnThis();
      mockDb.limit.mockReturnThis();
      mockDb.execute.mockResolvedValue(warnings);
      
      const response = await request(app)
        .get('/guilds/987654321098765432/moderation')
        .set('Authorization', 'Bearer test_api_token')
        .expect(200);
      
      expect(response.body).toHaveProperty('warnings');
      expect(response.body.warnings).toHaveLength(2);
      expect(response.body).toHaveProperty('total', 2);
    });
  });
  
  describe('POST /guilds/:guildId/moderation/warn', () => {
    it('should create a new warning', async () => {
      const newWarning = createMockWarningData({
        userId: '123456789012345678',
        reason: 'Test warning',
        moderatorId: '999999999999999999',
      });
      
      mockDb.insert.mockReturnThis();
      mockDb.values.mockReturnThis();
      mockDb.returning.mockResolvedValue([newWarning]);
      
      const response = await request(app)
        .post('/guilds/987654321098765432/moderation/warn')
        .set('Authorization', 'Bearer test_api_token')
        .send({
          userId: '123456789012345678',
          reason: 'Test warning',
          moderatorId: '999999999999999999',
        })
        .expect(201);
      
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('userId', '123456789012345678');
      expect(response.body).toHaveProperty('reason', 'Test warning');
    });
    
    it('should validate warning data', async () => {
      const response = await request(app)
        .post('/guilds/987654321098765432/moderation/warn')
        .set('Authorization', 'Bearer test_api_token')
        .send({
          userId: 'invalid_id',
          reason: '',
        })
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
    });
  });
  
  describe('GET /guilds/:guildId/giveaways', () => {
    it('should return active giveaways', async () => {
      const giveaways = [
        createMockGiveawayData({ prize: 'Prize 1', ended: false }),
        createMockGiveawayData({ prize: 'Prize 2', ended: false }),
      ];
      
      mockDb.select.mockReturnThis();
      mockDb.from.mockReturnThis();
      mockDb.where.mockReturnThis();
      mockDb.orderBy.mockReturnThis();
      mockDb.execute.mockResolvedValue(giveaways);
      
      const response = await request(app)
        .get('/guilds/987654321098765432/giveaways')
        .set('Authorization', 'Bearer test_api_token')
        .expect(200);
      
      expect(response.body).toHaveProperty('active');
      expect(response.body.active).toHaveLength(2);
      expect(response.body).toHaveProperty('ended');
    });
  });
  
  describe('POST /guilds/:guildId/giveaways', () => {
    it('should create a new giveaway', async () => {
      const newGiveaway = createMockGiveawayData({
        prize: 'Discord Nitro',
        winnersCount: 2,
        endTime: new Date(Date.now() + 86400000),
      });
      
      mockDb.insert.mockReturnThis();
      mockDb.values.mockReturnThis();
      mockDb.returning.mockResolvedValue([newGiveaway]);
      
      const response = await request(app)
        .post('/guilds/987654321098765432/giveaways')
        .set('Authorization', 'Bearer test_api_token')
        .send({
          prize: 'Discord Nitro',
          duration: 86400,
          winners: 2,
          channelId: '333333333333333333',
        })
        .expect(201);
      
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('prize', 'Discord Nitro');
      expect(response.body).toHaveProperty('winnersCount', 2);
    });
  });
  
  describe('GET /guilds/:guildId/tickets', () => {
    it('should return open tickets', async () => {
      const tickets = [
        createMockTicketData({ subject: 'Help needed', status: 'open' }),
        createMockTicketData({ subject: 'Bug report', status: 'open' }),
      ];
      
      mockDb.select.mockReturnThis();
      mockDb.from.mockReturnThis();
      mockDb.where.mockReturnThis();
      mockDb.orderBy.mockReturnThis();
      mockDb.execute.mockResolvedValue(tickets);
      
      const response = await request(app)
        .get('/guilds/987654321098765432/tickets')
        .set('Authorization', 'Bearer test_api_token')
        .expect(200);
      
      expect(response.body).toHaveProperty('open');
      expect(response.body.open).toHaveLength(2);
      expect(response.body).toHaveProperty('closed');
    });
  });
  
  describe('Rate Limiting', () => {
    it('should enforce rate limits', async () => {
      const requests = Array(101).fill(null).map(() => 
        request(app)
          .get('/stats')
          .set('Authorization', 'Bearer test_api_token')
      );
      
      const responses = await Promise.all(requests);
      const rateLimited = responses.filter(r => r.status === 429);
      
      expect(rateLimited.length).toBeGreaterThan(0);
    });
  });
});