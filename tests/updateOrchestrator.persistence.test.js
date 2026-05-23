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
  let runtimeRoot;
  let releasesDir;
  let currentDir;
  let legacyDataDir;
  let orchestrator;

  beforeEach(() => {
    jest.resetModules();
    repoRoot = createTempRepo();
    runtimeRoot = path.join(repoRoot, '.runtime');
    dataDir = path.join(runtimeRoot, 'data');
    releasesDir = path.join(runtimeRoot, 'releases');
    currentDir = path.join(runtimeRoot, 'current');
    legacyDataDir = path.join(repoRoot, 'src', 'data');
    process.env.DEPARA_RUNTIME_ROOT = runtimeRoot;
    process.env.DEPARA_DATA_DIR = dataDir;
    process.env.DEPARA_RELEASES_DIR = releasesDir;
    process.env.DEPARA_CURRENT_DIR = currentDir;
    process.env.DEPARA_UPDATE_SOURCE_ROOT = repoRoot;
    orchestrator = require('../src/services/updateOrchestrator');

    orchestrator.repoRoot = repoRoot;
    orchestrator.runtimeRoot = runtimeRoot;
    orchestrator.dataDir = dataDir;
    orchestrator.legacyDataDir = legacyDataDir;
    orchestrator.legacyRepoDataDir = path.join(repoRoot, 'data');
    orchestrator.releasesDir = releasesDir;
    orchestrator.currentDir = currentDir;
    orchestrator.currentEntryPath = path.join(currentDir, 'src', 'main.js');
    orchestrator.currentReleaseMetaPath = path.join(currentDir, 'release.json');
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
    delete process.env.DEPARA_ALLOW_SYSTEMD_FALLBACK;
    delete process.env.DEPARA_RUNTIME_ROOT;
    delete process.env.DEPARA_DATA_DIR;
    delete process.env.DEPARA_RELEASES_DIR;
    delete process.env.DEPARA_CURRENT_DIR;
    delete process.env.DEPARA_UPDATE_SOURCE_ROOT;
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

  it('fails fast when pm2 exists but the canonical process is not registered', async () => {
    jest.spyOn(orchestrator, 'isPm2Available').mockResolvedValue(true);
    jest.spyOn(orchestrator, 'isPm2ProcessRegistered').mockResolvedValue(false);
    jest.spyOn(orchestrator, 'isSystemctlAvailable').mockResolvedValue(true);
    const restartViaSystemdSpy = jest.spyOn(orchestrator, 'restartViaSystemd').mockResolvedValue(true);

    await expect(orchestrator.requestRestart()).rejects.toThrow('Processo PM2 canônico não está registrado');

    expect(orchestrator.isPm2ProcessRegistered).toHaveBeenCalledWith('DePara');
    expect(restartViaSystemdSpy).not.toHaveBeenCalled();
  });

  it('allows explicit legacy fallback to systemd when configured', async () => {
    process.env.DEPARA_ALLOW_SYSTEMD_FALLBACK = 'true';
    jest.spyOn(orchestrator, 'isPm2Available').mockResolvedValue(true);
    jest.spyOn(orchestrator, 'isPm2ProcessRegistered').mockResolvedValue(false);
    jest.spyOn(orchestrator, 'isSystemctlAvailable').mockResolvedValue(true);
    const restartViaSystemdSpy = jest.spyOn(orchestrator, 'restartViaSystemd').mockResolvedValue(true);

    await orchestrator.requestRestart();

    expect(restartViaSystemdSpy).toHaveBeenCalledWith('depara.service');
  });

  it('exposes tracked worktree diagnostics in runtime status', async () => {
    orchestrator.config = orchestrator.getDefaultConfig();
    orchestrator.state = orchestrator.getDefaultState();
    jest.spyOn(orchestrator, 'detectSupervisorStatus').mockResolvedValue({
      supervisor: 'pm2',
      operationallyReady: true,
      reasons: []
    });
    jest.spyOn(orchestrator, 'getTrackedWorktreeStatus').mockResolvedValue({
      clean: false,
      entries: ['M README.md', 'M src/public/app.js'],
      summary: 'M README.md, M src/public/app.js'
    });

    const runtime = await orchestrator.getRuntimeStatus();

    expect(runtime.worktree.clean).toBe(false);
    expect(runtime.worktree.entries).toEqual(['M README.md', 'M src/public/app.js']);
    expect(runtime.worktree.summary).toContain('README.md');
  });

  it('creates runtime release metadata and exposes it in runtime status', async () => {
    await orchestrator.init();

    const releasePath = path.join(releasesDir, 'abc1234');
    await fsp.mkdir(releasePath, { recursive: true });
    await orchestrator.writeCurrentReleaseMeta({
      activeRelease: 'abc1234',
      activeCommit: 'abc1234',
      activePath: releasePath,
      previousRelease: null,
      previousCommit: null,
      updatedAt: new Date().toISOString()
    });
    await orchestrator.reconcileReleaseState();

    const runtime = await orchestrator.getRuntimeStatus();

    expect(fs.existsSync(path.join(currentDir, 'src', 'main.js'))).toBe(true);
    expect(fs.existsSync(path.join(currentDir, 'release.json'))).toBe(true);
    expect(runtime.release.current).toBe('abc1234');
    expect(runtime.release.activationState).toBeDefined();
  });
});
