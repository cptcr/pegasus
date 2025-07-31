import { config } from '../config';
import { Pool } from 'pg';
import { MigrationRunner } from './migrations';

async function main() {
  const command = process.argv[2] || 'up';
  const target = process.argv[3] ? parseInt(process.argv[3]) : undefined;
  
  const pool = new Pool(config.getDatabaseConfig());
  const runner = new MigrationRunner(pool);
  
  try {
    await runner.initialize();
    
    switch (command) {
      case 'up':
      case 'migrate':
        console.log('Running migrations...');
        await runner.migrate(target);
        console.log('Migrations completed successfully');
        break;
        
      case 'down':
      case 'rollback':
        console.log('Rolling back migrations...');
        const currentVersion = await runner.getCurrentVersion();
        const rollbackTo = target ?? Math.max(0, currentVersion - 1);
        await runner.migrate(rollbackTo);
        console.log(`Rolled back to version ${rollbackTo}`);
        break;
        
      case 'status':
        const status = await runner.status();
        console.log('\nMigration Status:');
        console.log('=================');
        
        if (status.applied.length === 0) {
          console.log('No migrations have been applied yet.');
        } else {
          console.log('\nApplied migrations:');
          status.applied.forEach(m => {
            console.log(`  ✓ ${m.version}: ${m.name}`);
          });
        }
        
        if (status.pending.length > 0) {
          console.log('\nPending migrations:');
          status.pending.forEach(m => {
            console.log(`  ○ ${m.version}: ${m.name}`);
          });
        } else {
          console.log('\nNo pending migrations.');
        }
        break;
        
      default:
        console.error(`Unknown command: ${command}`);
        console.log('Usage: npm run migrate [up|down|status] [version]');
        process.exit(1);
    }
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();