jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

describe('FolderManager', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('initializes watchers once and cleans them up explicitly', async () => {
    const closeMock = jest.fn();
    const watchMock = jest.fn((folderPath, options, callback) => {
      callback('rename', 'example.txt');
      return { close: closeMock };
    });

    const statMock = jest.fn()
      .mockResolvedValueOnce({ isFile: () => true })
      .mockResolvedValue({ isDirectory: () => true, isFile: () => false });

    jest.doMock('fs', () => ({
      watch: watchMock,
      promises: {
        access: jest.fn().mockResolvedValue(undefined),
        mkdir: jest.fn().mockResolvedValue(undefined),
        readFile: jest.fn().mockResolvedValue(JSON.stringify([
          {
            id: 'folder-1',
            name: 'Entrada',
            path: '/tmp/entrada',
            type: 'input',
            enabled: true,
            autoProcess: false
          }
        ])),
        writeFile: jest.fn().mockResolvedValue(undefined),
        stat: statMock
      }
    }));

    const folderManager = require('../src/config/folders');
    const handleSpy = jest.spyOn(folderManager, 'handleFolderEvent').mockResolvedValue(undefined);

    await folderManager.init();
    await folderManager.init();

    expect(watchMock).toHaveBeenCalledTimes(1);
    expect(handleSpy).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'folder-1' }),
      'rename',
      'example.txt'
    );

    folderManager.cleanup();
    expect(closeMock).toHaveBeenCalledTimes(1);
    expect(folderManager.watchers.size).toBe(0);
  });
});
