const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');

const { defineConfig } = require('@playwright/test');

const runtimeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'depara-e2e-'));
const dataDir = path.join(runtimeRoot, 'data');
const logsDir = path.join(runtimeRoot, 'logs');
const backupDir = path.join(runtimeRoot, 'backups');
const tempDir = path.join(runtimeRoot, 'temp');
const fixturesDir = path.join(runtimeRoot, 'fixtures');
const imagesDir = path.join(fixturesDir, 'images');
const layoutImagesDir = path.join(fixturesDir, 'layout-images');
const foldersDir = path.join(fixturesDir, 'folders');

fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(logsDir, { recursive: true });
fs.mkdirSync(backupDir, { recursive: true });
fs.mkdirSync(tempDir, { recursive: true });
fs.mkdirSync(imagesDir, { recursive: true });
fs.mkdirSync(layoutImagesDir, { recursive: true });
fs.mkdirSync(foldersDir, { recursive: true });
fs.mkdirSync(path.join(foldersDir, 'entrada'), { recursive: true });
fs.mkdirSync(path.join(foldersDir, 'saida'), { recursive: true });
fs.mkdirSync(path.join(foldersDir, 'source'), { recursive: true });
fs.mkdirSync(path.join(foldersDir, 'target'), { recursive: true });

const pngBuffer = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9sMVMX8AAAAASUVORK5CYII=',
  'base64'
);

fs.writeFileSync(path.join(imagesDir, 'fixture-1.png'), pngBuffer);
fs.writeFileSync(path.join(imagesDir, 'fixture-2.png'), pngBuffer);
function createPngChunk(type, data) {
  const body = Buffer.concat([Buffer.from(type), data]);
  let checksum = 0xffffffff;
  for (const byte of body) {
    checksum ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      checksum = (checksum >>> 1) ^ ((checksum & 1) ? 0xedb88320 : 0);
    }
  }
  const chunk = Buffer.alloc(data.length + 12);
  chunk.writeUInt32BE(data.length, 0);
  body.copy(chunk, 4);
  chunk.writeUInt32BE((checksum ^ 0xffffffff) >>> 0, chunk.length - 4);
  return chunk;
}

function createLayoutPng(width, height) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;
  const stride = width * 3 + 1;
  const pixels = Buffer.alloc(stride * height);
  const rowBuffer = Buffer.alloc(width * 3);
  for (let rowIndex = 0; rowIndex < height; rowIndex += 1) {
    const color = rowIndex < height / 8 ? [222, 97, 83]
      : rowIndex > height * 7 / 8 ? [86, 212, 177] : [22, 50, 79];
    for (let column = 0; column < width; column += 1) {
      rowBuffer[column * 3] = color[0];
      rowBuffer[column * 3 + 1] = color[1];
      rowBuffer[column * 3 + 2] = color[2];
    }
    rowBuffer.copy(pixels, rowIndex * stride + 1);
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    createPngChunk('IHDR', header),
    createPngChunk('IDAT', zlib.deflateSync(pixels)),
    createPngChunk('IEND', Buffer.alloc(0))
  ]);
}

for (const fixture of [
  { name: '01-retrato.png', width: 1200, height: 1800 },
  { name: '02-paisagem.png', width: 2400, height: 1200 },
  { name: '03-panoramica-com-nome-longo-para-validar-a-responsividade.png', width: 3200, height: 600 }
]) {
  fs.writeFileSync(path.join(layoutImagesDir, fixture.name), createLayoutPng(fixture.width, fixture.height));
}
fs.writeFileSync(path.join(foldersDir, 'entrada', 'sample.txt'), 'fixture-file', 'utf8');
fs.writeFileSync(path.join(foldersDir, 'source', 'sample.txt'), 'fixture-file', 'utf8');

process.env.DEPARA_E2E_ROOT = runtimeRoot;
process.env.DEPARA_E2E_IMAGES_DIR = imagesDir;
process.env.DEPARA_E2E_LAYOUT_IMAGES_DIR = layoutImagesDir;
process.env.DEPARA_E2E_FOLDERS_DIR = foldersDir;
process.env.DEPARA_E2E_FILEOPS_ROOT = foldersDir;

module.exports = defineConfig({
  testDir: './tests/e2e',
  timeout: 60000,
  retries: 0,
  workers: 1,
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
      DEPARA_RUNTIME_ROOT: runtimeRoot,
      DEPARA_CONFIG_ENV_PATH: path.join(runtimeRoot, 'config.env'),
      LOG_FILE: path.join(logsDir, 'app.log'),
      DEPARA_DATA_DIR: dataDir,
      DEPARA_CONFIG_FILE: path.join(dataDir, 'depara-config.json'),
      DEPARA_LOG_DIR: logsDir,
      DEPARA_BACKUP_DIR: backupDir,
      DEPARA_TEMP_DIR: tempDir,
      DEPARA_MEMORY_WARN_MB: '256',
      DEPARA_MEMORY_CRITICAL_MB: '128',
      DEPARA_MAX_RSS_MB: '1024',
      DEPARA_DISABLE_UPDATE_SIDE_EFFECTS: 'true',
      DEPARA_DISABLE_UPDATE_SCHEDULER: 'true'
    }
  }
});
