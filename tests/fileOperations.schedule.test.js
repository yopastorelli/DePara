const fs = require('fs');
const fsp = require('fs').promises;
const os = require('os');
const path = require('path');

function createTempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

describe('FileOperationsManager scheduling', () => {
  let runtimeRoot;
  let sourceRoot;

  beforeEach(() => {
    jest.resetModules();
    runtimeRoot = createTempDir('depara-schedule-');
    sourceRoot = path.join(runtimeRoot, 'source-root');
    process.env.NODE_ENV = 'test';
    process.env.DEPARA_RUNTIME_ROOT = runtimeRoot;
    process.env.DEPARA_DATA_DIR = path.join(runtimeRoot, 'data');
    process.env.DEPARA_BACKUP_DIR = path.join(runtimeRoot, 'backups');
    process.env.DEPARA_UPDATE_SOURCE_ROOT = sourceRoot;
  });

  afterEach(async () => {
    const manager = require('../src/utils/fileOperations');
    manager.stopAllScheduledOperations();
    delete process.env.DEPARA_RUNTIME_ROOT;
    delete process.env.DEPARA_DATA_DIR;
    delete process.env.DEPARA_BACKUP_DIR;
    delete process.env.DEPARA_UPDATE_SOURCE_ROOT;
    await fsp.rm(runtimeRoot, { recursive: true, force: true });
  });

  it('edita operação parcialmente sem remover persistência e alterna active', async () => {
    const manager = require('../src/utils/fileOperations');
    await manager.init();

    const operationId = 'schedule_partial_edit';
    manager.scheduleOperation(operationId, {
      name: 'Cópia manual',
      frequency: 'manual',
      action: 'copy',
      sourcePath: '/tmp/source',
      targetPath: '/tmp/target',
      options: {
        batch: true,
        preserveStructure: true
      }
    });

    let operation = manager.getScheduledOperation(operationId);
    expect(operation.active).toBe(true);
    expect(manager.schedules.has(operationId)).toBe(false);

    manager.editScheduledOperation(operationId, {
      active: false,
      name: 'Cópia pausada'
    });

    operation = manager.getScheduledOperation(operationId);
    expect(operation.name).toBe('Cópia pausada');
    expect(operation.frequency).toBe('manual');
    expect(operation.active).toBe(false);
    expect(manager.schedules.has(operationId)).toBe(false);

    manager.editScheduledOperation(operationId, {
      active: true,
      frequency: '30s'
    });

    operation = manager.getScheduledOperation(operationId);
    expect(operation.frequency).toBe('30s');
    expect(operation.active).toBe(true);
    expect(manager.schedules.has(operationId)).toBe(true);
  });

  it('reidrata operações persistidas sem armar timers quando active=false', async () => {
    let manager = require('../src/utils/fileOperations');
    await manager.init();

    const operationId = 'schedule_restore_disabled';
    manager.scheduleOperation(operationId, {
      name: 'Operação desativada',
      frequency: '30s',
      action: 'copy',
      sourcePath: '/tmp/source',
      targetPath: '/tmp/target',
      active: false,
      options: {
        batch: true,
        preserveStructure: true
      }
    });
    await manager.saveScheduledOperations();

    manager.stopAllScheduledOperations();
    jest.resetModules();

    manager = require('../src/utils/fileOperations');
    await manager.init();

    const operation = manager.getScheduledOperation(operationId);
    expect(operation).not.toBeNull();
    expect(operation.active).toBe(false);
    expect(manager.schedules.has(operationId)).toBe(false);
  });

  it('migra scheduled-operations legado para o runtime e reidrata timers', async () => {
    const legacyDataDir = path.join(sourceRoot, 'data');
    await fsp.mkdir(legacyDataDir, { recursive: true });
    await fsp.writeFile(path.join(legacyDataDir, 'scheduled-operations.json'), JSON.stringify([
      {
        id: 'legacy_schedule',
        config: {
          name: 'Legado',
          frequency: '30s',
          action: 'copy',
          sourcePath: '/tmp/source',
          targetPath: '/tmp/target',
          active: true,
          options: {}
        }
      }
    ], null, 2), 'utf8');

    const manager = require('../src/utils/fileOperations');
    await manager.init();

    const operation = manager.getScheduledOperation('legacy_schedule');
    const persistence = await manager.getPersistenceStatus();

    expect(operation).not.toBeNull();
    expect(operation.name).toBe('Legado');
    expect(manager.schedules.has('legacy_schedule')).toBe(true);
    expect(persistence.migrated).toBe(true);
    expect(persistence.source).toContain(path.join('data', 'scheduled-operations.json'));
  });
});
