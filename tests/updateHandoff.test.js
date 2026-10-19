jest.mock('../src/utils/logger', () => ({ info: jest.fn(), error: jest.fn(), warn: jest.fn() }));
const { performHandoff } = require('../scripts/update-handoff');

describe('Windows update handoff', () => {
  const input = { parentPid: 123, release: { commit: 'new', releaseId: 'new' },
    current: { activeCommit: 'old', activeRelease: 'old' } };
  let io;
  beforeEach(() => {
    io = { stop: jest.fn().mockResolvedValue(true), activate: jest.fn().mockResolvedValue(),
      restore: jest.fn().mockResolvedValue(), launch: jest.fn().mockResolvedValue(456),
      healthy: jest.fn().mockResolvedValue(true), state: jest.fn().mockResolvedValue() };
  });
  it('defers busy operations without switching releases or killing processes', async () => {
    io.stop.mockResolvedValue(false);
    expect(await performHandoff(input, io)).toBe('deferred');
    expect(io.activate).not.toHaveBeenCalled();
    expect(io.launch).not.toHaveBeenCalled();
  });
  it('activates only after the previous process has stopped and validates the loaded commit', async () => {
    expect(await performHandoff(input, io)).toBe('updated');
    expect(io.stop).toHaveBeenCalledWith(123);
    expect(io.stop.mock.invocationCallOrder[0]).toBeLessThan(io.activate.mock.invocationCallOrder[0]);
    expect(io.healthy).toHaveBeenCalledWith('new');
    expect(io.restore).not.toHaveBeenCalled();
  });
  it('restores the previous release when startup fails', async () => {
    io.launch.mockRejectedValueOnce(new Error('startup failed'));
    expect(await performHandoff(input, io)).toBe('rolled_back');
    expect(io.restore).toHaveBeenCalledTimes(1);
    expect(io.healthy).toHaveBeenCalledWith('old');
  });
  it('stops the unhealthy process gracefully before rollback', async () => {
    io.healthy.mockResolvedValueOnce(false);
    expect(await performHandoff(input, io)).toBe('rolled_back');
    expect(io.stop).toHaveBeenNthCalledWith(2, 456);
    expect(io.restore).toHaveBeenCalledTimes(1);
  });
  it('does not launch a second instance if the unhealthy process cannot stop safely', async () => {
    io.healthy.mockResolvedValue(false);
    io.stop.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    expect(await performHandoff(input, io)).toBe('blocked');
    expect(io.restore).not.toHaveBeenCalled();
    expect(io.launch).toHaveBeenCalledTimes(1);
  });
  it('records critical state if the previous release also fails validation', async () => {
    io.healthy.mockResolvedValue(false);
    expect(await performHandoff(input, io)).toBe('failed');
    expect(io.state).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'critical', lastEvent: 'rollback_failed' }));
  });
});
