const express = require('express');
const fs = require('fs');
const fsp = require('fs').promises;
const os = require('os');
const path = require('path');
const request = require('supertest');

jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  operationError: jest.fn(),
  performance: jest.fn(),
  startOperation: jest.fn(),
  endOperation: jest.fn()
}));

function createTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'depara-config-route-'));
}

async function cleanupDir(dirPath) {
  await fsp.rm(dirPath, { recursive: true, force: true });
}

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/config', require('../src/routes/config'));
  return app;
}

describe('Config Routes', () => {
  let tempDir;
  let runtimeRoot;
  let sourceRoot;
  let app;

  beforeEach(() => {
    jest.resetModules();
    runtimeRoot = createTempDir();
    tempDir = path.join(runtimeRoot, 'data');
    sourceRoot = path.join(runtimeRoot, 'source-root');
    process.env.DEPARA_RUNTIME_ROOT = runtimeRoot;
    process.env.DEPARA_DATA_DIR = tempDir;
    process.env.DEPARA_CONFIG_FILE = path.join(tempDir, 'depara-config.json');
    process.env.DEPARA_BACKUP_DIR = path.join(runtimeRoot, 'backups');
    process.env.DEPARA_UPDATE_SOURCE_ROOT = sourceRoot;
    app = buildApp();
  });

  afterEach(async () => {
    delete process.env.DEPARA_RUNTIME_ROOT;
    delete process.env.DEPARA_DATA_DIR;
    delete process.env.DEPARA_CONFIG_FILE;
    delete process.env.DEPARA_BACKUP_DIR;
    delete process.env.DEPARA_UPDATE_SOURCE_ROOT;
    await cleanupDir(runtimeRoot);
  });

  it('GET /api/config returns normalized defaults', async () => {
    const response = await request(app).get('/api/config').expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.config).toHaveProperty('slideshowConfig');
    expect(response.body.config).toHaveProperty('slideshowSelectedPath', '');
    expect(response.body.config).toHaveProperty('screensaverConfig');
    expect(response.body.config).toHaveProperty('appSettings');
  });

  it('POST /api/config accepts legacy key/value payloads', async () => {
    const response = await request(app)
      .post('/api/config')
      .send({ key: 'slideshowSelectedPath', value: '/legacy/path' })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.config.slideshowSelectedPath).toBe('/legacy/path');
  });

  it('POST /api/config persists structured config blocks', async () => {
    const response = await request(app)
      .post('/api/config')
      .send({
        config: {
          slideshowConfig: {
            deletedFolder: '/photos/deleted',
            hiddenFolder: '/photos/hidden'
          },
          appSettings: {
            logDirectory: 'custom-logs/'
          }
        }
      })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.config.slideshowConfig.deletedFolder).toBe('/photos/deleted');
    expect(response.body.config.slideshowConfig.hiddenFolder).toBe('/photos/hidden');
    expect(response.body.config.appSettings.logDirectory).toBe('custom-logs/');

    const persisted = JSON.parse(await fsp.readFile(process.env.DEPARA_CONFIG_FILE, 'utf8'));
    expect(persisted.slideshowConfig.deletedFolder).toBe('/photos/deleted');
  });

  it('GET /api/config/export returns a versioned operational backup', async () => {
    const fileOperationsManager = require('../src/utils/fileOperations');
    const folderManager = require('../src/config/folders');

    await folderManager.init();
    await request(app)
      .post('/api/config')
      .send({
        config: {
          slideshowSelectedPath: '/backup/slideshow',
          appSettings: { logDirectory: 'logs/custom' }
        }
      })
      .expect(200);

    await folderManager.importFolders([
      {
        id: 'folder-export',
        name: 'Export Folder',
        path: path.join(runtimeRoot, 'monitored'),
        type: 'input',
        enabled: true
      }
    ]);

    await fileOperationsManager.replaceScheduledOperations([
      {
        id: 'schedule-export',
        config: {
          name: 'Export Schedule',
          frequency: 'manual',
          action: 'copy',
          sourcePath: '/tmp/source',
          targetPath: '/tmp/target',
          active: true,
          options: {}
        }
      }
    ]);

    const response = await request(app).get('/api/config/export').expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.version).toBe(1);
    expect(response.body.data.config.slideshowSelectedPath).toBe('/backup/slideshow');
    expect(response.body.data.scheduledOperations).toHaveLength(1);
    expect(response.body.data.folders).toHaveLength(1);
  });

  it('POST /api/config/import replaces config, operations and folders from backup', async () => {
    const folderManager = require('../src/config/folders');
    await folderManager.init();

    const response = await request(app)
      .post('/api/config/import')
      .send({
        version: 1,
        exportedAt: '2026-05-23T20:00:00.000Z',
        sourceRuntime: '/runtime/source',
        config: {
          slideshowSelectedPath: '/imported/slideshow',
          slideshowConfig: { interval: 8, extensions: ['.png'] },
          screensaverConfig: { enabled: false, idleMinutes: 10 },
          appSettings: { logDirectory: 'imported-logs/' }
        },
        scheduledOperations: [
          {
            id: 'schedule-import',
            config: {
              name: 'Import Schedule',
              frequency: 'manual',
              action: 'copy',
              sourcePath: '/tmp/source',
              targetPath: '/tmp/target',
              active: true,
              options: {}
            }
          }
        ],
        folders: [
          {
            id: 'folder-import',
            name: 'Import Folder',
            path: path.join(runtimeRoot, 'imported-folder'),
            type: 'input',
            enabled: true
          }
        ]
      })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.summary.scheduledOperationsRestored).toBe(1);
    expect(response.body.data.summary.foldersRestored).toBe(1);

    const configResponse = await request(app).get('/api/config').expect(200);
    expect(configResponse.body.config.slideshowSelectedPath).toBe('/imported/slideshow');

    const persistedFolders = JSON.parse(await fsp.readFile(path.join(tempDir, 'folders.json'), 'utf8'));
    const persistedSchedules = JSON.parse(await fsp.readFile(path.join(tempDir, 'scheduled-operations.json'), 'utf8'));
    expect(persistedFolders).toHaveLength(1);
    expect(persistedSchedules).toHaveLength(1);
  });

  it('POST /api/config/import rejects invalid backup payloads', async () => {
    const response = await request(app)
      .post('/api/config/import')
      .send({ version: 999, config: {}, scheduledOperations: [], folders: [] })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error).toMatch(/Versao de backup nao suportada/i);
  });
});
