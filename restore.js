const fs = require('fs/promises');
const { constants } = require('fs');
const path = require('path');
const os = require('os');
const { loadEnvFile } = require('node:process');
const readline = require('readline/promises'); // Using modern Promise API

const MAX_DISPLAY_BACKUPS = 10;

// 1. Safely load the configuration
try {
    loadEnvFile(path.join(__dirname, 'config.env'));
} catch (err) {
    console.error(`[Error] Failed to load config.env: ${err.message}`);
    process.exit(1);
}

// 2. Helper function to resolve paths (handles '~' expansion)
const resolvePath = (p) => {
    if (!p) return '';
    if (p.startsWith('~/') || p === '~') {
        return path.join(os.homedir(), p.slice(1));
    }
    return path.resolve(p);
};

// 3. Environment validation
const requiredVars = ['BACKUP_DIR', 'MAX_BACKUPS', 'SOURCE_PATH'];
const missingVars = requiredVars.filter(key => !process.env[key]);

if (missingVars.length > 0) {
    console.error(`[Error] Missing required environment variables: ${missingVars.join(', ')}`);
    console.error(`[Error] Please check your config.env file.`);
    process.exit(1);
}

const config = {
    backupDir: resolvePath(process.env.BACKUP_DIR),
    maxBackups: parseInt(process.env.MAX_BACKUPS, 10),
    sourcePath: resolvePath(process.env.SOURCE_PATH),
    saveBasename: path.basename(process.env.SOURCE_PATH, path.extname(process.env.SOURCE_PATH)),
    saveExtension: path.extname(process.env.SOURCE_PATH)
};

if (isNaN(config.maxBackups) || config.maxBackups <= 0) {
    console.error(`[Error] MAX_BACKUPS must be a positive integer.`);
    process.exit(1);
}

// 4. Main asynchronous logic
async function main() {
    // Check if the backup directory exists and is readable
    try {
        await fs.access(config.backupDir, constants.R_OK);
    } catch {
        console.error(`[Error] Backup directory does not exist or is not readable: ${config.backupDir}`);
        process.exit(1);
    }

    // Load and sort files
    const allFiles = await fs.readdir(config.backupDir);
    const validBackups = allFiles
        .filter(file => file.startsWith(`${config.saveBasename}_`) && file.endsWith(config.saveExtension))
        // Lexicographical sorting by filename (accurate due to YYYY-MM-DD_HH-MM-SS format) - saves I/O!
        .sort()
        .reverse();

    if (validBackups.length === 0) {
        console.error(`[Error] No backups found to restore in directory: ${config.backupDir}`);
        process.exit(1);
    }

    const recentFileNames = validBackups.slice(0, Math.min(config.maxBackups, MAX_DISPLAY_BACKUPS));
    
    // Retrieve precise time metadata (stat) only for the items selected for display
    const recentFiles = await Promise.all(recentFileNames.map(async (file) => {
        const filePath = path.join(config.backupDir, file);
        const stats = await fs.stat(filePath);
        return {
            name: file,
            path: filePath,
            time: stats.mtime.getTime()
        };
    }));

    console.log('\n--- AVAILABLE BACKUPS TO RESTORE ---');
    recentFiles.forEach((file, index) => {
        // You can change 'en-US' to 'cs-CZ' if you prefer European date formatting
        const dateStr = new Date(file.time).toLocaleString('en-US');
        console.log(`[${index + 1}] ${file.name}`);
        console.log(`    Backup time: ${dateStr}`);
    });

    // 5. Interactive interface using asynchronous readline
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    try {
        const answer = await rl.question(`\nEnter the backup number to restore (1-${recentFiles.length}) or '0' to cancel: `);
        const choice = parseInt(answer, 10);

        if (choice === 0) {
            console.log('Restore cancelled by user.');
            process.exit(0);
        }

        if (isNaN(choice) || choice < 1 || choice > recentFiles.length) {
            console.error(`[Error] Invalid choice. Please enter a number between 1 and ${recentFiles.length}.`);
            process.exit(1);
        }

        const selectedBackup = recentFiles[choice - 1];
        const targetDir = path.dirname(config.sourcePath);
        
        // Ensure the target directory exists
        await fs.mkdir(targetDir, { recursive: true });

        // Restore the file
        await fs.copyFile(selectedBackup.path, config.sourcePath);
        console.log(`\n[Success] Backup #${choice} successfully restored!`);
        console.log(`[Success] Source: ${selectedBackup.name}`);
        console.log(`[Success] Target: ${config.sourcePath}`);
        
    } catch (err) {
        console.error(`[Error] Failed during restore process: ${err.message}`);
        process.exit(1);
    } finally {
        rl.close();
    }
}

// Run the script with top-level error handling
main().catch(err => {
    console.error(`[Fatal] Unexpected system error: ${err.message}`);
    process.exit(1);
});
