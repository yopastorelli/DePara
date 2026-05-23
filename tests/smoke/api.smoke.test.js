const fs = require('fs');
const fsp = require('fs').promises;
const os = require('os');
const path = require('path');
const request = require('supertest');

function createTempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

async function writePng(filePath) {
  const pngBuffer = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9sMVMX8AAAAASUVORK5CYII=',
    'base64'
  );
  await fsp.writeFile(filePath, pngBuffer);
}

describe('API smoke', () => {
  let runtimeRoot;
  let app;

  beforeEach(() => {
    jest.resetModules();
    runtimeRoot = createTempDir('depara-smoke-');
    process.env.NODE_ENV = 'test';
    process.env.DEPARA_RUNTIME_ROOT = runtimeRoot;
    process.env.DEPARA_DATA_DIR = path.join(runtimeRoot, 'data');
    process.env.DEPARA_CONFIG_FILE = path.join(runtimeRoot, 'data', 'depara-config.json');
    process.env.LOG_FILE = path.join(runtimeRoot, 'logs', 'app.log');
    process.env.DEPARA_BACKUP_DIR = path.join(runtimeRoot, 'backups');
    process.env.DEPARA_DISABLE_UPDATE_SIDE_EFFECTS = 'true';
    process.env.DEPARA_DISABLE_UPDATE_SCHEDULER = 'true';
    app = require('../../src/main');
  });

  afterEach(async () => {
    if (app && typeof app.close === 'function') {
      await app.close();
    }
    delete process.env.DEPARA_RUNTIME_ROOT;
    delete process.env.DEPARA_DATA_DIR;
    delete process.env.DEPARA_CONFIG_FILE;
    delete process.env.LOG_FILE;
    delete process.env.DEPARA_BACKUP_DIR;
    delete process.env.DEPARA_DISABLE_UPDATE_SIDE_EFFECTS;
    delete process.env.DEPARA_DISABLE_UPDATE_SCHEDULER;
    await fsp.rm(runtimeRoot, { recursive: true, force: true });
  });

  it('health e status respondem com versao e status operacional', async () => {
    const health = await request(app).get('/health').expect(200);
    const status = await request(app).get('/api/status').expect(200);

    expect(health.body.status).toBe('OK');
    expect(typeof health.body.version).toBe('string');
    expect(status.body.status).toBe('OPERATIONAL');
    expect(status.body.application.version).toBe(health.body.version);
  });

  it('config persiste e reidrata o caminho do slideshow', async () => {
    const response = await request(app)
      .post('/api/config')
      .send({
        config: {
          slideshowSelectedPath: 'C:/fixtures/slideshow',
          slideshowConfig: { interval: 5, extensions: ['.png'] }
        }
      })
      .expect(200);

    expect(response.body.success).toBe(true);

    const persisted = await request(app).get('/api/config').expect(200);
    expect(persisted.body.config.slideshowSelectedPath).toBe('C:/fixtures/slideshow');
    expect(persisted.body.config.slideshowConfig.interval).toBe(5);
  });

  it('executa copy, move e delete em arquivos temporarios', async () => {
    const sourceDir = path.join(runtimeRoot, 'source');
    const targetDir = path.join(runtimeRoot, 'target');
    const moveDir = path.join(runtimeRoot, 'move');
    await fsp.mkdir(sourceDir, { recursive: true });
    await fsp.mkdir(targetDir, { recursive: true });
    await fsp.mkdir(moveDir, { recursive: true });

    const sourceFile = path.join(sourceDir, 'sample.txt');
    const copiedFile = path.join(targetDir, 'sample.txt');
    const movedFile = path.join(moveDir, 'sample.txt');
    await fsp.writeFile(sourceFile, 'sample-content', 'utf8');

    await request(app)
      .post('/api/files/execute')
      .send({ action: 'copy', sourcePath: sourceFile, targetPath: copiedFile })
      .expect(200);

    expect(fs.existsSync(copiedFile)).toBe(true);

    await request(app)
      .post('/api/files/execute')
      .send({ action: 'move', sourcePath: copiedFile, targetPath: movedFile })
      .expect(200);

    expect(fs.existsSync(copiedFile)).toBe(false);
    expect(fs.existsSync(movedFile)).toBe(true);

    await request(app)
      .post('/api/files/execute')
      .send({ action: 'delete', sourcePath: movedFile })
      .expect(200);

    expect(fs.existsSync(movedFile)).toBe(false);
  });

  it('lista pastas, imagens e status do auto-update sem side effects destrutivos', async () => {
    const foldersRoot = path.join(runtimeRoot, 'folders');
    const imagesDir = path.join(foldersRoot, 'images');
    const nestedDir = path.join(foldersRoot, 'nested');
    await fsp.mkdir(imagesDir, { recursive: true });
    await fsp.mkdir(nestedDir, { recursive: true });
    await writePng(path.join(imagesDir, 'fixture.png'));

    const foldersResponse = await request(app)
      .post('/api/files/list-folders')
      .send({ path: foldersRoot })
      .expect(200);

    expect(foldersResponse.body.success).toBe(true);
    expect(foldersResponse.body.data.folders.some((folder) => folder.name === 'images')).toBe(true);

    const imagesResponse = await request(app)
      .post('/api/files/list-images')
      .send({ folderPath: imagesDir, extensions: ['.png'], recursive: true })
      .expect(200);

    expect(imagesResponse.body.success).toBe(true);
    expect(imagesResponse.body.data.totalCount).toBeGreaterThan(0);

    const updateResponse = await request(app).get('/api/update/auto/status').expect(200);
    expect(updateResponse.body.success).toBe(true);
  });

  it('retorna erros acionaveis para execute e trata list-folders inexistente sem quebrar', async () => {
    const invalidExecute = await request(app)
      .post('/api/files/execute')
      .send({ action: 'copy', sourcePath: path.join(runtimeRoot, 'source', 'missing.txt') })
      .expect(400);

    expect(
      `${invalidExecute.body.error.message} ${invalidExecute.body.error.details || ''}`
    ).toMatch(/targetPath|destino/i);

    const missingFolders = await request(app)
      .post('/api/files/list-folders')
      .send({ path: path.join(runtimeRoot, 'folder-that-does-not-exist') })
      .expect(200);

    expect(missingFolders.body.success).toBe(true);
    expect(missingFolders.body.data.folders).toEqual([]);
  });

  it('cria, edita, pausa e executa operacao agendada pelo contrato canonico', async () => {
    const sourceDir = path.join(runtimeRoot, 'schedule-source');
    const targetDir = path.join(runtimeRoot, 'schedule-target');
    const nestedDir = path.join(sourceDir, 'nested');
    const copiedFile = path.join(targetDir, 'fixture.txt');
    await fsp.mkdir(nestedDir, { recursive: true });
    await fsp.mkdir(targetDir, { recursive: true });
    await fsp.writeFile(path.join(sourceDir, 'fixture.txt'), 'scheduled-copy', 'utf8');

    const createResponse = await request(app)
      .post('/api/files/schedule')
      .send({
        operationId: 'smoke_schedule_copy',
        name: 'Smoke Schedule',
        frequency: 'manual',
        action: 'copy',
        sourcePath: path.join(sourceDir, 'fixture.txt'),
        targetPath: copiedFile,
        options: { overwrite: true }
      })
      .expect(201);

    expect(createResponse.body.success).toBe(true);
    expect(createResponse.body.data.config.active).toBe(true);

    const invalidCreate = await request(app)
      .post('/api/files/schedule')
      .send({
        name: 'Missing Target',
        frequency: 'manual',
        action: 'copy',
        sourcePath: path.join(sourceDir, 'fixture.txt')
      })
      .expect(400);

    expect(invalidCreate.body.error.field).toBe('targetPath');

    const listAfterCreate = await request(app).get('/api/files/scheduled').expect(200);
    const createdOperation = listAfterCreate.body.data.find((operation) => operation.id === 'smoke_schedule_copy');
    expect(createdOperation).toBeTruthy();
    expect(createdOperation.active).toBe(true);

    const pauseResponse = await request(app)
      .put('/api/files/schedule/smoke_schedule_copy')
      .send({ active: false })
      .expect(200);

    expect(pauseResponse.body.success).toBe(true);
    expect(pauseResponse.body.data.config.active).toBe(false);

    const editResponse = await request(app)
      .put('/api/files/schedule/smoke_schedule_copy')
      .send({ name: 'Smoke Schedule Edited', active: true, frequency: '30s' })
      .expect(200);

    expect(editResponse.body.data.config.name).toBe('Smoke Schedule Edited');
    expect(editResponse.body.data.config.targetPath).toBe(copiedFile);
    expect(editResponse.body.data.config.active).toBe(true);

    await request(app)
      .post('/api/files/schedule/smoke_schedule_copy/execute')
      .send({})
      .expect(200);

    expect(fs.existsSync(copiedFile)).toBe(true);
  });
});
