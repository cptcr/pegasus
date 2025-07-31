#!/usr/bin/env node

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const url = require('url');

// CLI argument parsing
const args = process.argv.slice(2);
const flags = {
  dev: args.includes('--dev') || args.includes('-d'),
  prod: args.includes('--prod') || args.includes('-p'),
  migrateOnly: args.includes('--migrate-only') || args.includes('-m'),
  checkOnly: args.includes('--check-only') || args.includes('-c'),
  verbose: args.includes('--verbose') || args.includes('-v'),
  quiet: args.includes('--quiet') || args.includes('-q'),
  interactive: args.includes('--interactive') || args.includes('-i'),
  skipChecks: args.includes('--skip-checks'),
  pm2: args.includes('--pm2'),
  help: args.includes('--help') || args.includes('-h')
};

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
};

// Logging configuration
const logLevel = flags.verbose ? 'debug' : flags.quiet ? 'error' : 'info';
const logLevels = { error: 0, warn: 1, info: 2, debug: 3 };

function shouldLog(level) {
  return logLevels[level] <= logLevels[logLevel];
}

function log(message, color = 'reset', level = 'info') {
  if (!shouldLog(level)) return;
  const timestamp = new Date().toISOString();
  const prefix = flags.verbose ? `[${timestamp}] ` : '';
  console.log(`${prefix}${colors[color]}${message}${colors.reset}`);
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

function logInfo(message) {
  log(`ℹ ${message}`, 'blue');
}

function logDebug(message) {
  log(`🔍 ${message}`, 'gray', 'debug');
}

// Performance metrics
const metrics = {
  startTime: Date.now(),
  stages: {},
  memory: {},
  system: {}
};

function startTimer(stage) {
  metrics.stages[stage] = { start: Date.now() };
  logDebug(`Started stage: ${stage}`);
}

function endTimer(stage) {
  if (metrics.stages[stage]) {
    metrics.stages[stage].end = Date.now();
    metrics.stages[stage].duration = metrics.stages[stage].end - metrics.stages[stage].start;
    logDebug(`Completed stage: ${stage} (${metrics.stages[stage].duration}ms)`);
  }
}

function collectSystemMetrics() {
  metrics.system = {
    platform: os.platform(),
    arch: os.arch(),
    nodeVersion: process.version,
    cpus: os.cpus().length,
    totalMemory: os.totalmem(),
    freeMemory: os.freemem(),
    uptime: os.uptime(),
    loadAvg: os.loadavg()
  };
  
  metrics.memory = {
    used: process.memoryUsage(),
    heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    rss: Math.round(process.memoryUsage().rss / 1024 / 1024)
  };
}

// Error handling
class StartupError extends Error {
  constructor(message, stage, recovery) {
    super(message);
    this.name = 'StartupError';
    this.stage = stage;
    this.recovery = recovery;
  }
}

// Command execution with retry logic
async function executeCommand(command, description, options = {}) {
  const { retries = 0, timeout = 120000, silent = false } = options;
  let attempt = 0;
  
  while (attempt <= retries) {
    try {
      if (!silent) logStep('EXEC', `${description}${attempt > 0 ? ` (attempt ${attempt + 1})` : ''}`);
      
      const result = execSync(command, { 
        stdio: silent ? 'pipe' : 'inherit',
        timeout,
        encoding: 'utf8'
      });
      
      if (!silent) logSuccess(`${description} completed`);
      return { success: true, output: result };
    } catch (error) {
      attempt++;
      if (attempt <= retries) {
        logWarning(`${description} failed, retrying in 2 seconds...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      } else {
        if (!silent) logError(`${description} failed after ${attempt} attempts`);
        return { success: false, error: error.message };
      }
    }
  }
}

// Help text
function showHelp() {
  console.log(`
Pegasus Bot Production Startup Script
=====================================

Usage: node scripts/startup.js [options]

Options:
  -d, --dev               Start in development mode  
  -p, --prod              Start in production mode
  -m, --migrate-only      Run migrations only and exit
  -c, --check-only        Run pre-flight checks only
  -v, --verbose           Enable verbose logging
  -q, --quiet             Enable quiet mode (errors only)
  -i, --interactive       Interactive setup mode
  --skip-checks           Skip pre-flight checks (not recommended)
  --pm2                   Use PM2 for process management
  -h, --help              Show this help message

Examples:
  node scripts/startup.js --prod --pm2       # Production with PM2
  node scripts/startup.js --dev --verbose    # Development with verbose logging  
  node scripts/startup.js --check-only       # Validate environment only
  node scripts/startup.js --migrate-only     # Run migrations only

Environment Variables:
  NODE_ENV                Environment (development/production)
  LOG_LEVEL               Logging level (error/warn/info/debug)
  ENABLE_MONITORING       Enable monitoring dashboard
  PM2_INSTANCES           Number of PM2 instances
  HEALTH_CHECK_PORT       Health check endpoint port
  `);
}

// Pre-flight checks
async function validateNodeVersion() {
  logStep('PREFLIGHT', 'Validating Node.js version...');
  
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.split('.')[0].substring(1));
  const minorVersion = parseInt(nodeVersion.split('.')[1]);
  
  if (majorVersion < 18) {
    throw new StartupError(
      `Node.js version ${nodeVersion} is not supported. Please use Node.js 18 or higher.`,
      'NODE_VERSION',
      'Install Node.js 18+ from https://nodejs.org'
    );
  }
  
  if (majorVersion === 18 && minorVersion < 16) {
    logWarning(`Node.js ${nodeVersion} detected. Consider upgrading to 18.16+ for better performance.`);
  }
  
  logSuccess(`Node.js ${nodeVersion} validated`);
  logDebug(`Node.js features: ES2022 modules, optional chaining, nullish coalescing`);
}

async function validateEnvironment() {
  logStep('PREFLIGHT', 'Validating environment variables...');
  
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) {
    const envExamplePath = path.join(__dirname, '..', '.env.example');
    if (fs.existsSync(envExamplePath)) {
      if (flags.interactive) {
        logStep('ENV', 'Creating .env from .env.example...');
        fs.copyFileSync(envExamplePath, envPath);
        logSuccess('.env file created from .env.example');
        logWarning('Please edit .env file with your configuration before continuing');
        
        await interactiveSetup();
      } else {
        logWarning('.env file not found');
        logInfo('Run with --interactive flag for guided setup');
        throw new StartupError(
          '.env file not found',
          'ENV_MISSING',
          'Create .env file from .env.example or run with --interactive flag'
        );
      }
    } else {
      throw new StartupError(
        '.env.example file not found',
        'ENV_EXAMPLE_MISSING',
        'Ensure .env.example exists in project root'
      );
    }
  }
  
  // Load environment variables
  require('dotenv').config({ path: envPath });
  
  const requiredEnvVars = ['BOT_TOKEN', 'CLIENT_ID', 'DATABASE_URL'];
  const recommendedEnvVars = ['LOG_LEVEL', 'NODE_ENV', 'HEALTH_CHECK_PORT'];
  
  const missingRequired = requiredEnvVars.filter(varName => !process.env[varName]);
  const missingRecommended = recommendedEnvVars.filter(varName => !process.env[varName]);
  
  if (missingRequired.length > 0) {
    throw new StartupError(
      `Missing required environment variables: ${missingRequired.join(', ')}`,
      'ENV_VALIDATION',
      'Add missing variables to .env file'
    );
  }
  
  if (missingRecommended.length > 0) {
    logWarning(`Missing recommended environment variables: ${missingRecommended.join(', ')}`);
  }
  
  // Validate database URL
  try {
    const parsed = new url.URL(process.env.DATABASE_URL);
    if (parsed.protocol !== 'postgresql:' && parsed.protocol !== 'postgres:') {
      throw new Error('Database URL must use postgresql:// or postgres:// protocol');
    }
    logDebug(`Database: ${parsed.hostname}:${parsed.port || 5432}/${parsed.pathname.slice(1)}`);
  } catch (error) {
    throw new StartupError(
      `Invalid DATABASE_URL: ${error.message}`,
      'DATABASE_URL_INVALID',
      'Ensure DATABASE_URL follows format: postgresql://user:pass@host:port/dbname'
    );
  }
  
  logSuccess('Environment variables validated');
}

async function checkSystemRequirements() {
  logStep('PREFLIGHT', 'Checking system requirements...');
  
  collectSystemMetrics();
  
  const freeMemoryMB = Math.round(metrics.system.freeMemory / 1024 / 1024);
  const totalMemoryMB = Math.round(metrics.system.totalMemory / 1024 / 1024);
  
  if (freeMemoryMB < 512) {
    logWarning(`Low available memory: ${freeMemoryMB}MB free of ${totalMemoryMB}MB total`);
  } else {
    logSuccess(`Memory: ${freeMemoryMB}MB free of ${totalMemoryMB}MB total`);
  }
  
  logInfo(`CPU: ${metrics.system.cpus} cores, Load: ${metrics.system.loadAvg.map(l => l.toFixed(2)).join(', ')}`);
  
  try {
    const stats = fs.statSync(__dirname);
    logDebug(`Project directory accessible: ${__dirname}`);
  } catch (error) {
    throw new StartupError(
      `Cannot access project directory: ${error.message}`,
      'FILESYSTEM',
      'Check file permissions and disk space' 
    );
  }
  
  // Create logs directory
  const logsDir = path.join(__dirname, '..', 'logs');
  if (!fs.existsSync(logsDir)) {
    try {
      fs.mkdirSync(logsDir, { recursive: true });
      logDebug(`Created logs directory: ${logsDir}`);
    } catch (error) {
      logWarning(`Cannot create logs directory: ${error.message}`);
    }
  }
  
  logSuccess('System requirements validated');
}

// Database operations
async function testDatabaseConnectivity() {
  logStep('DATABASE', 'Testing database connectivity...');
  
  const { Client } = require('pg');
  const dbUrl = process.env.DATABASE_URL;
  
  let client;
  try {
    client = new Client({ connectionString: dbUrl });
    await client.connect();
    
    const result = await client.query('SELECT version()');
    const version = result.rows[0].version;
    
    const pgVersion = version.match(/PostgreSQL (\d+\.\d+)/);
    if (pgVersion) {
      const versionNum = parseFloat(pgVersion[1]);
      if (versionNum < 13) {
        logWarning(`PostgreSQL ${pgVersion[1]} detected. Version 13+ recommended for optimal performance.`);
      } else {
        logSuccess(`PostgreSQL ${pgVersion[1]} connected successfully`);
      }
    }
    
    const poolTest = await client.query('SELECT COUNT(*) FROM pg_stat_activity WHERE datname = current_database()');
    logDebug(`Active connections: ${poolTest.rows[0].count}`);
    
    return true;
  } catch (error) {
    throw new StartupError(
      `Database connection failed: ${error.message}`,
      'DATABASE_CONNECTION',
      'Check PostgreSQL server status and connection parameters'
    );
  } finally {
    if (client) {
      await client.end();
    }
  }
}

async function ensureDatabaseExists() {
  logStep('DATABASE', 'Ensuring database exists...');
  
  const { Client } = require('pg');
  const dbUrl = new url.URL(process.env.DATABASE_URL);
  const dbName = dbUrl.pathname.slice(1) || 'pegasus';
  
  const postgresUrl = `${dbUrl.protocol}//${dbUrl.username}:${dbUrl.password}@${dbUrl.host}/postgres`;
  const adminClient = new Client({ connectionString: postgresUrl });
  
  try {
    await adminClient.connect();
    logDebug('Connected to PostgreSQL server');
    
    const result = await adminClient.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [dbName]
    );
    
    if (result.rows.length === 0) {
      await adminClient.query(`CREATE DATABASE "${dbName}"`);
      logSuccess(`Created database: ${dbName}`);
    } else {
      logSuccess(`Database exists: ${dbName}`);
    }
  } catch (error) {
    logWarning(`Could not create database: ${error.message}`);
  } finally {
    await adminClient.end();
  }
}

async function runMigrations() {
  logStep('DATABASE', 'Running database migrations...');
  
  startTimer('migrations');
  const result = await executeCommand('npm run migrate', 'Database migrations', { retries: 1 });
  endTimer('migrations');
  
  if (!result.success) {
    throw new StartupError(
      'Database migration failed',
      'MIGRATIONS',
      'Check migration files and database permissions'
    );
  }
}

// Build process
async function checkDependencies() {
  logStep('BUILD', 'Checking dependencies...');
  
  const nodeModulesPath = path.join(__dirname, '..', 'node_modules');
  const packageJsonPath = path.join(__dirname, '..', 'package.json');
  
  if (!fs.existsSync(nodeModulesPath)) {
    logWarning('node_modules not found, installing dependencies...');
    startTimer('npm_install');
    const result = await executeCommand('npm ci', 'Installing dependencies', { timeout: 300000 });
    endTimer('npm_install');
    
    if (!result.success) {
      throw new StartupError(
        'Dependency installation failed',
        'DEPENDENCIES',
        'Check npm registry connectivity and package.json'
      );
    }
  } else {
    const packageStats = fs.statSync(packageJsonPath);
    const nodeModulesStats = fs.statSync(nodeModulesPath);
    
    if (packageStats.mtime > nodeModulesStats.mtime) {
      logWarning('package.json is newer than node_modules, updating dependencies...');
      const result = await executeCommand('npm ci', 'Updating dependencies', { timeout: 300000 });
      if (!result.success) {
        logWarning('Dependency update failed, continuing with existing modules');
      }
    } else {
      logSuccess('Dependencies are up to date');
    }
  }
  
  const criticalDeps = ['discord.js', 'pg', 'typescript'];
  for (const dep of criticalDeps) {
    const depPath = path.join(nodeModulesPath, dep);
    if (!fs.existsSync(depPath)) {
      throw new StartupError(
        `Critical dependency missing: ${dep}`,
        'DEPENDENCIES',
        'Run npm install to install missing dependencies'
      );
    }
  }
  
  logSuccess('Dependencies validated');
}

async function buildProject() {
  logStep('BUILD', 'Building project...');
  
  const distPath = path.join(__dirname, '..', 'dist');
  const srcPath = path.join(__dirname, '..', 'src');
  const tsconfigPath = path.join(__dirname, '..', 'tsconfig.json');
  
  let needsBuild = !fs.existsSync(distPath);
  
  if (!needsBuild && fs.existsSync(distPath)) {
    const srcStats = fs.statSync(srcPath);
    const distStats = fs.statSync(distPath);
    needsBuild = srcStats.mtime > distStats.mtime;
  }
  
  if (!needsBuild && fs.existsSync(tsconfigPath)) {
    const tsconfigStats = fs.statSync(tsconfigPath);
    const distStats = fs.statSync(distPath);
    needsBuild = tsconfigStats.mtime > distStats.mtime;
  }
  
  if (needsBuild || flags.prod) {
    startTimer('typescript_build');
    const result = await executeCommand('npm run build', 'TypeScript compilation', { timeout: 180000 });
    endTimer('typescript_build');
    
    if (!result.success) {
      throw new StartupError(
        'TypeScript compilation failed',
        'BUILD',
        'Check TypeScript errors and fix syntax issues'
      );
    }
    
    const mainFile = path.join(distPath, 'index.js');
    if (!fs.existsSync(mainFile)) {
      throw new StartupError(
        'Build output missing: dist/index.js',
        'BUILD',
        'Check build configuration and TypeScript output'
      );
    }
    
    const stats = fs.statSync(mainFile);
    const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
    logInfo(`Main bundle size: ${sizeMB}MB`);
    
    if (stats.size > 50 * 1024 * 1024) {
      logWarning('Large bundle size detected, consider code splitting');
    }
    
    logSuccess('Project built successfully');
  } else {
    logSuccess('Build is up to date');
  }
}

async function copyAssets() {
  logStep('BUILD', 'Copying assets...');
  
  const localesSource = path.join(__dirname, '..', 'src', 'i18n', 'locales');
  
  if (fs.existsSync(localesSource)) {
    const result = await executeCommand('npm run copy-assets', 'Copying i18n assets');
    if (result.success) {
      logSuccess('Assets copied successfully');
    } else {
      logWarning('Asset copying failed, some features may not work');
    }
  } else {
    logDebug('No i18n locales found to copy');
  }
}

// Health checks
async function createHealthCheck() {
  logStep('HEALTH', 'Setting up health check endpoint...');
  
  const port = process.env.HEALTH_CHECK_PORT || 3000;
  const express = require('express');
  const app = express();
  
  app.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: require('../package.json').version
    });
  });
  
  app.get('/metrics', (req, res) => {
    res.json({
      metrics,
      system: metrics.system,
      stages: metrics.stages
    });
  });
  
  const server = app.listen(port, () => {
    logSuccess(`Health check endpoint running on port ${port}`);
    logDebug(`Health check: http://localhost:${port}/health`);
    logDebug(`Metrics: http://localhost:${port}/metrics`);
  });
  
  return server;
}

