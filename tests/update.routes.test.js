const request = require('supertest');
const express = require('express');

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

const orchestratorMock = {
  init: jest.fn(),
  checkForUpdates: jest.fn(),
  startUpdateCycle: jest.fn(),
  requestRestart: jest.fn(),
  getStatus: jest.fn(),
  updateConfig: jest.fn(),
  getHistory: jest.fn()
};

jest.mock('../src/services/updateOrchestrator', () => orchestratorMock);

const updateRouter = require('../src/routes/update');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/update', updateRouter);
  return app;
}

describe('Update Routes', () => {
  let app;

  beforeEach(() => {
    app = buildApp();
    jest.clearAllMocks();
    orchestratorMock.init.mockResolvedValue(undefined);
  });

  it('GET /api/update/auto/status should return orchestrator state', async () => {
    orchestratorMock.getStatus.mockResolvedValue({
      config: { enabled: true, checkIntervalMinutes: 60 },
      state: { status: 'idle', currentCommit: 'abc1234', targetCommit: 'abc1234' }
    });

    const res = await request(app).get('/api/update/auto/status').expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.state.status).toBe('idle');
    expect(orchestratorMock.getStatus).toHaveBeenCalledTimes(1);
  });

  it('GET /api/update/auto/status?refresh=1 should force remote check', async () => {
    orchestratorMock.checkForUpdates.mockResolvedValue({
      hasUpdates: false,
      commitsAhead: 0
    });
    orchestratorMock.getStatus.mockResolvedValue({
      config: { enabled: true, checkIntervalMinutes: 60 },
      state: { status: 'idle' }
    });

    const res = await request(app).get('/api/update/auto/status?refresh=1').expect(200);
    expect(res.body.success).toBe(true);
    expect(orchestratorMock.checkForUpdates).toHaveBeenCalledTimes(1);
  });

  it('POST /api/update/auto/check-now should force check and return status', async () => {
    orchestratorMock.checkForUpdates.mockResolvedValue({
      hasUpdates: true,
      commitsAhead: 1,
      currentCommit: 'aaa',
      targetCommit: 'bbb'
    });
    orchestratorMock.getStatus.mockResolvedValue({
      config: { enabled: true },
      state: { status: 'checking' }
    });

    const res = await request(app).post('/api/update/auto/check-now').expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.check.hasUpdates).toBe(true);
    expect(orchestratorMock.checkForUpdates).toHaveBeenCalledTimes(1);
    expect(orchestratorMock.getStatus).toHaveBeenCalledTimes(1);
  });

  it('PUT /api/update/auto/config should persist config', async () => {
    orchestratorMock.updateConfig.mockResolvedValue({
      enabled: true,
      autoApply: true,
      checkIntervalMinutes: 30,
      healthTimeoutMs: 2000,
      healthRetries: 3
    });

    const res = await request(app)
      .put('/api/update/auto/config')
      .send({ enabled: true, checkIntervalMinutes: 30 })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.checkIntervalMinutes).toBe(30);
    expect(orchestratorMock.updateConfig).toHaveBeenCalledWith({
      enabled: true,
      checkIntervalMinutes: 30
    });
  });

  it('POST /api/update/auto/trigger should return 202 when cycle starts', async () => {
    orchestratorMock.startUpdateCycle.mockResolvedValue({
      started: true,
      runId: 'run_123'
    });

    const res = await request(app).post('/api/update/auto/trigger').expect(202);
    expect(res.body.success).toBe(true);
    expect(res.body.data.runId).toBe('run_123');
  });

  it('POST /api/update/auto/trigger should return 409 when cycle is already running', async () => {
    orchestratorMock.startUpdateCycle.mockResolvedValue({
      started: false,
      reason: 'running'
    });

    const res = await request(app).post('/api/update/auto/trigger').expect(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.reason).toBe('running');
  });

  it('GET /api/update/auto/history should return historical entries', async () => {
    orchestratorMock.getHistory.mockResolvedValue([
      { event: 'cycle_started', runId: 'run_1' },
      { event: 'cycle_success', runId: 'run_1' }
    ]);

    const res = await request(app).get('/api/update/auto/history?limit=10').expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.count).toBe(2);
    expect(orchestratorMock.getHistory).toHaveBeenCalledWith(10);
  });
});
