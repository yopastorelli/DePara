const fs = require('fs').promises;
const path = require('path');
const { randomUUID } = require('crypto');

const { getRuntimeTempDir } = require('../runtimePaths');
const { getResourceLimits, getResourceStatus } = require('../resourceGuard');
const { scanImagesToManifest } = require('./imageScanner');

class ImageCatalogError extends Error {
  constructor(message, code = 'IMAGE_CATALOG_ERROR', statusCode = 400) {
    super(message);
    this.name = 'ImageCatalogError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

function encodeCursor(catalogId, page) {
  return Buffer.from(JSON.stringify({ catalogId, page }), 'utf8').toString('base64url');
}

function decodeCursor(cursor) {
  if (!cursor) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (!parsed || typeof parsed.catalogId !== 'string' || !Number.isInteger(parsed.page) || parsed.page < 0) {
      throw new Error('invalid cursor');
    }
    return parsed;
  } catch {
    throw new ImageCatalogError('Cursor de catálogo inválido', 'INVALID_IMAGE_CATALOG_CURSOR');
  }
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

class ImageCatalogStore {
  constructor() {
    this.catalogs = new Map();
    this.initializedDirectories = new Set();
    this.creationQueue = Promise.resolve();
  }

  getCatalogDirectory() {
    return path.join(getRuntimeTempDir(), 'slideshow-catalogs');
  }

  async ensureReady() {
    const directory = this.getCatalogDirectory();
    if (!this.initializedDirectories.has(directory)) {
      await fs.mkdir(directory, { recursive: true });
      this.initializedDirectories.add(directory);
    }
    await this.cleanupExpired();
    await this.cleanupOrphanedFiles();
  }

  async cleanupExpired() {
    const now = Date.now();
    const ttlMs = getResourceLimits().catalogTtlMinutes * 60 * 1000;
    const removals = [];

    for (const catalog of this.catalogs.values()) {
      if ((now - catalog.lastAccessAt) > ttlMs) {
        removals.push(this.closeCatalog(catalog.id));
      }
    }

    await Promise.all(removals);
  }

  async cleanupOrphanedFiles() {
    const directory = this.getCatalogDirectory();
    const ttlMs = getResourceLimits().catalogTtlMinutes * 60 * 1000;
    const activeFiles = new Set([...this.catalogs.values()].map((catalog) => catalog.filePath));
    const entries = await fs.readdir(directory, { withFileTypes: true });
    const removals = [];

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.jsonl')) {
        continue;
      }

      const filePath = path.join(directory, entry.name);
      if (activeFiles.has(filePath)) {
        continue;
      }

      const stats = await fs.stat(filePath);
      if ((Date.now() - stats.mtimeMs) > ttlMs) {
        removals.push(fs.rm(filePath, { force: true }));
      }
    }

    await Promise.all(removals);
  }

  async closeOldestReadyCatalog() {
    const readyCatalogs = [...this.catalogs.values()]
      .filter((catalog) => catalog.status !== 'building')
      .sort((left, right) => left.lastAccessAt - right.lastAccessAt);

    if (readyCatalogs.length === 0) {
      return false;
    }

    await this.closeCatalog(readyCatalogs[0].id);
    return true;
  }

  async createCatalog(options) {
    const creation = this.creationQueue.then(() => this.createCatalogInternal(options));
    this.creationQueue = creation.catch(() => {});
    return creation;
  }

  async createCatalogInternal(options) {
    await this.ensureReady();

    const resourceStatus = getResourceStatus();
    if (!resourceStatus.canStartWork) {
      const error = new ImageCatalogError(
        'Memória disponível insuficiente para iniciar o catálogo',
        'RESOURCE_CONSTRAINED',
        503
      );
      error.retryAfterSeconds = 15;
      error.status = resourceStatus;
      throw error;
    }

    const limits = getResourceLimits();
    while (this.catalogs.size >= limits.maxCatalogs) {
      if (!await this.closeOldestReadyCatalog()) {
        break;
      }
    }

    if (this.catalogs.size >= limits.maxCatalogs) {
      throw new ImageCatalogError(
        'Limite de catálogos ativos atingido; feche o slideshow anterior e tente novamente',
        'IMAGE_CATALOG_CAPACITY',
        429
      );
    }

    const id = randomUUID();
    const catalog = {
      id,
      filePath: path.join(this.getCatalogDirectory(), `${id}.jsonl`),
      status: 'building',
      error: null,
      loadedCount: 0,
      totalCount: null,
      pageSize: Math.min(
        limits.pageSize,
        resourceStatus.recommendedPageSize,
        Math.max(1, Number(options.pageSize) || limits.pageSize)
      ),
      lastAccessAt: Date.now(),
      firstPageReady: false,
      cancelled: false
    };

    this.catalogs.set(id, catalog);
    catalog.buildPromise = this.buildCatalog(catalog, options);
    catalog.buildPromise.catch(() => {});

    await this.waitForPage(catalog, 0);
    return this.getPage(id, null);
  }

