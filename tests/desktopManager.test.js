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

describe('DesktopManager', () => {
  let tempHome;
  let DesktopManager;

  beforeEach(() => {
    jest.resetModules();
    tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'depara-desktop-'));
    process.env.HOME = tempHome;
    DesktopManager = require('../src/utils/desktopManager');
  });

  afterEach(async () => {
    delete process.env.HOME;
    jest.restoreAllMocks();
    await fsp.rm(tempHome, { recursive: true, force: true });
  });

  it('gera um .desktop canonico que usa o launcher do repositorio', async () => {
    const manager = new DesktopManager();
    jest.spyOn(manager, 'updateDesktopDatabase').mockResolvedValue();
    jest.spyOn(manager, 'updateIconCache').mockResolvedValue();

    const result = await manager.createDesktopFile();
    const desktopContent = await fsp.readFile(manager.desktopFile, 'utf8');

    expect(result.success).toBe(true);
    expect(desktopContent).toContain(`Exec=${manager.launcherPath} open`);
    expect(desktopContent).toContain('Icon=depara');
    expect(desktopContent).toContain('StartupWMClass=DePara');
  });

  it('eh idempotente ao recriar o atalho canonico', async () => {
    const manager = new DesktopManager();
    jest.spyOn(manager, 'updateDesktopDatabase').mockResolvedValue();
    jest.spyOn(manager, 'updateIconCache').mockResolvedValue();

    await manager.createDesktopFile();
    const first = await fsp.readFile(manager.desktopFile, 'utf8');

    await manager.createDesktopFile();
    const second = await fsp.readFile(manager.desktopFile, 'utf8');

    expect(second).toBe(first);
  });
});
