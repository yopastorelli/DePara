const fs = require('fs');
const fsp = fs.promises;
const os = require('os');
const path = require('path');

function createTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'depara-file-safety-'));
}

describe('File operation safety', () => {
  let runtimeRoot;
  let manager;

  beforeEach(async () => {
    jest.resetModules();
    runtimeRoot = createTempDir();
    process.env.NODE_ENV = 'test';
    process.env.DEPARA_RUNTIME_ROOT = runtimeRoot;
    process.env.DEPARA_DATA_DIR = path.join(runtimeRoot, 'data');
    process.env.DEPARA_BACKUP_DIR = path.join(runtimeRoot, 'backups');
    process.env.DEPARA_ALLOWED_PATHS = runtimeRoot;
    manager = require('../src/utils/fileOperations');
    await manager.init();
  });

  afterEach(async () => {
    manager.stopAllScheduledOperations();
    manager.endShutdown();
    delete process.env.DEPARA_RUNTIME_ROOT;
    delete process.env.DEPARA_DATA_DIR;
    delete process.env.DEPARA_BACKUP_DIR;
    delete process.env.DEPARA_ALLOWED_PATHS;
    await fsp.rm(runtimeRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  it('publica cópia atômica e não sobrescreve destino por padrão', async () => {
    const sourcePath = path.join(runtimeRoot, 'source.txt');
    const targetPath = path.join(runtimeRoot, 'target.txt');
    await fsp.writeFile(sourcePath, 'conteudo novo', 'utf8');

    const copied = await manager.copyFile(sourcePath, targetPath);

    expect(copied.status).toBe('completed');
    expect(await fsp.readFile(targetPath, 'utf8')).toBe('conteudo novo');
    expect(fs.readdirSync(runtimeRoot).some((name) => name.includes('.depara-partial-'))).toBe(false);

    await fsp.writeFile(targetPath, 'conteudo preservado', 'utf8');
    const conflict = await manager.copyFile(sourcePath, targetPath);

    expect(conflict.success).toBe(false);
    expect(conflict.status).toBe('conflict');
    expect(await fsp.readFile(targetPath, 'utf8')).toBe('conteudo preservado');
    expect(await fsp.readFile(sourcePath, 'utf8')).toBe('conteudo novo');
  });

  it('move com overwrite protege o destino anterior em quarentena', async () => {
    const sourcePath = path.join(runtimeRoot, 'source.txt');
    const targetPath = path.join(runtimeRoot, 'target.txt');
    await fsp.writeFile(sourcePath, 'conteudo novo', 'utf8');
    await fsp.writeFile(targetPath, 'conteudo antigo', 'utf8');

    const moved = await manager.moveFile(sourcePath, targetPath, { overwrite: true });
    const recoveryEntries = await manager.listRecoveryEntries();

    expect(moved.status).toBe('completed');
    expect(fs.existsSync(sourcePath)).toBe(false);
    expect(await fsp.readFile(targetPath, 'utf8')).toBe('conteudo novo');
    expect(recoveryEntries).toHaveLength(1);
    expect(await fsp.readFile(recoveryEntries[0].payloadPath, 'utf8')).toBe('conteudo antigo');
  });

  it('exclusão de arquivo é reversível e preserva o conteúdo', async () => {
    const sourcePath = path.join(runtimeRoot, 'to-delete.txt');
    await fsp.writeFile(sourcePath, 'conteudo recuperável', 'utf8');

    const deleted = await manager.deleteFile(sourcePath);
    const recoveryEntries = await manager.listRecoveryEntries();

    expect(deleted.status).toBe('completed');
    expect(deleted.recoveryAvailable).toBe(true);
    expect(fs.existsSync(sourcePath)).toBe(false);
    expect(recoveryEntries).toHaveLength(1);

    const restored = await manager.restoreRecoveryEntry(recoveryEntries[0].entryId);

    expect(restored.restored).toBe(true);
    expect(await fsp.readFile(sourcePath, 'utf8')).toBe('conteudo recuperável');
    expect(await manager.listRecoveryEntries()).toHaveLength(0);
  });

  it('exclusão de diretório não tenta copiar a pasta como arquivo', async () => {
    const sourceDir = path.join(runtimeRoot, 'directory');
    const nestedDir = path.join(sourceDir, 'nested');
    await fsp.mkdir(nestedDir, { recursive: true });
    await fsp.writeFile(path.join(sourceDir, 'root.txt'), 'root', 'utf8');
    await fsp.writeFile(path.join(nestedDir, 'nested.txt'), 'nested', 'utf8');

    const deleted = await manager.deleteDirectoryRecursive(sourceDir);
    const recoveryEntries = await manager.listRecoveryEntries();

    expect(deleted.status).toBe('completed');
    expect(fs.existsSync(sourceDir)).toBe(false);
    expect(recoveryEntries).toHaveLength(2);
  });

  it('não ignora recursive=false em uma origem que é diretório', async () => {
    const sourceDir = path.join(runtimeRoot, 'directory');
    const targetDir = path.join(runtimeRoot, 'target');
    await fsp.mkdir(sourceDir, { recursive: true });
    await fsp.mkdir(targetDir, { recursive: true });
    await fsp.writeFile(path.join(sourceDir, 'file.txt'), 'conteudo', 'utf8');

    await expect(manager.copyFile(sourceDir, targetDir, { recursive: false }))
      .rejects.toMatchObject({ code: 'RECURSIVE_REQUIRED' });
    expect(fs.existsSync(path.join(sourceDir, 'file.txt'))).toBe(true);
  });

  it('lote informa conflito parcial e mantém o arquivo já existente', async () => {
    const sourceDir = path.join(runtimeRoot, 'source');
    const targetDir = path.join(runtimeRoot, 'target');
    await fsp.mkdir(sourceDir, { recursive: true });
    await fsp.mkdir(targetDir, { recursive: true });
    await fsp.writeFile(path.join(sourceDir, 'good.txt'), 'novo', 'utf8');
    await fsp.writeFile(path.join(sourceDir, 'conflict.txt'), 'não substituir', 'utf8');
    await fsp.writeFile(path.join(targetDir, 'conflict.txt'), 'antigo', 'utf8');

    const result = await manager.executeBatchOperation(
      'batch-safety',
      'copy',
      sourceDir,
      targetDir,
      { preserveStructure: true }
    );

    expect(result.success).toBe(false);
    expect(result.status).toBe('conflict');
    expect(result.counts.processed).toBe(1);
    expect(result.counts.conflicts).toBe(1);
    expect(await fsp.readFile(path.join(targetDir, 'good.txt'), 'utf8')).toBe('novo');
    expect(await fsp.readFile(path.join(targetDir, 'conflict.txt'), 'utf8')).toBe('antigo');
  });

  it('operação direta não transforma origem ausente em sucesso', async () => {
    await expect(manager.executeSingleOperation(
      'missing-source',
      'copy',
      path.join(runtimeRoot, 'missing.txt'),
      path.join(runtimeRoot, 'target.txt'),
      {}
    )).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('serializa chamadas concorrentes e não duplica o mesmo journal', async () => {
    const sourcePath = path.join(runtimeRoot, 'source.txt');
    const targetPath = path.join(runtimeRoot, 'target.txt');
    await fsp.writeFile(sourcePath, 'conteudo único', 'utf8');

    const [first, second] = await Promise.all([
      manager.copyFile(sourcePath, targetPath, { operationId: 'same-operation' }),
      manager.copyFile(sourcePath, targetPath, { operationId: 'same-operation' })
    ]);

    expect(first.status).toBe('completed');
    expect(second.status).toBe('completed');
    expect(await fsp.readFile(targetPath, 'utf8')).toBe('conteudo único');
  });

  it('reconcilia um journal em andamento, remove parcial e retoma a cópia', async () => {
    const sourcePath = path.join(runtimeRoot, 'source.txt');
    const targetPath = path.join(runtimeRoot, 'target.txt');
    const operationId = 'resume-operation';
    const engine = manager.transactionalOperations;
    await fsp.writeFile(sourcePath, 'conteudo retomado', 'utf8');
    await engine.createState(operationId, 'copy', sourcePath, targetPath, {});
    await engine.buildManifest(operationId, sourcePath, {});

    const partialPath = `${targetPath}.depara-partial-${operationId}`;
    await fsp.writeFile(partialPath, 'incompleto', 'utf8');
    await engine.appendProgress(operationId, {
      type: 'temp-created',
      tempPath: partialPath,
      relativePath: path.basename(sourcePath)
    });

    await engine.reconcileInterruptedOperations();
    let state = await engine.getState(operationId);
    for (let attempt = 0; attempt < 100 && state.status !== 'completed'; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      state = await engine.getState(operationId);
    }

    expect(state.status).toBe('completed');
    expect(await fsp.readFile(targetPath, 'utf8')).toBe('conteudo retomado');
    expect(fs.existsSync(partialPath)).toBe(false);
  });
});
