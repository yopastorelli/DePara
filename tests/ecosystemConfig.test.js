'use strict';

const fs = require('fs');
const fsp = fs.promises;
const os = require('os');
const path = require('path');

describe('PM2 ecosystem runtime contract', () => {
  let runtimeRoot;
  let configPath;

  beforeEach(async () => {
    jest.resetModules();
    runtimeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'depara-ecosystem-'));
    configPath = path.join(runtimeRoot, 'config.env');
    await fsp.writeFile(configPath, [
      'HOST=127.0.0.1',
      'PORT=3456',
      'NODE_ENV=production',
      `DEPARA_RUNTIME_ROOT=${runtimeRoot}`
    ].join('\n'), 'utf8');

    process.env.DEPARA_RUNTIME_ROOT = runtimeRoot;
    process.env.DEPARA_CONFIG_ENV_PATH = configPath;
    delete process.env.PORT;
  });

  afterEach(async () => {
    delete process.env.DEPARA_RUNTIME_ROOT;
    delete process.env.DEPARA_CONFIG_ENV_PATH;
    delete process.env.PORT;
    delete process.env.HOST;
    delete process.env.NODE_ENV;
    await fsp.rm(runtimeRoot, { recursive: true, force: true });
  });

  it('uses config.env port in every PM2 environment', () => {
    const ecosystem = require('../ecosystem.config');
    const app = ecosystem.apps[0];

    expect(app.script).toBe(path.join(runtimeRoot, 'current', 'src', 'main.js'));
    expect(app.cwd).toBe(path.join(runtimeRoot, 'current'));
    expect(app.env.PORT).toBe('3456');
    expect(app.env_production.PORT).toBe('3456');
    expect(app.env_development.PORT).toBe('3456');
    expect(app.env_raspberry.PORT).toBe('3456');
  });
});
