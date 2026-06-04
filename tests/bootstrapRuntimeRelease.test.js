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

  it('creates config.env with runtime defaults when absent', async () => {
    const createdPath = await bootstrapModule.ensureRuntimeConfigFile(runtimeRoot);
    const content = await fsp.readFile(createdPath, 'utf8');

    expect(createdPath).toBe(configPath);
    expect(content).toContain('PORT=3000');
    expect(content).toContain('NODE_ENV=production');
    expect(content).toContain('LOG_LEVEL=warn');
    expect(content).toContain('LOG_TO_CONSOLE=false');
    expect(content).toContain(`DEPARA_RUNTIME_ROOT=${runtimeRoot}`);
  });
});
