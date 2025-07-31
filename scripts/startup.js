#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step, message) {
  log(`[${step}] ${message}`, 'cyan');
}

function logSuccess(message) {
  log(`✓ ${message}`, 'green');
}

function logError(message) {
  log(`✗ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠ ${message}`, 'yellow');
}

function executeCommand(command, description) {
  try {
    logStep('EXEC', description);
    execSync(command, { stdio: 'inherit' });
    logSuccess(`${description} completed`);
    return true;
  } catch (error) {
    logError(`${description} failed`);
    return false;
  }
}

async function checkEnvironment() {
  logStep('ENV', 'Checking environment...');
  
  // Check Node.js version
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.split('.')[0].substring(1));
  
  if (majorVersion < 18) {
    logError(`Node.js version ${nodeVersion} is not supported. Please use Node.js 18 or higher.`);
    process.exit(1);
  }
  logSuccess(`Node.js ${nodeVersion} detected`);
  
  // Check if .env file exists
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) {
    logWarning('.env file not found');
    
    const envExamplePath = path.join(__dirname, '..', '.env.example');
    if (fs.existsSync(envExamplePath)) {
      logStep('ENV', 'Creating .env from .env.example...');
      fs.copyFileSync(envExamplePath, envPath);
      logSuccess('.env file created from .env.example');
      logWarning('Please edit .env file with your configuration before running the bot again');
      process.exit(0);
    } else {
      logError('.env.example file not found. Please create .env file manually');
      process.exit(1);
    }
  }
  
  // Load and validate environment variables
  require('dotenv').config({ path: envPath });
  
  const requiredEnvVars = ['BOT_TOKEN', 'CLIENT_ID', 'DATABASE_URL'];
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    logError(`Missing required environment variables: ${missingVars.join(', ')}`);
    logWarning('Please edit .env file and provide all required values');
    process.exit(1);
  }
  
  logSuccess('Environment variables validated');
}

async function checkDependencies() {
  logStep('DEPS', 'Checking dependencies...');
  
  const nodeModulesPath = path.join(__dirname, '..', 'node_modules');
  if (!fs.existsSync(nodeModulesPath)) {
    logWarning('node_modules not found');
    if (!executeCommand('npm install', 'Installing dependencies')) {
      logError('Failed to install dependencies');
      process.exit(1);
    }
  } else {
    logSuccess('Dependencies already installed');
  }
}

async function setupDatabase() {
  logStep('DB', 'Setting up database...');
  
  // Test database connection
  const { Client } = require('pg');
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  
  try {
    await client.connect();
    logSuccess('Database connection successful');
    await client.end();
  } catch (error) {
    logError(`Database connection failed: ${error.message}`);
    logWarning('Please check your DATABASE_URL in .env file');
    process.exit(1);
  }
  
  // Run migrations
  if (!executeCommand('npm run migrate', 'Running database migrations')) {
    logError('Database migration failed');
    logWarning('If this is a fresh database, the migration system will initialize it');
  }
}

async function buildProject() {
  logStep('BUILD', 'Building project...');
  
  const distPath = path.join(__dirname, '..', 'dist');
  
  // Check if build is needed
  const srcPath = path.join(__dirname, '..', 'src');
  const needsBuild = !fs.existsSync(distPath) || 
    (fs.statSync(srcPath).mtime > fs.statSync(distPath).mtime);
  
  if (needsBuild) {
    if (!executeCommand('npm run build', 'Compiling TypeScript')) {
      logError('Build failed');
      process.exit(1);
    }
  } else {
    logSuccess('Build is up to date');
  }
}

async function startBot() {
  logStep('START', 'Starting bot...');
  
  log('');
  log('═══════════════════════════════════════════════════════════════', 'bright');
  log('                    PEGASUS DISCORD BOT                        ', 'bright');
  log('═══════════════════════════════════════════════════════════════', 'bright');
  log('');
  logSuccess('All checks passed. Starting bot...');
  log('');
  
  // Start the bot
  require('child_process').spawn('node', ['dist/index.js'], {
    stdio: 'inherit',
    shell: true
  });
}

async function main() {
  log('');
  log('🚀 Pegasus Bot Startup Script', 'bright');
  log('─────────────────────────────', 'bright');
  log('');
  
  try {
    await checkEnvironment();
    await checkDependencies();
    await setupDatabase();
    await buildProject();
    await startBot();
  } catch (error) {
    logError(`Startup failed: ${error.message}`);
    process.exit(1);
  }
}

// Handle process termination
process.on('SIGINT', () => {
  log('\n');
  logWarning('Shutting down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  log('\n');
  logWarning('Shutting down...');
  process.exit(0);
});

// Run the startup script
main().catch(error => {
  logError(`Unexpected error: ${error.message}`);
  process.exit(1);
});