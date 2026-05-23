const request = require('supertest');
const express = require('express');

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
    const execMock = jest.fn((command, options, callback) => {
      callback(null, 'Filesystem 1K-blocks Used Available Use% Mounted on\n/dev/root 100 40 60 40% /\n', '');
    });

    jest.doMock('child_process', () => ({
      exec: execMock
    }));

    const statusRouter = require('../src/routes/status');
    const app = express();
    app.use('/api/status', statusRouter);

    const first = await request(app).get('/api/status/resources').expect(200);
    const second = await request(app).get('/api/status/resources').expect(200);

    expect(first.body.disk.drives).toEqual(expect.any(Array));
    expect(second.body.collection.cachedDiskInfoTtlMs).toBe(15000);
    expect(execMock).toHaveBeenCalledTimes(1);
  });
});
