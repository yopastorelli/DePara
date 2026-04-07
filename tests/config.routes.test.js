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
  let app;

  beforeEach(() => {
    jest.resetModules();
    tempDir = createTempDir();
    process.env.DEPARA_DATA_DIR = tempDir;
    process.env.DEPARA_CONFIG_FILE = path.join(tempDir, 'depara-config.json');
    app = buildApp();
  });

  afterEach(async () => {
    delete process.env.DEPARA_DATA_DIR;
    delete process.env.DEPARA_CONFIG_FILE;
    await cleanupDir(tempDir);
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
});
