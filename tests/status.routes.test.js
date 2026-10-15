const request = require('supertest');
const express = require('express');
const os = require('os');
const path = require('path');

jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  operationError: jest.fn(),
  performance: jest.fn()
}));

describe('Status Routes', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('caches disk collection for /api/status/resources', async () => {
    const fs = require('fs');
    const statfsMock = jest.spyOn(fs.promises, 'statfs').mockResolvedValue({
      blocks: 100,
      bavail: 60,
      bsize: 1024
    });
    delete process.env.DEPARA_STATUS_DRIVES;
    delete process.env.DEPARA_ALLOWED_PATHS;

    const statusRouter = require('../src/routes/status');
    const app = express();
    app.use('/api/status', statusRouter);

    const first = await request(app).get('/api/status/resources').expect(200);
    const second = await request(app).get('/api/status/resources').expect(200);

    expect(first.body.disk.drives).toEqual(expect.any(Array));
    expect(second.body.collection.cachedDiskInfoTtlMs).toBe(15000);
    expect(statfsMock).toHaveBeenCalledTimes(1);
    statfsMock.mockRestore();
  });

  it('reports the runtime log path instead of a repository-relative path', async () => {
    const runtimeRoot = path.join(os.tmpdir(), `depara-status-${process.pid}-${Date.now()}`);
    process.env.DEPARA_RUNTIME_ROOT = runtimeRoot;
    delete process.env.DEPARA_LOG_DIR;
    delete process.env.LOG_FILE;

    try {
      const statusRouter = require('../src/routes/status');
      const app = express();
      app.use('/api/status', statusRouter);

      const response = await request(app).get('/api/status/logs').expect(200);

      expect(response.body.logSystem.file).toBe(path.join(runtimeRoot, 'logs', 'app.log'));
    } finally {
      delete process.env.DEPARA_RUNTIME_ROOT;
    }
  });
});
