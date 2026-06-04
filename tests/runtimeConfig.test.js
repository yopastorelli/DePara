const fs = require('fs');
const fsp = require('fs').promises;
const os = require('os');
const path = require('path');

describe('runtimeConfig', () => {
  let runtimeRoot;
  let configPath;

  beforeEach(() => {
    jest.resetModules();
    runtimeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'depara-runtime-config-'));
    configPath = path.join(runtimeRoot, 'config.env');
    process.env.DEPARA_RUNTIME_ROOT = runtimeRoot;
    process.env.DEPARA_CONFIG_ENV_PATH = configPath;
    delete process.env.PORT;
    delete process.env.NODE_ENV;
    delete process.env.LOG_LEVEL;
    delete process.env.LOG_TO_CONSOLE;
  });

  afterEach(async () => {
    delete process.env.DEPARA_RUNTIME_ROOT;
    delete process.env.DEPARA_CONFIG_ENV_PATH;
    delete process.env.PORT;
    delete process.env.NODE_ENV;
    delete process.env.LOG_LEVEL;
    delete process.env.LOG_TO_CONSOLE;
    await fsp.rm(runtimeRoot, { recursive: true, force: true });
  });

  it('loads config.env with defaults when process env is absent', async () => {
    await fsp.writeFile(configPath, 'PORT=4567\nLOG_LEVEL=debug\n', 'utf8');
    const runtimeConfig = require('../src/utils/runtimeConfig');

    const result = runtimeConfig.loadOperationalConfig();

    expect(result.loaded).toBe(true);
    expect(process.env.PORT).toBe('4567');
    expect(process.env.LOG_LEVEL).toBe('debug');
    expect(process.env.NODE_ENV).toBe('production');
    expect(process.env.LOG_TO_CONSOLE).toBe('false');
  });

  it('preserves process env precedence over config.env', async () => {
    process.env.PORT = '9999';
    process.env.LOG_LEVEL = 'error';
    await fsp.writeFile(configPath, 'PORT=4567\nLOG_LEVEL=debug\n', 'utf8');
    const runtimeConfig = require('../src/utils/runtimeConfig');

    runtimeConfig.loadOperationalConfig();

    expect(process.env.PORT).toBe('9999');
    expect(process.env.LOG_LEVEL).toBe('error');
  });
});
