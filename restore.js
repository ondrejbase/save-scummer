const fs = require('fs');
const path = require('path');
const { loadEnvFile } = require('node:process');
const readline = require('readline');

const MAX_DISPLAY_BACKUPS = 10; // Limit the number of backups displayed to the user

// 1. Load environment variables
try {
    loadEnvFile(path.join(__dirname, 'config.env'));
} catch (err) {
    console.error(`[Error] Failed to load config.env: ${err.message}`);
    process.exit(1);
}

// 2. Validate environment variables
const requiredVars = [
    'BACKUP_DIR', 
    'MAX_BACKUPS', 
    'SOURCE_PATH'
];

const missingVars = requiredVars.filter(key => !process.env[key]);
if (missingVars.length > 0) {
    console.error(`[Error] Missing required environment variables: ${missingVars.join(', ')}`);
    console.error(`[Error] Please check your config.env file.`);
    process.exit(1);
}

// 3. Parse configuration
const config = {
    backupDir: process.env.BACKUP_DIR,
    maxBackups: parseInt(process.env.MAX_BACKUPS, 10),
    sourcePath: process.env.SOURCE_PATH,
    saveBasename: path.basename(process.env.SOURCE_PATH, '.sv')
};

if (isNaN(config.maxBackups) || config.maxBackups <= 0) {
    console.error(`[Error] MAX_BACKUPS must be a positive integer.`);
    process.exit(1);
}

if (!fs.existsSync(config.backupDir)) {
    console.error(`[Error] Backup directory does not exist: ${config.backupDir}`);
    process.exit(1);
}

// 4. Retrieve and sort backup files
const files = fs.readdirSync(config.backupDir)
    .filter(file => file.startsWith(`${config.saveBasename}_`) && file.endsWith('.sv'))
    .map(file => {
        // Store path in a variable to avoid calling path.join twice
        const filePath = path.join(config.backupDir, file); 
        return {
            name: file,
            path: filePath,
            time: fs.statSync(filePath).mtime.getTime()
        };
    })
    .sort((a, b) => b.time - a.time);

if (files.length === 0) {
    console.error(`[Error] No backups found to restore in directory: ${config.backupDir}`);
    process.exit(1);
}

// Limit the array to the X most recent backups for better readability
const recentFiles = files.slice(0, Math.min(config.maxBackups, MAX_DISPLAY_BACKUPS));

console.log('\n--- AVAILABLE BACKUPS TO RESTORE ---');
recentFiles.forEach((file, index) => {
    // Note: Changed locale to 'en-US' for English formatting. 
    // You can revert to 'cs-CZ' if you prefer Czech date formats.
    const dateStr = new Date(file.time).toLocaleString('en-US');
    console.log(`[${index + 1}] ${file.name}`);
    console.log(`    Backup time: ${dateStr}`);
});

// 5. Interactive terminal interface
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

rl.question(`Enter the backup number to restore (1-${recentFiles.length}) or '0' to cancel: `, (answer) => {
    const choice = parseInt(answer, 10);

    if (choice === 0) {
        console.log('Restore cancelled by user.');
        rl.close();
        process.exit(0);
    }

    if (isNaN(choice) || choice < 1 || choice > recentFiles.length) {
        console.error(`[Error] Invalid choice. Please enter a number between 1 and ${recentFiles.length}.`);
        rl.close();
        process.exit(1);
    }

    // The choice corresponds to the array index (choice 1 = index 0)
    const selectedBackup = recentFiles[choice - 1];
    const targetDir = path.dirname(config.sourcePath);
    
    // Ensure the target directory exists
    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
    }

    // Attempt to restore the backup
    try {
        fs.copyFileSync(selectedBackup.path, config.sourcePath);
        console.log(`\n[Success] Backup #${choice} successfully restored!`);
        console.log(`[Success] Source: ${selectedBackup.name}`);
        console.log(`[Success] Target: ${config.sourcePath}`);
    } catch (err) {
        console.error(`[Error] Failed to copy file: ${err.message}`);
    }

    rl.close();
});
