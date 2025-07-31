import { BackupManager } from './backup';
import { config } from '../config';

async function main() {
  const command = process.argv[2];
  const backupManager = new BackupManager();
  
  try {
    switch (command) {
      case 'create':
        console.log('Creating backup...');
        const backupPath = await backupManager.performBackup();
        console.log(`Backup created successfully: ${backupPath}`);
        break;
        
      case 'restore':
        const backupName = process.argv[3];
        if (!backupName) {
          console.error('Please provide a backup file name');
          console.log('Usage: npm run restore <backup-file-name>');
          process.exit(1);
        }
        
        console.log(`Restoring from backup: ${backupName}`);
        console.log('WARNING: This will overwrite current data. Press Ctrl+C to cancel.');
        
        // Give user 5 seconds to cancel
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        await backupManager.restoreBackup(backupName);
        console.log('Backup restored successfully');
        break;
        
      case 'list':
        const backups = await backupManager.listBackups();
        
        if (backups.length === 0) {
          console.log('No backups found.');
        } else {
          console.log('\nAvailable backups:');
          console.log('==================');
          backups.forEach(backup => {
            const sizeMB = (backup.size / 1024 / 1024).toFixed(2);
            console.log(`  ${backup.name} (${sizeMB} MB) - Created: ${backup.created.toLocaleString()}`);
          });
        }
        break;
        
      default:
        console.error(`Unknown command: ${command}`);
        console.log('Usage:');
        console.log('  npm run backup              - Create a new backup');
        console.log('  npm run backup list         - List available backups');
        console.log('  npm run restore <filename>  - Restore from a backup');
        process.exit(1);
    }
  } catch (error) {
    console.error('Backup operation failed:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

main();