  async buildCatalog(catalog, options) {
    try {
      const count = await scanImagesToManifest(options.folderPath, catalog.filePath, {
        recursive: options.recursive,
        maxDepth: options.maxDepth,
        extensions: options.extensions,
        shouldIgnore: options.shouldIgnore,
        isCancelled: () => catalog.cancelled,
        onImage: (imageCount) => {
          catalog.loadedCount = imageCount;
          if (imageCount >= catalog.pageSize) {
            catalog.firstPageReady = true;
          }
        }
      });

      catalog.loadedCount = count;
      catalog.totalCount = count;
      catalog.status = 'ready';
      catalog.firstPageReady = true;
      return count;
    } catch (error) {
      catalog.status = catalog.cancelled ? 'closed' : 'error';
      catalog.error = error;
      throw error;
    }
  }

  async waitForPage(catalog, page) {
    const requiredCount = (page + 1) * catalog.pageSize;
    const deadline = Date.now() + 30000;

    while (
      catalog.status === 'building'
      && catalog.loadedCount < requiredCount
      && Date.now() < deadline
    ) {
      await wait(25);
    }

    if (catalog.status === 'error') {
      throw catalog.error;
    }

    if (catalog.status === 'closed') {
      throw new ImageCatalogError('Catálogo de imagens encerrado', 'IMAGE_CATALOG_CLOSED', 410);
    }

    if (catalog.status === 'building' && catalog.loadedCount < requiredCount) {
      throw new ImageCatalogError(
        'A indexação de imagens demorou mais que o limite operacional',
        'IMAGE_CATALOG_TIMEOUT',
        504
      );
    }
  }

  getCatalogOrThrow(catalogId) {
    const catalog = this.catalogs.get(catalogId);
    if (!catalog) {
      throw new ImageCatalogError('Catálogo de imagens não encontrado ou expirado', 'IMAGE_CATALOG_NOT_FOUND', 410);
    }
    return catalog;
  }

  async readPage(catalog, page) {
    const startIndex = page * catalog.pageSize;
    const endIndex = startIndex + catalog.pageSize;
    const images = [];
    const handle = await fs.open(catalog.filePath, 'r');
    let lineBuffer = '';
    let index = 0;

    try {
      const buffer = Buffer.allocUnsafe(64 * 1024);
      let position = 0;
      let bytesRead = 0;

      while (index < endIndex && (bytesRead = (await handle.read(buffer, 0, buffer.length, position)).bytesRead) > 0) {
        position += bytesRead;
        lineBuffer += buffer.toString('utf8', 0, bytesRead);
        const lines = lineBuffer.split('\n');
        lineBuffer = lines.pop() || '';

        for (const line of lines) {
          if (!line) {
            continue;
          }
          if (index >= startIndex && index < endIndex) {
            images.push(JSON.parse(line));
          }
          index += 1;
          if (index >= endIndex) {
            break;
          }
        }
      }

      if (index < endIndex && lineBuffer) {
        if (index >= startIndex) {
          images.push(JSON.parse(lineBuffer));
        }
      }
    } finally {
      await handle.close();
    }

    return images;
  }

  async getPage(catalogId, cursor) {
    const decodedCursor = decodeCursor(cursor);
    const resolvedCatalogId = decodedCursor?.catalogId || catalogId;

    if (!resolvedCatalogId || (decodedCursor && decodedCursor.catalogId !== catalogId)) {
      throw new ImageCatalogError('Catálogo de imagens inválido', 'INVALID_IMAGE_CATALOG');
    }

    const catalog = this.getCatalogOrThrow(resolvedCatalogId);
    const page = decodedCursor?.page || 0;
    catalog.lastAccessAt = Date.now();

    await this.waitForPage(catalog, page);
    const images = await this.readPage(catalog, page);
    const nextPage = page + 1;
    const hasMore = catalog.status === 'building'
      || nextPage * catalog.pageSize < (catalog.totalCount || catalog.loadedCount);

    return {
      catalogId: catalog.id,
      images,
      page,
      pageSize: catalog.pageSize,
      loadedCount: catalog.loadedCount,
      totalCount: catalog.status === 'ready' ? catalog.totalCount : null,
      status: catalog.status === 'ready' ? 'ready' : 'building',
      hasMore,
      cursor: encodeCursor(catalog.id, page),
      nextCursor: hasMore ? encodeCursor(catalog.id, nextPage) : null
    };
  }

  async nextPage(catalogId, cursor) {
    const decodedCursor = decodeCursor(cursor);
    if (!decodedCursor || decodedCursor.catalogId !== catalogId) {
      throw new ImageCatalogError('Cursor de catálogo inválido', 'INVALID_IMAGE_CATALOG_CURSOR');
    }
    return this.getPage(catalogId, encodeCursor(catalogId, decodedCursor.page + 1));
  }

  async closeCatalog(catalogId) {
    const catalog = this.catalogs.get(catalogId);
    if (!catalog) {
      return false;
    }

    catalog.cancelled = true;
    this.catalogs.delete(catalogId);
    try {
      await fs.rm(catalog.filePath, { force: true });
    } catch {
      return false;
    }

    return true;
  }

  async closeAll() {
    await Promise.all([...this.catalogs.keys()].map((catalogId) => this.closeCatalog(catalogId)));
  }
}

module.exports = {
  ImageCatalogError,
  ImageCatalogStore,
  encodeCursor,
  decodeCursor
};
