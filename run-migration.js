const { Client } = require('pg');
const fs = require('fs');

async function runMigration() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('Connected\!');
    
    const sql = fs.readFileSync('src/database/migrations/014_giveaway_system.sql', 'utf-8');
    console.log('Running giveaway migration...');
    await client.query(sql);
    console.log('Migration completed successfully\!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
