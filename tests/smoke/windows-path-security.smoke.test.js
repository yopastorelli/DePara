'use strict';

const fs = require('fs');
const fsp = fs.promises;
const os = require('os');
const path = require('path');

const describeWindows = process.platform === 'win32' ? describe : describe.skip;

describeWindows('Windows path security smoke', () => {
  let runtimeRoot;
  let fileOperationsManager;

  beforeEach(() => {
    jest.resetModules();
    runtimeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'depara-win-path-'));
    process.env.NODE_ENV = 'test';
    process.env.DEPARA_RUNTIME_ROOT = runtimeRoot;
    process.env.DEPARA_DATA_DIR = path.join(runtimeRoot, 'data');
    process.env.DEPARA_BACKUP_DIR = path.join(runtimeRoot, 'backups');
    process.env.LOG_FILE = path.join(runtimeRoot, 'logs', 'app.log');
    fileOperationsManager = require('../../src/utils/fileOperations');
  });

  afterEach(async () => {
    if (fileOperationsManager) {
      fileOperationsManager.stopAllScheduledOperations();
    }

    delete process.env.NODE_ENV;
    delete process.env.DEPARA_RUNTIME_ROOT;
    delete process.env.DEPARA_DATA_DIR;
    delete process.env.DEPARA_BACKUP_DIR;
    delete process.env.LOG_FILE;
    delete process.env.DEPARA_ALLOWED_PATHS;

    await fsp.rm(runtimeRoot, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 100
    });
  });

  it('rejects an NTFS junction that escapes the configured allowlist', async () => {
    const allowedRoot = path.join(runtimeRoot, 'allowed');
    const outsideRoot = path.join(runtimeRoot, 'outside');
    const junctionPath = path.join(allowedRoot, 'outside-junction');

    await fsp.mkdir(allowedRoot, { recursive: true });
    await fsp.mkdir(outsideRoot, { recursive: true });
    await fsp.writeFile(path.join(outsideRoot, 'leak.txt'), 'blocked', 'utf8');
    await fsp.symlink(outsideRoot, junctionPath, 'junction');

    process.env.DEPARA_ALLOWED_PATHS = allowedRoot;

    await expect(
      fileOperationsManager.validateSafePath(junctionPath, 'read')
    ).rejects.toThrow(/Acesso negado/i);
  });
});