// Process management
async function setupPM2() {
  if (!flags.pm2) return;
  
  logStep('PM2', 'Setting up PM2 process management...');
  
  try {
    execSync('pm2 --version', { stdio: 'pipe' });
  } catch (error) {
    logWarning('PM2 not found, installing globally...');
    await executeCommand('npm install -g pm2', 'Installing PM2');
  }
  
  const ecosystemConfig = {
    apps: [{
      name: 'pegasus-bot',
      script: 'dist/index.js',
      instances: process.env.PM2_INSTANCES || 1,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        ...process.env
      },
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_file: './logs/pm2-combined.log',
      time: true,
      max_memory_restart: '1G',
      restart_delay: 4000,
      max_restarts: 10,
      min_uptime: '10s'
    }]
  };
  
  const ecosystemPath = path.join(__dirname, '..', 'ecosystem.config.js');
  fs.writeFileSync(ecosystemPath, `module.exports = ${JSON.stringify(ecosystemConfig, null, 2)}`);
  
  logSuccess('PM2 configuration created');
  logInfo('Use "pm2 start ecosystem.config.js" to start with PM2');
}

// Interactive setup
async function interactiveSetup() {
  logStep('SETUP', 'Starting interactive setup...');
  
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  const question = (prompt) => new Promise(resolve => rl.question(prompt, resolve));
  
  try {
    logInfo('Configure your Pegasus bot:');
    
    const botToken = await question('Enter your bot token: ');
    const clientId = await question('Enter your client ID: ');
    const databaseUrl = await question('Enter your database URL: ');
    const nodeEnv = await question('Environment (development/production) [development]: ') || 'development';
    
    const envContent = `# Bot Configuration
BOT_TOKEN=${botToken}
CLIENT_ID=${clientId}

# Database Configuration  
DATABASE_URL=${databaseUrl}

# Application Configuration
NODE_ENV=${nodeEnv}
LOG_LEVEL=info
HEALTH_CHECK_PORT=3000

# Feature Flags
ENABLE_MONITORING=true
ENABLE_ANALYTICS=true`;
    
    const envPath = path.join(__dirname, '..', '.env');
    fs.writeFileSync(envPath, envContent);
    
    logSuccess('Configuration saved to .env file');
  } finally {
    rl.close();
  }
}

