const { spawn } = require('node:child_process');
const fs = require('node:fs/promises');
const { constants } = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { loadEnvFile } = require('node:process');

// 1. Safely load the configuration
try {
    loadEnvFile(path.join(__dirname, 'config.env'));
} catch (err) {
    console.error(`[Error] Failed to load config.env: ${err.message}`);
    process.exit(1);
}

// 2. Helper function to safely resolve paths (including '~' home directory expansion)
const resolvePath = (p) => {
    if (!p) return '';
    if (p.startsWith('~/') || p === '~') {
        return path.join(os.homedir(), p.slice(1));
    }
    return path.resolve(p);
};

// 3. Environment validation and configuration mapping
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

function expandEnvVars(pathStr) {
    return pathStr.replace(/%([^%]+)%/g, (_, name) => process.env[name] || '');
}

const config = {
    backupDir: resolvePath(expandEnvVars(process.env.BACKUP_DIR)),
    sourcePath: resolvePath(expandEnvVars(process.env.SOURCE_PATH)),
    gameExecutable: resolvePath(expandEnvVars(process.env.GAME_EXECUTABLE)),
    backupIntervalMs: parseInt(process.env.BACKUP_INTERVAL_MS, 10),
    maxBackups: parseInt(process.env.MAX_BACKUPS, 10),
    saveBasename: path.basename(expandEnvVars(process.env.SOURCE_PATH), path.extname(expandEnvVars(process.env.SOURCE_PATH))),
    saveExtension: path.extname(expandEnvVars(process.env.SOURCE_PATH))
};

if (isNaN(config.backupIntervalMs) || config.backupIntervalMs <= 0) {
    console.error(`[Error] BACKUP_INTERVAL_MS must be a positive integer.`);
    process.exit(1);
}

if (isNaN(config.maxBackups) || config.maxBackups <= 0) {
    console.error(`[Error] MAX_BACKUPS must be a positive integer.`);
    process.exit(1);
}

// 4. Timestamp formatting
const getLocalTimestamp = () => {
    const now = new Date();
    const pad = (num) => String(num).padStart(2, '0');
    
    const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const time = `${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
    
    return `${date}_${time}`;
};

// 5. Encapsulate backup logic within a class
class BackupManager {
    constructor(cfg) {
        this.config = cfg;
        this.intervalId = null;
    }

    async init() {
        try {
            await fs.mkdir(this.config.backupDir, { recursive: true });
        } catch (err) {
            console.error(`[Error] Failed to create backup directory: ${err.message}`);
            process.exit(1);
        }
    }

    async backup() {
        try {
            // Asynchronous and more efficient file existence check
            try {
                await fs.access(this.config.sourcePath, constants.F_OK);
            } catch {
                console.log(`[Backup] Source save file ${this.config.sourcePath} does not exist yet. Waiting...`);
                return;
            }

            const timestamp = getLocalTimestamp();
            const backupFileName = `${this.config.saveBasename}_${timestamp}${this.config.saveExtension}`;
            const backupFilePath = path.join(this.config.backupDir, backupFileName);

            await fs.copyFile(this.config.sourcePath, backupFilePath);
            console.log(`[Backup] Successfully created: ${backupFileName}`);
            
            await this.cleanOldBackups();
        } catch (err) {
            console.error(`[Backup] Failed to create backup: ${err.message}`);
        }
    }

    async cleanOldBackups() {
        try {
            const files = await fs.readdir(this.config.backupDir);
            
            const backupFiles = files
                .filter(f => f.startsWith(`${this.config.saveBasename}_`) && f.endsWith(this.config.saveExtension))
                // The timestamp in the filename ensures lexicographical sorting matches creation time sorting.
                // This saves I/O operations as we don't need to call fs.stat().
                .sort()
                .reverse(); // Newest first

            if (backupFiles.length > this.config.maxBackups) {
                const filesToDelete = backupFiles.slice(this.config.maxBackups);
                
                // Delete surplus backups concurrently
                await Promise.all(filesToDelete.map(async (file) => {
                    try {
                        await fs.unlink(path.join(this.config.backupDir, file));
                        console.log(`[Cleanup] Deleted old backup: ${file}`);
                    } catch (err) {
                        console.error(`[Cleanup] Failed to delete ${file}: ${err.message}`);
                    }
                }));
            }
        } catch (err) {
            console.error(`[Cleanup] Failed to read directory: ${err.message}`);
        }
    }

    start() {
        this.backup(); // Trigger the first backup immediately
        this.intervalId = setInterval(() => this.backup(), this.config.backupIntervalMs);
    }

    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }
}

// 6. Asynchronous main entry point
async function main() {
    const backupManager = new BackupManager(config);
    await backupManager.init();

    console.log(`[System] Launching ${config.gameExecutable}...`);
    const gameProcess = spawn(config.gameExecutable, [], { stdio: 'inherit' });

    backupManager.start();

    gameProcess.on('close', (code) => {
        console.log(`[System] Game closed (Code: ${code}). Stopping backups and exiting script.`);
        backupManager.stop();
        // Pass the game's exit code to the Node.js process
        process.exit(code === null ? 0 : code);
    });

    gameProcess.on('error', (err) => {
        console.error(`[Error] Failed to launch the game. Please verify GAME_EXECUTABLE path.`);
        console.error(`[Error] Details: ${err.message}`);
        backupManager.stop();
        process.exit(1);
    });
}

// Initialize the script with top-level error handling
main().catch(err => {
    console.error(`[Fatal] Unexpected system error: ${err.message}`);
    process.exit(1);
});
