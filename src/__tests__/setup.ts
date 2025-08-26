import dotenv from 'dotenv';
import { jest } from '@jest/globals';

dotenv.config({ path: '.env.test' });

process.env.NODE_ENV = 'test';
process.env.DISCORD_TOKEN = 'test_token';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/pegasus_test';
process.env.BOT_API_TOKEN = 'test_api_token';
process.env.DEVELOPER_IDS = '["123456789012345678"]';
process.env.DEFAULT_LANGUAGE = 'en';
process.env.LOG_LEVEL = 'error';

global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

jest.setTimeout(10000);

beforeAll(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  jest.clearAllMocks();
});

afterAll(async () => {
  await new Promise(resolve => setTimeout(resolve, 100));
});