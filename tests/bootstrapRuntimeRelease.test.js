const fs = require('fs');
const fsp = require('fs').promises;
const os = require('os');
const path = require('path');

describe('bootstrap runtime release', () => {
  let runtimeRoot;
  let configPath;
  let bootstrapModule;

  beforeEach(() => {
    jest.resetModules();
    runtimeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'depara-bootstrap-'));
    configPath = path.join(runtimeRoot, 'config.env');
    process.env.DEPARA_RUNTIME_ROOT = runtimeRoot;
    process.env.DEPARA_CONFIG_ENV_PATH = configPath;
    bootstrapModule = require('../bootstrap-runtime-release');
  });

  afterEach(async () => {
    delete process.env.DEPARA_RUNTIME_ROOT;
    delete process.env.DEPARA_CONFIG_ENV_PATH;
    delete process.env.DEPARA_DEFAULT_PORT;
    await fsp.rm(runtimeRoot, { recursive: true, force: true });
  });

  it('generates a wrapper that loads config.env from the active release and starts the server explicitly', () => {
    const wrapper = bootstrapModule.getCurrentWrapperContent();

    expect(wrapper).toContain("const dotenvPath = path.join(meta.activePath, 'node_modules', 'dotenv');");
    expect(wrapper).toContain('const dotenv = require(dotenvPath);');
    expect(wrapper).toContain('dotenv.config({ path: configPath, override: false });');
    expect(wrapper).toContain("typeof app.startServer !== 'function'");
    expect(wrapper).toContain('app.startServer({ registerHandlers: true })');
  });

  it('creates config.env with generic runtime defaults when absent', async () => {
    const createdPath = await bootstrapModule.ensureRuntimeConfigFile(runtimeRoot, {
      platform: 'linux',
      arch: 'x64',
      env: {}
    });
    const content = await fsp.readFile(createdPath, 'utf8');

    expect(createdPath).toBe(configPath);
    expect(content).toContain('HOST=127.0.0.1');
    expect(content).toContain('PORT=3000');
    expect(content).toContain('NODE_ENV=production');
    expect(content).toContain('LOG_LEVEL=warn');
    expect(content).toContain('LOG_TO_CONSOLE=false');
    expect(content).toContain(`DEPARA_RUNTIME_ROOT=${runtimeRoot}`);
  });

  it('creates an RP4 baseline aligned with the PM2 production port', () => {
    const content = bootstrapModule.getRuntimeConfigEnvContent(runtimeRoot, {
      platform: 'linux',
      arch: 'arm64',
      env: {}
    });

    expect(content).toContain('HOST=127.0.0.1');
    expect(content).toContain('PORT=3001');
    expect(content).toContain('PM2_APP_NAME=DePara');
    expect(content).toContain('DEPARA_ALLOW_SYSTEMD_FALLBACK=false');
  });

  it('allows an explicit bootstrap port to override the platform baseline', () => {
    const content = bootstrapModule.getRuntimeConfigEnvContent(runtimeRoot, {
      platform: 'linux',
      arch: 'arm64',
      env: { DEPARA_DEFAULT_PORT: '3555' }
    });

    expect(content).toContain('PORT=3555');
  });
});
