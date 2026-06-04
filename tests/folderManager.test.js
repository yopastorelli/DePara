const fs = require('fs');
const fsp = require('fs').promises;
const os = require('os');
const path = require('path');

jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

describe('FolderManager', () => {
  let runtimeRoot;
  let sourceRoot;

  beforeEach(() => {
    jest.unmock('fs');
    jest.resetModules();
    jest.clearAllMocks();
    runtimeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'depara-folders-'));
    sourceRoot = path.join(runtimeRoot, 'source-root');
    process.env.DEPARA_RUNTIME_ROOT = runtimeRoot;
    process.env.DEPARA_DATA_DIR = path.join(runtimeRoot, 'data');
    process.env.DEPARA_UPDATE_SOURCE_ROOT = sourceRoot;
  });

  afterEach(async () => {
    try {
      const folderManager = require('../src/config/folders');
      folderManager.cleanup();
    } catch {
      // O modulo pode nao ter sido carregado em todos os cenarios.
    }
    delete process.env.DEPARA_RUNTIME_ROOT;
    delete process.env.DEPARA_DATA_DIR;
    delete process.env.DEPARA_UPDATE_SOURCE_ROOT;
    await fsp.rm(runtimeRoot, { recursive: true, force: true });
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

  it('migrates legacy folders and exposes persistence status', async () => {
    await fsp.mkdir(path.join(sourceRoot, 'data'), { recursive: true });
    await fsp.writeFile(
      path.join(sourceRoot, 'data', 'folders.json'),
      JSON.stringify([{ id: 'legacy-folder', name: 'Legado', path: path.join(runtimeRoot, 'legacy'), type: 'input', enabled: true }]),
      'utf8'
    );

    const folderManager = require('../src/config/folders');
    await folderManager.init();

    expect(folderManager.getFolders()).toHaveLength(1);
    expect(folderManager.getFolders()[0].id).toBe('legacy-folder');
    expect(fs.existsSync(path.join(runtimeRoot, 'data', 'folders.json'))).toBe(true);

    const persistence = await folderManager.getPersistenceStatus();
    expect(persistence.migrated).toBe(true);
    expect(persistence.source).toContain(path.join('data', 'folders.json'));
  });

  it('creates missing default directories before registering watchers', async () => {
    const folderManager = require('../src/config/folders');
    const watchMock = jest.spyOn(require('fs'), 'watch').mockImplementation(() => ({
      close: jest.fn()
    }));

    await folderManager.init();

    const folders = folderManager.getFolders();
    for (const folder of folders) {
      expect(fs.existsSync(folder.path)).toBe(true);
    }
    expect(watchMock).toHaveBeenCalledTimes(folders.length);

    folderManager.cleanup();
    watchMock.mockRestore();
  });
});
