# save-scummer

A universal background tool for automated game save backups and rotation. 

This Node.js script acts as a wrapper for your games. It launches the game, automatically creates timestamped backups of your save file at defined intervals, and safely cleans up old backups to save disk space. Once you exit the game, the script stops automatically.

## Features
* **Automated Backups:** Periodically backs up a target save file while the game process is running.
* **Auto-Rotation:** Keeps only the latest `N` backups and deletes older ones.
* **Process Binding:** Automatically starts the game and stops itself when the game is closed.
* **Interactive Restore:** Includes a CLI utility to easily roll back to previous save states.
* **Zero Dependencies:** Uses only built-in Node.js modules.

## Prerequisites
* [Node.js](https://nodejs.org/) (v20.6.0 or newer is required for native `.env` file loading).

## Setup & Configuration

1. Clone the repository:
   ```bash
   git clone git@github.com:ondrejbase/save-scummer.git
   cd save-scummer
   ```
2. Create your configuration file by copying the provided template:
   ```bash
   cp config.env.example config.env
   ```

3. Open the newly created `config.env` file in a text editor and adjust the variables to match your specific setup:
   ```env
   GAME_EXECUTABLE="devilutionx" 
   SOURCE_PATH="/home/username/.local/share/diasurgical/devilution/single_0.sv"
   BACKUP_DIR="/home/username/Games/Diablo/saves-backup"
   BACKUP_INTERVAL_MS=180000
   MAX_BACKUPS=20
   ```
   *(Note: Ensure you use absolute paths, as relying on `~` for the home directory may cause resolution issues in Node.js).*

## Usage

Run the script via Node:

```bash
node index.js
```

The script will launch the game defined in `GAME_EXECUTABLE`, monitor the `SOURCE_PATH`, and begin the backup loop. 

## Restoring a Backup

If you need to roll back to a previous save state, ensure the game is fully closed first to prevent file access conflicts or data corruption.

**Using the Interactive Restore Tool:**
Run the included restore script from your terminal:
```bash
node restore.js
```
The script will read your `config.env`, display a list of all available backups sorted by date, and prompt you to choose which one to restore. It will automatically copy the chosen backup over your current save file.

**Manual Restore:**
Alternatively, you can manually navigate to your `BACKUP_DIR`, locate the desired timestamped file, and copy it over the file located at your `SOURCE_PATH`.

## License
This project is open-source and available under the [MIT License](LICENSE).
