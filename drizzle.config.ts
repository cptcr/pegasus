import type { Config } from 'drizzle-kit';
import { config } from './src/config/env';

export default {
  schema: './src/database/schema/index.ts',
  out: './drizzle',
  driver: 'pg',
  dbCredentials: {
    connectionString: config.DATABASE_URL,
    ssl: config.DB_SSL ? { rejectUnauthorized: false } : undefined,
  },
  verbose: true,
  strict: true,
} satisfies Config;