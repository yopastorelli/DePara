jest.mock('../src/utils/logger', () => ({ info: jest.fn(), error: jest.fn(), warn: jest.fn() }));

describe('Opt-in update scheduler', () => {
  let orchestrator;
  let previousEnable;
  let previousDisable;
  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers();
    previousEnable = process.env.DEPARA_ENABLE_UPDATE_SCHEDULER;
    previousDisable = process.env.DEPARA_DISABLE_UPDATE_SCHEDULER;
    delete process.env.DEPARA_ENABLE_UPDATE_SCHEDULER;
    delete process.env.DEPARA_DISABLE_UPDATE_SCHEDULER;
    orchestrator = require('../src/services/updateOrchestrator');
    orchestrator.config = { ...orchestrator.getDefaultConfig(), enabled: true };
    orchestrator.state = orchestrator.getDefaultState();
  });
  afterEach(() => {
    clearInterval(orchestrator.timer);
    if (previousEnable === undefined) delete process.env.DEPARA_ENABLE_UPDATE_SCHEDULER;
    else process.env.DEPARA_ENABLE_UPDATE_SCHEDULER = previousEnable;
    if (previousDisable === undefined) delete process.env.DEPARA_DISABLE_UPDATE_SCHEDULER;
    else process.env.DEPARA_DISABLE_UPDATE_SCHEDULER = previousDisable;
    jest.restoreAllMocks();
    jest.useRealTimers();
  });
  it('does not schedule without environment opt-in even when the UI configuration is enabled', () => {
    orchestrator.setupScheduler();
    expect(orchestrator.timer).toBeNull();
    expect(orchestrator.getSchedulerRuntimeStatus()).toMatchObject({ enabled: true, running: false, environmentEnabled: false });
  });
  it('runs the cycle at the configured interval when explicitly enabled', async () => {
    process.env.DEPARA_ENABLE_UPDATE_SCHEDULER = 'true';
    const cycle = jest.spyOn(orchestrator, 'startUpdateCycle').mockResolvedValue({ started: true });
    orchestrator.setupScheduler();
    expect(orchestrator.getSchedulerRuntimeStatus()).toMatchObject({ running: true, environmentEnabled: true });
    await jest.advanceTimersByTimeAsync(60000 * 60);
    expect(cycle).toHaveBeenCalledWith({ reason: 'scheduler' });
  });
  it('respects an explicit emergency environment disablement', () => {
    process.env.DEPARA_ENABLE_UPDATE_SCHEDULER = 'true';
    process.env.DEPARA_DISABLE_UPDATE_SCHEDULER = 'true';
    orchestrator.setupScheduler();
    expect(orchestrator.timer).toBeNull();
  });
  it('catches failed ticks instead of producing an unhandled rejection', async () => {
    process.env.DEPARA_ENABLE_UPDATE_SCHEDULER = 'true';
    jest.spyOn(orchestrator, 'startUpdateCycle').mockRejectedValue(new Error('offline'));
    orchestrator.setupScheduler();
    await jest.advanceTimersByTimeAsync(60000 * 60);
    expect(require('../src/utils/logger').warn).toHaveBeenCalledWith('Falha no agendamento de atualização', expect.any(Object));
  });
});