// Main startup logic
async function startBot() {
  logStep('START', 'Starting bot application...');
  
  log('');
  log('═══════════════════════════════════════════════════════════════', 'bright');
  log('                    PEGASUS DISCORD BOT                        ', 'bright');
  log('═══════════════════════════════════════════════════════════════', 'bright');
  log('');
  
  const totalTime = Date.now() - metrics.startTime;
  logInfo(`Startup completed in ${totalTime}ms`);
  
  if (flags.verbose) {
    logInfo('Startup stages:');
    Object.entries(metrics.stages).forEach(([stage, data]) => {
      if (data.duration) {
        logInfo(`  ${stage}: ${data.duration}ms`);
      }
    });
  }
  
  logInfo(`Memory usage: ${metrics.memory.heapUsed}MB heap, ${metrics.memory.rss}MB RSS`);
  logSuccess('All checks passed. Starting bot...');
  log('');
  
  if (process.env.ENABLE_MONITORING === 'true') {
    await createHealthCheck();
  }
  
  if (flags.pm2) {
    logInfo('Starting with PM2 process manager...');
    await executeCommand('pm2 start ecosystem.config.js', 'Starting with PM2');
  } else if (flags.prod) {
    logInfo('Starting in production mode...');
    const botProcess = spawn('node', ['dist/index.js'], {
      stdio: 'inherit',
      env: { ...process.env, NODE_ENV: 'production' }
    });
    
    botProcess.on('error', (error) => {
      logError(`Bot process error: ${error.message}`);
    });
  } else {
    logInfo('Starting in development mode...');
    const botProcess = spawn('npx', ['ts-node', '--transpile-only', 'src/index.ts'], {
      stdio: 'inherit',
      env: { ...process.env, NODE_ENV: 'development' }
    });
    
    botProcess.on('error', (error) => {
      logError(`Bot process error: ${error.message}`);
    });
  }
}

