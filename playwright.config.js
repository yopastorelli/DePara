const fs = require('fs');
const os = require('os');
const path = require('path');

const { defineConfig } = require('@playwright/test');

const runtimeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'depara-e2e-'));
const dataDir = path.join(runtimeRoot, 'data');
const logsDir = path.join(runtimeRoot, 'logs');
const backupDir = path.join(runtimeRoot, 'backups');
const tempDir = path.join(runtimeRoot, 'temp');
const fixturesDir = path.join(runtimeRoot, 'fixtures');
const imagesDir = path.join(fixturesDir, 'images');
const foldersDir = path.join(fixturesDir, 'folders');

fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(logsDir, { recursive: true });
fs.mkdirSync(backupDir, { recursive: true });
fs.mkdirSync(tempDir, { recursive: true });
fs.mkdirSync(imagesDir, { recursive: true });
fs.mkdirSync(foldersDir, { recursive: true });
fs.mkdirSync(path.join(foldersDir, 'entrada'), { recursive: true });
fs.mkdirSync(path.join(foldersDir, 'saida'), { recursive: true });

const pngBuffer = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9sMVMX8AAAAASUVORK5CYII=',
  'base64'
);

fs.writeFileSync(path.join(imagesDir, 'fixture-1.png'), pngBuffer);
fs.writeFileSync(path.join(imagesDir, 'fixture-2.png'), pngBuffer);
fs.writeFileSync(path.join(foldersDir, 'entrada', 'sample.txt'), 'fixture-file', 'utf8');

process.env.DEPARA_E2E_ROOT = runtimeRoot;
process.env.DEPARA_E2E_IMAGES_DIR = imagesDir;
process.env.DEPARA_E2E_FOLDERS_DIR = foldersDir;

module.exports = defineConfig({
  testDir: './tests/e2e',
  timeout: 60000,
  retries: 0,
  fullyParallel: false,
  use: {
    baseURL: 'http://127.0.0.1:3100',
    headless: true
  },
  webServer: {
    command: 'node src/main.js',
    url: 'http://127.0.0.1:3100/health',
    timeout: 120000,
    reuseExistingServer: false,
    env: {
      PORT: '3100',
      NODE_ENV: 'test',
      LOG_FILE: path.join(logsDir, 'app.log'),
      DEPARA_DATA_DIR: dataDir,
      DEPARA_CONFIG_FILE: path.join(dataDir, 'depara-config.json'),
      DEPARA_LOG_DIR: logsDir,
      DEPARA_BACKUP_DIR: backupDir,
      DEPARA_TEMP_DIR: tempDir,
      DEPARA_DISABLE_UPDATE_SIDE_EFFECTS: 'true',
      DEPARA_DISABLE_UPDATE_SCHEDULER: 'true'
    }
  }
});
