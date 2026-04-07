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

function createTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'depara-update-check-'));
}

async function cleanupDir(dirPath) {
  await fsp.rm(dirPath, { recursive: true, force: true });
}

describe('UpdateOrchestrator passive checks', () => {
  let tempDir;

  beforeEach(() => {
    jest.resetModules();
    tempDir = createTempDir();
    process.env.DEPARA_DATA_DIR = tempDir;
  });

  afterEach(async () => {
    delete process.env.DEPARA_DATA_DIR;
    await cleanupDir(tempDir);
  });

  it('clears stale failure state and re-enables updates when a passive check finds no pending updates', async () => {
    jest.doMock('child_process', () => ({
      exec: jest.fn((command, options, callback) => {
        if (typeof options === 'function') {
          callback = options;
        }

        if (command === 'git fetch origin main --prune') {
          callback(null, '', '');
          return;
        }

        if (command === 'git rev-parse HEAD') {
          callback(null, '190a6204\n', '');
          return;
        }

        if (command === 'git rev-parse origin/main') {
          callback(null, '190a6204\n', '');
          return;
        }

        if (command === 'git rev-list HEAD..origin/main --count') {
          callback(null, '0\n', '');
          return;
        }

        callback(new Error(`Unexpected command: ${command}`), '', `Unexpected command: ${command}`);
      })
    }));

    const orchestrator = require('../src/services/updateOrchestrator');
    orchestrator.state = orchestrator.normalizeState({
      status: 'critical',
      currentCommit: 'old',
      targetCommit: 'old',
      lastError: 'Circuit breaker ativado: [PM2][ERROR] Process or Namespace DePara not found',
      consecutiveFailures: 3,
      rollbackPerformed: true
    });
    orchestrator.config = {
      ...orchestrator.getDefaultConfig(),
      enabled: false
    };
    orchestrator.isInitialized = true;

    const result = await orchestrator.checkForUpdatesInternal({
      passive: true,
      clearDisabledOnClean: true
    });

    expect(result.hasUpdates).toBe(false);
    expect(orchestrator.state.status).toBe('idle');
    expect(orchestrator.state.lastError).toBeNull();
    expect(orchestrator.state.consecutiveFailures).toBe(0);
    expect(orchestrator.state.rollbackPerformed).toBe(false);
    expect(orchestrator.config.enabled).toBe(true);
  });
});
