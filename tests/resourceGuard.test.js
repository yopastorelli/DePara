describe('resourceGuard', () => {
  const originalFreeMemory = process.memoryUsage;

  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.DEPARA_MEMORY_WARN_MB;
    delete process.env.DEPARA_MEMORY_CRITICAL_MB;
    delete process.env.DEPARA_MAX_RSS_MB;
    process.memoryUsage = originalFreeMemory;
  });

  it('entra em warning e reduz o tamanho recomendado da página', () => {
    jest.resetModules();
    jest.spyOn(require('os'), 'freemem').mockReturnValue(900 * 1024 * 1024);
    process.env.DEPARA_MEMORY_WARN_MB = '1024';
    process.env.DEPARA_MEMORY_CRITICAL_MB = '512';
    process.env.DEPARA_MAX_RSS_MB = '1024';
    const resourceGuard = require('../src/utils/resourceGuard');

    const status = resourceGuard.getResourceStatus();

    expect(status.state).toBe('warning');
    expect(status.canStartWork).toBe(true);
    expect(status.recommendedPageSize).toBe(status.limits.lowMemoryPageSize);
  });

  it('bloqueia nova indexação em pressão crítica de RSS', () => {
    jest.resetModules();
    jest.spyOn(require('os'), 'freemem').mockReturnValue(2 * 1024 * 1024 * 1024);
    process.env.DEPARA_MAX_RSS_MB = '64';
    process.memoryUsage = jest.fn(() => ({ rss: 70 * 1024 * 1024 }));
    const resourceGuard = require('../src/utils/resourceGuard');

    const status = resourceGuard.getResourceStatus();

    expect(status.state).toBe('critical');
    expect(status.canStartWork).toBe(false);
    expect(() => resourceGuard.assertCanStartWork()).toThrow('Memória disponível insuficiente');
  });
});
