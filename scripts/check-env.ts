// scripts/check-env.ts - Environment Variables Checker
import 'dotenv/config';

console.log('🔍 Checking Environment Variables...\n');

const requiredVars = [
  'DISCORD_BOT_TOKEN',
  'DISCORD_CLIENT_ID', 
  'DATABASE_URL',
  'TARGET_GUILD_ID'
];

const optionalVars = [
  'ADMIN_ROLE_ID',
  'OWNER_ID',
  'PORT',
  'DASHBOARD_PORT',
  'WEBSOCKET_PORT',
  'LOG_LEVEL',
  'NODE_ENV'
];

let hasErrors = false;

console.log('✅ Required Variables:');
requiredVars.forEach(varName => {
  const value = process.env[varName];
  if (value) {
    // Mask sensitive tokens
    const displayValue = varName.includes('TOKEN') ? 
      `${value.substring(0, 10)}...${value.substring(value.length - 5)}` : 
      value;
    console.log(`   ✓ ${varName}: ${displayValue}`);
  } else {
    console.log(`   ❌ ${varName}: NOT SET`);
    hasErrors = true;
  }
});

console.log('\n📋 Optional Variables:');
optionalVars.forEach(varName => {
  const value = process.env[varName];
  if (value) {
    console.log(`   ✓ ${varName}: ${value}`);
  } else {
    console.log(`   - ${varName}: not set (using default)`);
  }
});

console.log('\n🔧 Computed Configuration:');
console.log(`   Target Guild ID: ${process.env.TARGET_GUILD_ID || 'NOT SET'}`);
console.log(`   WebSocket Port: ${process.env.WEBSOCKET_PORT || '3002'}`);
console.log(`   Log Level: ${process.env.LOG_LEVEL || 'info'}`);
console.log(`   Node Environment: ${process.env.NODE_ENV || 'development'}`);

if (hasErrors) {
  console.log('\n❌ Missing required environment variables!');
  console.log('Please create a .env file with the required variables.');
  process.exit(1);
} else {
  console.log('\n✅ All required environment variables are set!');
}