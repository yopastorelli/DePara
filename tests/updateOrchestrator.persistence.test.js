const fs = require('fs');
const fsp = require('fs').promises;
const os = require('os');
const path = require('path');

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

function createTempRepo() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'depara-update-'));
}

async function cleanupDir(dirPath) {
  await fsp.rm(dirPath, { recursive: true, force: true });
}

describe('UpdateOrchestrator persistence layout', () => {
  let repoRoot;
  let dataDir;
  let legacyDataDir;
  let orchestrator;

  beforeEach(() => {
    jest.resetModules();
    repoRoot = createTempRepo();
    dataDir = path.join(repoRoot, 'data');
    legacyDataDir = path.join(repoRoot, 'src', 'data');
    process.env.DEPARA_DATA_DIR = dataDir;
    orchestrator = require('../src/services/updateOrchestrator');

    orchestrator.repoRoot = repoRoot;
    orchestrator.dataDir = dataDir;
    orchestrator.legacyDataDir = legacyDataDir;
    orchestrator.configPath = path.join(dataDir, 'update-config.json');
    orchestrator.statePath = path.join(dataDir, 'update-state.json');
    orchestrator.historyPath = path.join(dataDir, 'update-history.log');
    orchestrator.lockPath = path.join(dataDir, 'update.lock');
    orchestrator.isInitialized = false;
    orchestrator.timer = null;

    jest.spyOn(orchestrator, 'getCurrentCommitSafe').mockResolvedValue('abc1234');
    jest.spyOn(orchestrator, 'cleanupStaleLock').mockResolvedValue(undefined);
    jest.spyOn(orchestrator, 'setupScheduler').mockImplementation(() => {});
  });

  afterEach(async () => {
    if (orchestrator?.timer) {
      clearInterval(orchestrator.timer);
    }
    jest.restoreAllMocks();
    delete process.env.DEPARA_DATA_DIR;
    await cleanupDir(repoRoot);
  });

  it('stores update files under data/', async () => {
    await orchestrator.init();

    expect(fs.existsSync(path.join(dataDir, 'update-config.json'))).toBe(true);
    expect(fs.existsSync(path.join(dataDir, 'update-state.json'))).toBe(true);
    expect(fs.existsSync(path.join(dataDir, 'update-history.log'))).toBe(true);
  });

  it('migrates legacy src/data files when new targets do not exist', async () => {
    await fsp.mkdir(legacyDataDir, { recursive: true });
    await fsp.writeFile(path.join(legacyDataDir, 'update-config.json'), JSON.stringify({
      enabled: false,
      autoApply: false,
      checkIntervalMinutes: 15
    }), 'utf8');

    await orchestrator.init();

    const migratedConfig = JSON.parse(await fsp.readFile(path.join(dataDir, 'update-config.json'), 'utf8'));
    expect(migratedConfig.enabled).toBe(false);
    expect(migratedConfig.autoApply).toBe(false);
    expect(migratedConfig.checkIntervalMinutes).toBe(15);
  });
});
