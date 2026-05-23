const fs = require('fs');
const fsp = require('fs').promises;
const os = require('os');
const path = require('path');

function createTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'depara-config-store-'));
}

async function cleanupDir(dirPath) {
  await fsp.rm(dirPath, { recursive: true, force: true });
}

describe('configStore', () => {
  let tempDir;
  let sourceRoot;
  let configStore;

  beforeEach(() => {
    jest.resetModules();
    tempDir = createTempDir();
    sourceRoot = path.join(tempDir, 'source-root');
    process.env.DEPARA_DATA_DIR = tempDir;
    process.env.DEPARA_CONFIG_FILE = path.join(tempDir, 'depara-config.json');
    process.env.LOG_FILE = path.join(tempDir, 'logs', 'app.log');
    process.env.DEPARA_UPDATE_SOURCE_ROOT = sourceRoot;
    configStore = require('../src/utils/configStore');
  });

  afterEach(async () => {
    delete process.env.DEPARA_DATA_DIR;
    delete process.env.DEPARA_CONFIG_FILE;
    delete process.env.LOG_FILE;
    delete process.env.DEPARA_UPDATE_SOURCE_ROOT;
    await cleanupDir(tempDir);
  });

  it('creates the config file with defaults', async () => {
    const config = await configStore.ensureConfigFile();

    expect(config.slideshowConfig.interval).toBe(3);
    expect(config.screensaverConfig.enabled).toBe(true);
    expect(config.appSettings.port).toBe(3000);
    expect(fs.existsSync(process.env.DEPARA_CONFIG_FILE)).toBe(true);
  });

  it('merges partial structured updates', async () => {
    await configStore.ensureConfigFile();

    const updated = await configStore.updateConfig({
      slideshowConfig: {
        interval: 9,
        hiddenFolder: '/tmp/hidden'
      },
      appSettings: {
        environment: 'development'
      }
    });

    expect(updated.slideshowConfig.interval).toBe(9);
    expect(updated.slideshowConfig.hiddenFolder).toBe('/tmp/hidden');
    expect(updated.slideshowConfig.preload).toBe(true);
    expect(updated.appSettings.environment).toBe('development');
    expect(updated.appSettings.port).toBe(3000);
  });

  it('supports legacy set-by-key compatibility', async () => {
    await configStore.ensureConfigFile();

    const updated = await configStore.setConfigValue('slideshowSelectedPath', '/photos');

    expect(updated.slideshowSelectedPath).toBe('/photos');
  });

  it('falls back to defaults when the config file is corrupted', async () => {
    await fsp.mkdir(tempDir, { recursive: true });
    await fsp.writeFile(process.env.DEPARA_CONFIG_FILE, '{invalid-json', 'utf8');

    const config = await configStore.getConfig();

    expect(config.slideshowConfig.extensions).toEqual(['.jpg', '.jpeg', '.png', '.gif', '.bmp']);
    expect(config.screensaverConfig.idleMinutes).toBe(3);
  });

  it('migrates legacy config from repo data without overwriting runtime config', async () => {
    const legacyDataDir = path.join(sourceRoot, 'data');
    await fsp.mkdir(legacyDataDir, { recursive: true });
    await fsp.writeFile(path.join(legacyDataDir, 'depara-config.json'), JSON.stringify({
      slideshowSelectedPath: '/legacy/photos',
      slideshowConfig: { interval: 11 }
    }), 'utf8');

    const config = await configStore.getConfig();
    const persistence = await configStore.getPersistenceStatus();

    expect(config.slideshowSelectedPath).toBe('/legacy/photos');
    expect(config.slideshowConfig.interval).toBe(11);
    expect(persistence.migrated).toBe(true);
    expect(persistence.source).toContain(path.join('data', 'depara-config.json'));

    await configStore.saveConfig({
      ...config,
      slideshowSelectedPath: '/runtime/photos'
    });

    const persistedAgain = await configStore.getConfig();
    expect(persistedAgain.slideshowSelectedPath).toBe('/runtime/photos');
  });
});