// Main execution flow
async function main() {
  collectSystemMetrics();
  
  if (flags.help) {
    showHelp();
    return;
  }
  
  log('');
  log('🚀 Pegasus Bot Production Startup Script', 'bright');
  log('─────────────────────────────────────────', 'bright');
  log('');
  
  logInfo(`Mode: ${flags.prod ? 'Production' : 'Development'}`);
  logInfo(`Platform: ${os.platform()} ${os.arch()}`);
  logInfo(`Node.js: ${process.version}`);
  logInfo(`Process Manager: ${flags.pm2 ? 'PM2' : 'Built-in'}`);
  log('');
  
  try {
    if (!flags.skipChecks) {
      startTimer('preflight');
      await validateNodeVersion();
      await validateEnvironment();
      await checkSystemRequirements();
      endTimer('preflight');
    }
    
    startTimer('database');
    await testDatabaseConnectivity();
    await ensureDatabaseExists();
    
    if (!flags.checkOnly) {
      await runMigrations();
    }
    endTimer('database');
    
    if (flags.checkOnly) {
      logSuccess('All pre-flight checks passed!');
      return;
    }
    
    if (flags.migrateOnly) {
      logSuccess('Database migrations completed!');
      return;
    }
    
    startTimer('build');
    await checkDependencies();
    await buildProject();
    await copyAssets();
    endTimer('build');
    
    if (flags.prod || flags.pm2) {
      await setupPM2();
    }
    
    await startBot();
    
  } catch (error) {
    const stage = error.stage || 'UNKNOWN';
    logError('Startup failed. Check the logs above for details.');
    
    if (error.recovery) {
      logInfo(`Recovery suggestion: ${error.recovery}`);
    }
    
    if (flags.verbose) {
      console.error(error.stack);
    }
    
    process.exit(1);
  }
}

// Signal handlers
process.on('SIGINT', () => {
  log('\n');
  logWarning('Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  log('\n');
  logWarning('Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  logError(`Uncaught exception: ${error.message}`);
  if (flags.verbose) {
    console.error(error.stack);
  }
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logError(`Unhandled rejection at: ${promise}, reason: ${reason}`);
  process.exit(1);
});

// Run the startup script
main().catch(error => {
  logError(`Unexpected error: ${error.message}`);
  if (flags.verbose) {
    console.error(error.stack);
  }
  process.exit(1);
});
