const { Client } = require('pg');
const { parse } = require('pg-connection-string');

async function createDatabaseIfNotExists() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL not set');
  }

  // Parse the connection string
  const config = parse(connectionString);
  const dbName = config.database || 'pegasus';
  
  // Connect to postgres database to create our database
  const adminConfig = {
    ...config,
    database: 'postgres' // Connect to default postgres database
  };

  const client = new Client(adminConfig);

  try {
    await client.connect();
    console.log('Connected to PostgreSQL server');

    // Check if database exists
    const result = await client.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [dbName]
    );

    if (result.rows.length === 0) {
      // Create database
      await client.query(`CREATE DATABASE "${dbName}"`);
      console.log(`✓ Database "${dbName}" created successfully`);
    } else {
      console.log(`✓ Database "${dbName}" already exists`);
    }
  } catch (error) {
    if (error.code === '42P04') {
      console.log(`✓ Database "${dbName}" already exists`);
    } else {
      throw error;
    }
  } finally {
    await client.end();
  }
}

module.exports = { createDatabaseIfNotExists };

// If run directly
if (require.main === module) {
  require('dotenv').config();
  createDatabaseIfNotExists()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Failed to create database:', error.message);
      process.exit(1);
    });
}