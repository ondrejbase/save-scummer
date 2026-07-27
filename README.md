# save-scummer

A universal background tool for automated game save backups and rotation. 

This Node.js script acts as a wrapper for your games. It launches the game, automatically creates timestamped backups of your save file at defined intervals, and safely cleans up old backups to save disk space. Once you exit the game, the script stops automatically.

## Features
* **Automated Backups:** Periodically backs up a target save file while the game process is running.
* **Auto-Rotation:** Keeps only the latest `N` backups and deletes older ones.
* **Process Binding:** Automatically starts the game and stops itself when the game is closed.
* **Zero Dependencies:** Uses only built-in Node.js modules.

## Prerequisites
* [Node.js](https://nodejs.org/) (v20.6.0 or newer is required for native `.env` file loading).

## Setup & Configuration

1. Clone the repository:
   ```bash
   git clone [https://github.com/your-username/save-scummer.git](https://github.com/your-username/save-scummer.git)
   cd save-scummer
   ```

2. Create a `config.env` file in the root directory. Here is an example configuration:

   ```env
   # The executable to launch
   GAME_EXECUTABLE="devilutionx" 
   
   # The save file you want to backup
   SOURCE_PATH="~/.local/share/diasurgical/devilution/single_0.sv"
   
   # Where the backups should be stored
   BACKUP_DIR="~/Games/Diablo/saves-backup"
   
   # Backup interval in milliseconds (e.g., 180000 = 3 minutes)
   BACKUP_INTERVAL_MS=180000
   
   # Maximum number of backups to keep
   MAX_BACKUPS=20
   ```

## Usage

Run the script via Node:

```bash
node index.js
```

The script will launch the game defined in `GAME_EXECUTABLE`, monitor the `SOURCE_PATH`, and begin the backup loop. 

## License
This project is open-source and available under the [MIT License](LICENSE).
