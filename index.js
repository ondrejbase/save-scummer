const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { loadEnvFile } = require('node:process');

// 1. Load environment variables
try {
    loadEnvFile(path.join(__dirname, 'config.env'));
} catch (err) {
    console.error(`[Error] Failed to load config.env: ${err.message}`);
    process.exit(1);
}

// 2. Validate and parse environment variables
const requiredVars = [
    'BACKUP_DIR', 
    'BACKUP_INTERVAL_MS', 
    'GAME_EXECUTABLE', 
    'MAX_BACKUPS', 
    'SOURCE_PATH'
];

const missingVars = requiredVars.filter(key => !process.env[key]);
if (missingVars.length > 0) {
    console.error(`[Error] Missing required environment variables: ${missingVars.join(', ')}`);
    console.error(`[Error] Please check your config.env file.`);
    process.exit(1);
}

const config = {
    backupDir: process.env.BACKUP_DIR,
    backupIntervalMs: parseInt(process.env.BACKUP_INTERVAL_MS, 10),
    gameExecutable: process.env.GAME_EXECUTABLE,
    maxBackups: parseInt(process.env.MAX_BACKUPS, 10),
    sourcePath: process.env.SOURCE_PATH,
    saveBasename: path.basename(process.env.SOURCE_PATH, '.sv')
};

// Validate numeric constraints
if (isNaN(config.backupIntervalMs) || config.backupIntervalMs <= 0) {
    console.error(`[Error] BACKUP_INTERVAL_MS must be a positive integer.`);
    process.exit(1);
}

if (isNaN(config.maxBackups) || config.maxBackups <= 0) {
    console.error(`[Error] MAX_BACKUPS must be a positive integer.`);
    process.exit(1);
}

// 3. Helper function: Generate a readable local timestamp (e.g., 2026-07-14_15-41-25)
function getLocalTimestamp() {
    const now = new Date();
    const pad = (num) => num.toString().padStart(2, '0');
    
    const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const time = `${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
    
    return `${date}_${time}`;
}

// 4. Ensure the backup directory exists
if (!fs.existsSync(config.backupDir)) {
    fs.mkdirSync(config.backupDir, { recursive: true });
}

// 5. Function to handle the backup process
function backupSaveFile() {
    if (!fs.existsSync(config.sourcePath)) {
        console.log(`[Backup] Source save file ${config.sourcePath} does not exist yet. Waiting...`);
        return;
    }

    const timestamp = getLocalTimestamp();
    const backupFileName = `${config.saveBasename}_${timestamp}.sv`;
    const backupFilePath = path.join(config.backupDir, backupFileName);

    try {
        fs.copyFileSync(config.sourcePath, backupFilePath);
        console.log(`[Backup] Successfully created: ${backupFileName}`);
    } catch (err) {
        console.error(`[Backup] Failed to create backup: ${err.message}`);
        return;
    }

    cleanOldBackups();
}

// 6. Function to maintain only the latest N backups
function cleanOldBackups() {
    const files = fs.readdirSync(config.backupDir)
        .filter(file => file.startsWith(`${config.saveBasename}_`) && file.endsWith('.sv'))
        .map(file => {
            const filePath = path.join(config.backupDir, file);
            return {
                name: file,
                path: filePath,
                time: fs.statSync(filePath).mtime.getTime() 
            };
        })
        .sort((a, b) => b.time - a.time); // Sort descending (newest first)

    // Remove older files if we exceed the limit
    if (files.length > config.maxBackups) {
        const filesToDelete = files.slice(config.maxBackups);
        filesToDelete.forEach(file => {
            try {
                fs.unlinkSync(file.path);
                console.log(`[Cleanup] Deleted old backup: ${file.name}`);
            } catch (err) {
                console.error(`[Cleanup] Failed to delete ${file.name}: ${err.message}`);
            }
        });
    }
}

// 7. Start the game process
console.log(`[System] Launching ${config.gameExecutable}...`);
const gameProcess = spawn(config.gameExecutable, [], { stdio: 'inherit' });

// Create the first backup immediately upon script launch
backupSaveFile();

// Set up the recurring backup interval
const backupInterval = setInterval(backupSaveFile, config.backupIntervalMs);

// 8. Handle game exit or launch errors
gameProcess.on('close', (code) => {
    console.log(`[System] ${config.gameExecutable} has closed (Code: ${code}). Stopping backups and exiting script.`);
    clearInterval(backupInterval);
    process.exit(0);
});

gameProcess.on('error', (err) => {
    console.error(`[Error] Failed to launch the game. Please verify GAME_EXECUTABLE path.`);
    console.error(`[Error] Details: ${err.message}`);
    clearInterval(backupInterval);
    process.exit(1);
});
