const fs = require('fs');
const fsp = fs.promises;
const os = require('os');
const path = require('path');
const request = require('supertest');

function createTempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

describe('image catalog pagination', () => {
  let runtimeRoot;
  let imagesDir;
  let app;

  beforeEach(async () => {
    jest.resetModules();
    runtimeRoot = createTempDir('depara-catalog-runtime-');
    imagesDir = path.join(runtimeRoot, 'images');
    await fsp.mkdir(imagesDir, { recursive: true });
    process.env.NODE_ENV = 'test';
    process.env.DEPARA_RUNTIME_ROOT = runtimeRoot;
    process.env.DEPARA_DATA_DIR = path.join(runtimeRoot, 'data');
    process.env.DEPARA_CONFIG_FILE = path.join(runtimeRoot, 'data', 'depara-config.json');
    process.env.LOG_FILE = path.join(runtimeRoot, 'logs', 'app.log');
    process.env.DEPARA_BACKUP_DIR = path.join(runtimeRoot, 'backups');
    process.env.DEPARA_IMAGE_PAGE_SIZE = '100';
    process.env.DEPARA_LOW_MEMORY_PAGE_SIZE = '50';
    jest.spyOn(os, 'freemem').mockReturnValue(2 * 1024 * 1024 * 1024);
    process.env.DEPARA_MAX_RSS_MB = '1024';
    process.env.DEPARA_DISABLE_UPDATE_SIDE_EFFECTS = 'true';
    process.env.DEPARA_DISABLE_UPDATE_SCHEDULER = 'true';
    app = require('../src/main');
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
    delete process.env.DEPARA_IMAGE_PAGE_SIZE;
    delete process.env.DEPARA_LOW_MEMORY_PAGE_SIZE;
    delete process.env.DEPARA_MAX_RSS_MB;
    delete process.env.DEPARA_DISABLE_UPDATE_SIDE_EFFECTS;
    delete process.env.DEPARA_DISABLE_UPDATE_SCHEDULER;
    jest.restoreAllMocks();
    await fsp.rm(runtimeRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  it('percorre mais de 5.000 imagens sem duplicar ou perder entradas', async () => {
    const imageCount = 5005;
    await Promise.all(Array.from({ length: imageCount }, (_, index) => fsp.writeFile(
      path.join(imagesDir, `image-${String(index).padStart(5, '0')}.png`),
      'png'
    )));

    const collected = [];
    let response = await request(app)
      .post('/api/files/list-images')
      .send({
        folderPath: imagesDir,
        extensions: ['.png'],
        recursive: true,
        pageSize: 100
      })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.pagination.pageSize).toBe(100);
    collected.push(...response.body.data.images.map((image) => image.relativePath));

    let pages = 1;
    while (response.body.data.pagination.nextCursor) {
      const pagination = response.body.data.pagination;
      response = await request(app)
        .post('/api/files/list-images')
        .send({
          catalogId: pagination.catalogId,
          cursor: pagination.nextCursor,
          folderPath: imagesDir,
          extensions: ['.png'],
          recursive: true,
          pageSize: 100
        })
        .expect(200);
      collected.push(...response.body.data.images.map((image) => image.relativePath));
      pages += 1;
    }

    expect(pages).toBe(51);
    expect(collected).toHaveLength(imageCount);
    expect(new Set(collected).size).toBe(imageCount);
    expect(response.body.data.pagination.totalCount).toBe(imageCount);

    await request(app)
      .delete(`/api/files/image-catalog/${response.body.data.pagination.catalogId}`)
      .expect(200);
  });

  it('rejeita cursor inválido e suporta contagem sem retornar imagens', async () => {
    await fsp.writeFile(path.join(imagesDir, 'one.png'), 'png');

    const countResponse = await request(app)
      .post('/api/files/list-images')
      .send({
        folderPath: imagesDir,
        extensions: ['.png'],
        recursive: true,
        countOnly: true
      })
      .expect(200);

    expect(countResponse.body.data.images).toEqual([]);
    expect(countResponse.body.data.totalCount).toBe(1);

    const invalidCursorResponse = await request(app)
      .post('/api/files/list-images')
      .send({
        catalogId: 'missing-catalog',
        cursor: 'not-a-cursor',
        folderPath: imagesDir,
        extensions: ['.png'],
        recursive: true
      })
      .expect(400);

    expect(invalidCursorResponse.body.error.code).toBe('INVALID_IMAGE_CATALOG_CURSOR');
  });
});
