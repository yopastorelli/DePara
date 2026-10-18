const crypto = require('crypto');
const fs = require('fs').promises;
const fsSync = require('fs');
const os = require('os');
const path = require('path');
const readline = require('readline');
const { Transform } = require('stream');
const { pipeline } = require('stream/promises');

const { readJsonWithRecovery, writeJsonAtomic } = require('../atomicStore');

const TERMINAL_STATUSES = new Set(['completed', 'partial', 'conflict', 'failed', 'cancelled']);

class OperationConflictError extends Error {
  constructor(message) {
    super(message);
    this.name = 'OperationConflictError';
    this.code = 'TARGET_CONFLICT';
    this.statusCode = 409;
  }
}

class TransactionalOperations {
  constructor({ dataDir, quarantineDir, logger, maxRecursionDepth = 10, shouldIgnoreFile, matchesFilters }) {
    this.dataDir = dataDir;
    this.operationRoot = path.join(dataDir, 'file-operations');
    this.quarantineDir = quarantineDir;
    this.logger = logger;
    this.maxRecursionDepth = maxRecursionDepth;
    this.shouldIgnoreFile = shouldIgnoreFile || (() => false);
    this.matchesFilters = matchesFilters || (() => true);
    this.activeOperations = new Map();
    this.operationQueue = Promise.resolve();
    this.draining = false;
  }

  async init() {
    await fs.mkdir(this.operationRoot, { recursive: true });
    await fs.mkdir(this.quarantineDir, { recursive: true });
    await this.reconcileInterruptedOperations();
  }

  getOperationDir(operationId) {
    return path.join(this.operationRoot, this.safeOperationId(operationId));
  }

  getStatePath(operationId) {
    return path.join(this.getOperationDir(operationId), 'state.json');
  }

  getManifestPath(operationId) {
    return path.join(this.getOperationDir(operationId), 'manifest.jsonl');
  }

  getManifestTempPath(operationId) {
    return path.join(this.getOperationDir(operationId), 'manifest.jsonl.tmp');
  }

  getProgressPath(operationId) {
    return path.join(this.getOperationDir(operationId), 'progress.jsonl');
  }

  safeOperationId(operationId) {
    return String(operationId).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 160);
  }

  createOperationId(prefix = 'op') {
    return `${prefix}_${Date.now()}_${process.pid}_${crypto.randomBytes(4).toString('hex')}`;
  }

  serializableOptions(options = {}) {
    const { onProgress, operationId, resume, ...serializable } = options;
    return serializable;
  }

  async createState(operationId, action, sourcePath, targetPath, options) {
    const operationDir = this.getOperationDir(operationId);
    await fs.mkdir(operationDir, { recursive: true });
    const state = {
      version: 1,
      operationId,
      action,
      sourcePath,
      targetPath: targetPath || null,
      options: this.serializableOptions(options),
      status: 'preparing',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      counts: {
        total: 0,
        processed: 0,
        skipped: 0,
        conflicts: 0,
        failed: 0,
        recovered: 0
      },
      cancelRequested: false,
      lastMessage: 'Preparando operação'
    };
    await writeJsonAtomic(this.getStatePath(operationId), state);
    await fs.rm(this.getManifestTempPath(operationId), { force: true });
    await fs.rm(this.getManifestPath(operationId), { force: true });
    await fs.rm(this.getProgressPath(operationId), { force: true });
    return state;
  }

  async getState(operationId) {
    try {
      return await readJsonWithRecovery(this.getStatePath(operationId), null);
    } catch {
      return null;
    }
  }

  async updateState(operationId, patch) {
    const current = await this.getState(operationId);
    if (!current) {
      return null;
    }
    const next = {
      ...current,
      ...patch,
      updatedAt: new Date().toISOString()
    };
    await writeJsonAtomic(this.getStatePath(operationId), next);
    return next;
  }

  async appendJsonLine(filePath, value) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const handle = await fs.open(filePath, 'a');
    try {
      await handle.write(`${JSON.stringify(value)}${os.EOL}`, null, 'utf8');
      await handle.sync();
    } finally {
      await handle.close();
    }
  }

  async appendProgress(operationId, event) {
    await this.appendJsonLine(this.getProgressPath(operationId), {
      ...event,
      timestamp: new Date().toISOString()
    });
  }

  async appendManifest(operationId, entry) {
    await this.appendJsonLine(this.getManifestTempPath(operationId), entry);
  }

  async finalizeManifest(operationId) {
    await fs.rename(this.getManifestTempPath(operationId), this.getManifestPath(operationId));
  }

  async *readJsonLines(filePath) {
    try {
      await fs.access(filePath);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return;
      }
      throw error;
    }

    let stream;
    try {
      stream = fsSync.createReadStream(filePath, { encoding: 'utf8' });
    } catch (error) {
      if (error.code === 'ENOENT') {
        return;
      }
      throw error;
    }

    const reader = readline.createInterface({ input: stream, crlfDelay: Infinity });
    try {
      for await (const line of reader) {
        if (!line.trim()) {
          continue;
        }
        try {
          yield JSON.parse(line);
        } catch (error) {
          this.logger.warn('Registro de journal inválido ignorado', {
            filePath,
            error: error.message
          });
        }
      }
    } finally {
      reader.close();
      stream.destroy();
    }
  }

  async getCompletedItems(operationId) {
    const completed = new Map();
    for await (const event of this.readJsonLines(this.getProgressPath(operationId))) {
      if (!event.relativePath) {
        continue;
      }
      if (['item-committed', 'item-skipped', 'item-conflict', 'item-failed', 'item-reconciled'].includes(event.type)) {
        completed.set(event.relativePath, event);
      }
    }
    return completed;
  }

  async getOperationProgress(operationId) {
    const state = await this.getState(operationId);
    if (!state) {
      return null;
    }
    return {
      operationId,
      percentage: state.counts.total > 0
        ? Math.min(100, Math.round(((state.counts.processed + state.counts.skipped + state.counts.conflicts + state.counts.failed) / state.counts.total) * 100))
        : (state.status === 'completed' ? 100 : 0),
      total: state.counts.total,
      status: state.status,
      counts: state.counts,
      message: state.lastMessage,
      timestamp: state.updatedAt
    };
  }

  async listOperationStates() {
    let entries = [];
    try {
      entries = await fs.readdir(this.operationRoot, { withFileTypes: true });
    } catch {
      return [];
    }

    const states = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      const state = await this.getState(entry.name);
      if (state) {
        states.push(state);
      }
    }
    return states;
  }

  async reconcileInterruptedOperations() {
    const states = await this.listOperationStates();
    for (const state of states) {
      if (!['preparing', 'running', 'draining'].includes(state.status)) {
        continue;
      }

      await this.cleanupTemporaryFiles(state.operationId);
      await this.updateState(state.operationId, {
        status: 'interrupted',
        lastMessage: 'Operação interrompida; retomada pendente'
      });

      if (state.status === 'running' || state.status === 'draining') {
        setTimeout(() => {
          this.execute(state.action, state.sourcePath, state.targetPath, {
            ...state.options,
            operationId: state.operationId,
            resume: true
          }).catch((error) => {
            this.logger.error('Falha ao retomar operação interrompida', {
              operationId: state.operationId,
              error: error.message
            });
          });
        }, 0).unref?.();
      }
    }
  }

  async cleanupTemporaryFiles(operationId) {
    const temporaryPaths = new Set();
    for await (const event of this.readJsonLines(this.getProgressPath(operationId))) {
      if (event.type === 'temp-created' && event.tempPath) {
        temporaryPaths.add(event.tempPath);
      }
    }
    for (const tempPath of temporaryPaths) {
      await fs.rm(tempPath, { force: true }).catch(() => {});
    }
  }

  async buildManifest(operationId, sourcePath, options) {
    const sourceStats = await fs.lstat(sourcePath);
    let total = 0;

    if (sourceStats.isDirectory()) {
      for await (const entry of this.walkDirectory(sourcePath, '', 0)) {
        if (entry.kind === 'file' && !this.matchesEntry(entry.name, entry.path, options)) {
          continue;
        }
        await this.appendManifest(operationId, entry);
        total += 1;
      }
    } else if (sourceStats.isFile()) {
      const name = path.basename(sourcePath);
      if (this.matchesEntry(name, sourcePath, options)) {
        await this.appendManifest(operationId, {
          relativePath: name,
          path: sourcePath,
          kind: 'file',
          name
        });
        total = 1;
      }
    } else {
      throw new Error(`Origem não é arquivo ou diretório: ${sourcePath}`);
    }

    await this.finalizeManifest(operationId);
    await this.updateState(operationId, {
      counts: {
        ...(await this.getState(operationId)).counts,
        total
      },
      status: 'running',
      lastMessage: total > 0 ? 'Processando arquivos' : 'Nenhum arquivo elegível'
    });
  }

  matchesEntry(name, entryPath, options) {
    if (this.shouldIgnoreFile(name)) {
      return false;
    }
    if (options.extensions && options.extensions.length > 0) {
      const normalizedExtensions = options.extensions.map((extension) => {
        const value = String(extension).toLowerCase();
        return value.startsWith('.') ? value : `.${value}`;
      });
      if (!normalizedExtensions.includes(path.extname(name).toLowerCase())) {
        return false;
      }
    }
    return this.matchesFilters(name, options.filters, entryPath);
  }

  async *walkDirectory(rootPath, relativePath, depth) {
    if (depth > this.maxRecursionDepth) {
      throw new Error(`Profundidade máxima de recursão excedida: ${rootPath}`);
    }

    const entries = await fs.readdir(path.join(rootPath, relativePath), { withFileTypes: true });
    for (const entry of entries) {
      if (this.shouldIgnoreFile(entry.name)) {
        continue;
      }
      const nextRelativePath = path.join(relativePath, entry.name);
      const entryPath = path.join(rootPath, nextRelativePath);
      const stats = await fs.lstat(entryPath);
      if (stats.isDirectory()) {
        yield { relativePath: nextRelativePath, path: entryPath, kind: 'directory', name: entry.name };
        yield* this.walkDirectory(rootPath, nextRelativePath, depth + 1);
      } else if (stats.isFile()) {
        yield { relativePath: nextRelativePath, path: entryPath, kind: 'file', name: entry.name };
      }
    }
  }

  validatePathRelationship(sourcePath, targetPath, sourceIsDirectory) {
    if (!targetPath) {
      return;
    }
    const source = path.resolve(sourcePath);
    const target = path.resolve(targetPath);
    if (source.toLowerCase() === target.toLowerCase()) {
      const error = new Error('Origem e destino não podem ser iguais');
      error.code = 'PATH_OVERLAP';
      throw error;
    }
    if (sourceIsDirectory && this.isWithin(target, source)) {
      const error = new Error('Destino não pode ficar dentro da origem');
      error.code = 'PATH_OVERLAP';
      throw error;
    }
  }

  isWithin(candidatePath, basePath) {
    const relative = path.relative(basePath, candidatePath);
    return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
  }

  async assertPreflight(action, sourcePath, targetPath, options) {
    const sourceStats = await fs.lstat(sourcePath);
    this.validatePathRelationship(sourcePath, targetPath, sourceStats.isDirectory());
    if ((action === 'copy' || action === 'move') && !targetPath) {
      throw new Error(`Destino obrigatório para ação '${action}'`);
    }
    if (sourceStats.isSymbolicLink()) {
      throw new Error('Links simbólicos não são aceitos como origem de mutação');
    }
    if (sourceStats.isDirectory() && options.recursive === false) {
      const error = new Error('Operações em diretórios exigem recursive=true');
      error.code = 'RECURSIVE_REQUIRED';
      throw error;
    }
    if (targetPath) {
      await fs.mkdir(path.dirname(targetPath), { recursive: true });
      if (sourceStats.isDirectory()) {
        await fs.mkdir(targetPath, { recursive: true });
      }
    }
    return sourceStats;
  }

  async execute(action, sourcePath, targetPath, options = {}) {
    if (this.draining && !options.resume) {
      const error = new Error('O DePara está encerrando e não aceita novas operações');
      error.code = 'SHUTTING_DOWN';
      error.statusCode = 503;
      throw error;
    }

    const operationId = options.operationId || this.createOperationId(action);
    const existingExecution = this.activeOperations.get(operationId);
    if (existingExecution) {
      return existingExecution;
    }

    const execution = this.operationQueue
      .catch(() => {})
      .then(() => this.runOperation(operationId, action, sourcePath, targetPath, options));
    this.operationQueue = execution.catch(() => {});
    this.activeOperations.set(operationId, execution);
    try {
      return await execution;
    } finally {
      this.activeOperations.delete(operationId);
    }
  }

  async runOperation(operationId, action, sourcePath, targetPath, options) {
    let state = await this.getState(operationId);
    if (state && TERMINAL_STATUSES.has(state.status)) {
      return this.toResult(state);
    }

    if (!state) {
      state = await this.createState(operationId, action, sourcePath, targetPath, options);
    } else {
      await this.cleanupTemporaryFiles(operationId);
    }

    const safeSourcePath = path.resolve(sourcePath);
    const safeTargetPath = targetPath ? path.resolve(targetPath) : null;
    const sourceStats = await this.assertPreflight(action, safeSourcePath, safeTargetPath, options);

    if (!fsSync.existsSync(this.getManifestPath(operationId))) {
      await this.buildManifest(operationId, safeSourcePath, options);
    } else if (state.status !== 'running') {
      const current = await this.getState(operationId);
      await this.updateState(operationId, {
        ...current,
        status: 'running',
        lastMessage: 'Retomando operação'
      });
    }

    const completedItems = await this.getCompletedItems(operationId);
    for await (const entry of this.readJsonLines(this.getManifestPath(operationId))) {
      if (completedItems.has(entry.relativePath)) {
        continue;
      }

      const currentState = await this.getState(operationId);
      if (currentState?.cancelRequested) {
        await this.updateState(operationId, {
          status: 'cancelled',
          lastMessage: 'Operação cancelada com segurança'
        });
        return this.toResult(await this.getState(operationId));
      }

      if (entry.kind === 'directory') {
        if (action === 'copy' || action === 'move') {
          await fs.mkdir(path.join(safeTargetPath, entry.relativePath), { recursive: true });
        }
        continue;
      }

      const destination = action === 'delete'
        ? null
        : sourceStats.isDirectory()
          ? path.join(safeTargetPath, options.preserveStructure === false ? path.basename(entry.relativePath) : entry.relativePath)
          : safeTargetPath;

      const outcome = await this.processEntry(operationId, action, entry, destination, options);
      await this.recordOutcome(operationId, entry.relativePath, outcome);
      await this.emitProgress(operationId, entry.relativePath, options.onProgress);
    }

    if (action === 'move' || action === 'delete') {
      await this.removeEmptySourceDirectories(operationId, safeSourcePath);
    }

    const finalState = await this.getState(operationId);
    const hasIssues = finalState.counts.conflicts > 0 || finalState.counts.failed > 0;
    await this.updateState(operationId, {
      status: hasIssues ? (finalState.counts.conflicts > 0 ? 'conflict' : 'partial') : 'completed',
      lastMessage: hasIssues ? 'Operação concluída com pendências' : 'Operação concluída'
    });
    const result = this.toResult(await this.getState(operationId));
    if (typeof options.onProgress === 'function') {
      options.onProgress({
        operationId,
        percentage: 100,
        total: result.counts.total,
        status: result.status,
        counts: result.counts,
        message: result.message
      });
    }
    return result;
  }

  async processEntry(operationId, action, entry, destination, options) {
    try {
      if (action === 'copy') {
        await this.copyFileToTarget(operationId, entry.path, destination, entry.relativePath, options);
        return { status: 'processed' };
      }
      if (action === 'move') {
        await this.moveFileToTarget(operationId, entry.path, destination, entry.relativePath, options);
        return { status: 'processed' };
      }
      if (action === 'delete') {
        await this.quarantineFile(operationId, entry.path, entry.relativePath);
        return { status: 'processed' };
      }
      throw new Error(`Ação não suportada: ${action}`);
    } catch (error) {
      if (error.code === 'TARGET_CONFLICT') {
        return { status: 'conflict', error: error.message };
      }
      if (error.code === 'ENOENT') {
        return { status: 'failed', error: 'Origem desapareceu antes do processamento' };
      }
      this.logger.error('Erro ao processar item transacional', {
        operationId,
        relativePath: entry.relativePath,
        error: error.message
      });
      return { status: 'failed', error: error.message };
    }
  }

  async recordOutcome(operationId, relativePath, outcome) {
    const eventType = outcome.status === 'processed'
      ? 'item-committed'
      : outcome.status === 'conflict'
        ? 'item-conflict'
        : outcome.status === 'skipped'
          ? 'item-skipped'
          : 'item-failed';
    await this.appendProgress(operationId, {
      type: eventType,
      relativePath,
      error: outcome.error || null
    });
    const state = await this.getState(operationId);
    const counts = { ...state.counts };
    if (outcome.status === 'processed') counts.processed += 1;
    if (outcome.status === 'skipped') counts.skipped += 1;
    if (outcome.status === 'conflict') counts.conflicts += 1;
    if (outcome.status === 'failed') counts.failed += 1;
    await this.updateState(operationId, {
      counts,
      lastMessage: `${relativePath}: ${outcome.status}`
    });
  }

  async emitProgress(operationId, relativePath, onProgress) {
    const state = await this.getState(operationId);
    if (typeof onProgress === 'function') {
      onProgress({
        operationId,
        percentage: state.counts.total > 0
          ? Math.round(((state.counts.processed + state.counts.skipped + state.counts.conflicts + state.counts.failed) / state.counts.total) * 100)
          : 100,
        total: state.counts.total,
        status: state.status,
        counts: state.counts,
        message: state.lastMessage,
        current: relativePath
      });
    }
  }

  async syncPath(filePath) {
    const handle = await fs.open(filePath, 'r+');
    try {
      await handle.sync();
    } finally {
      await handle.close();
    }
  }

  async pathExists(filePath) {
    try {
      await fs.lstat(filePath);
      return true;
    } catch (error) {
      if (error.code === 'ENOENT') return false;
      throw error;
    }
  }

  async assertDestinationAvailable(destination, options) {
    if (!await this.pathExists(destination)) {
      return;
    }
    if (!options.overwrite) {
      throw new OperationConflictError(`Destino já existe: ${destination}`);
    }
  }

  async copyFileToTarget(operationId, sourcePath, destination, relativePath, options = {}) {
    const sourceStats = await fs.stat(sourcePath);
    await this.assertDestinationAvailable(destination, options);
    await fs.mkdir(path.dirname(destination), { recursive: true });

    if (await this.pathExists(destination) && options.overwrite) {
      await this.quarantineExistingTarget(operationId, destination, `replaced-${relativePath}`);
    }

    const tempPath = `${destination}.depara-partial-${this.safeOperationId(operationId)}-${crypto.randomBytes(4).toString('hex')}`;
    await this.appendProgress(operationId, { type: 'temp-created', tempPath, relativePath });
    const hash = crypto.createHash('sha256');
    const digestTransform = new Transform({
      transform(chunk, encoding, callback) {
        hash.update(chunk);
        callback(null, chunk);
      }
    });

    try {
      await pipeline(
        fsSync.createReadStream(sourcePath),
        digestTransform,
        fsSync.createWriteStream(tempPath, { flags: 'wx' })
      );
      await this.syncPath(tempPath);
      const finalSourceStats = await fs.stat(sourcePath);
      const targetStats = await fs.stat(tempPath);
      if (targetStats.size !== sourceStats.size) {
        throw new Error(`Verificação de tamanho falhou para ${sourcePath}`);
      }
      const sourceChanged = finalSourceStats.size !== sourceStats.size
        || finalSourceStats.mtimeMs !== sourceStats.mtimeMs;
      if (await this.pathExists(destination)) {
        if (!options.overwrite) {
          throw new OperationConflictError(`Destino criado durante a operação: ${destination}`);
        }
        await this.quarantineExistingTarget(operationId, destination, `replaced-${relativePath}`);
      }
      await fs.rename(tempPath, destination);
      await this.appendProgress(operationId, {
        type: 'published',
        relativePath,
        tempPath,
        fingerprint: hash.digest('hex'),
        size: targetStats.size,
        sourceChanged
      });
      if (sourceChanged) {
        const error = new Error(`Origem mudou durante a cópia: ${sourcePath}`);
        error.code = 'SOURCE_CHANGED';
        throw error;
      }
      return { sourceChanged };
    } catch (error) {
      await fs.rm(tempPath, { force: true });
      throw error;
    }
  }

  async moveFileToTarget(operationId, sourcePath, destination, relativePath, options = {}) {
    const sourceStats = await fs.stat(sourcePath);
    await this.assertDestinationAvailable(destination, options);
    await fs.mkdir(path.dirname(destination), { recursive: true });

    if (await this.pathExists(destination) && options.overwrite) {
      await this.quarantineExistingTarget(operationId, destination, `replaced-${relativePath}`);
    }

    let sameVolume = true;
    try {
      const destinationParent = await fs.stat(path.dirname(destination));
      sameVolume = destinationParent.dev === sourceStats.dev;
    } catch {
      sameVolume = true;
    }

    if (sameVolume) {
      try {
        await fs.rename(sourcePath, destination);
        await this.appendProgress(operationId, {
          type: 'published',
          relativePath,
          sourcePath,
          destination,
          mode: 'rename',
          size: sourceStats.size
        });
        return { sourceChanged: false };
      } catch (error) {
        if (error.code !== 'EXDEV') {
          if ((error.code === 'EEXIST' || error.code === 'EPERM') && await this.pathExists(destination)) {
            throw new OperationConflictError(`Destino já existe: ${destination}`);
          }
          throw error;
        }
      }
    }

    await this.copyFileToTarget(operationId, sourcePath, destination, relativePath, {
      ...options,
      moveSourceAfterCopy: true
    });
    await fs.unlink(sourcePath);
    await this.appendProgress(operationId, {
      type: 'source-removed',
      relativePath,
      sourcePath,
      destination
    });
    return { sourceChanged: false };
  }

  getQuarantineOperationDir(operationId) {
    return path.join(this.quarantineDir, this.safeOperationId(operationId));
  }

  async quarantineFile(operationId, sourcePath, relativePath) {
    const sourceStats = await fs.stat(sourcePath);
    const quarantineOperationDir = this.getQuarantineOperationDir(operationId);
    const payloadDir = path.join(quarantineOperationDir, 'payload');
    await fs.mkdir(payloadDir, { recursive: true });
    const entryId = `${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const payloadPath = path.join(payloadDir, `${entryId}-${path.basename(sourcePath)}`);
    const recoveryPath = path.join(quarantineOperationDir, 'recovery.jsonl');
    const recoveryEntry = {
      entryId,
      operationId,
      originalPath: sourcePath,
      payloadPath,
      relativePath,
      size: sourceStats.size,
      mode: 'rename',
      restored: false,
      state: 'pending'
    };
    await this.appendJsonLine(recoveryPath, recoveryEntry);

    let mode = 'rename';
    try {
      await fs.rename(sourcePath, payloadPath);
    } catch (error) {
      if (error.code !== 'EXDEV') throw error;
      mode = 'copy';
      await this.copyFileToTarget(operationId, sourcePath, payloadPath, `quarantine/${relativePath}`, {});
      await fs.unlink(sourcePath);
    }

    await this.appendJsonLine(recoveryPath, {
      ...recoveryEntry,
      mode,
      state: 'quarantined'
    });
    await this.appendProgress(operationId, {
      type: 'recovery-entry',
      relativePath,
      entryId,
      originalPath: sourcePath,
      payloadPath
    });
  }

  async quarantineExistingTarget(operationId, targetPath, relativePath) {
    await this.quarantineFile(operationId, targetPath, relativePath);
  }

  async removeEmptySourceDirectories(operationId, sourcePath) {
    const state = await this.getState(operationId);
    if (!state || !fsSync.existsSync(sourcePath)) {
      return;
    }

    const sourceStats = await fs.lstat(sourcePath);
    if (!sourceStats.isDirectory()) {
      return;
    }

    const directories = [];
    for await (const entry of this.walkDirectory(sourcePath, '', 0)) {
      if (entry.kind === 'directory') directories.push(entry.path);
    }
    directories.sort((left, right) => right.length - left.length);
    for (const directory of directories) {
      await fs.rmdir(directory).catch(() => {});
    }
    await fs.rmdir(sourcePath).catch(() => {});
  }

  toResult(state) {
    return {
      success: state.status === 'completed',
      operationId: state.operationId,
      status: state.status,
      counts: state.counts,
      recoverable: state.action === 'delete'
        || (state.status !== 'completed' && state.status !== 'cancelled'),
      message: state.lastMessage,
      duration: new Date(state.updatedAt).getTime() - new Date(state.createdAt).getTime()
    };
  }

  async cancel(operationId) {
    const state = await this.getState(operationId);
    if (!state) {
      return false;
    }
    await this.updateState(operationId, {
      cancelRequested: true,
      lastMessage: 'Cancelamento solicitado'
    });
    return true;
  }

  async beginDrain(timeoutMs = 30000) {
    this.draining = true;
    const active = Array.from(this.activeOperations.values());
    if (active.length === 0) {
      return true;
    }

    let timeout;
    const timeoutPromise = new Promise((resolve) => {
      timeout = setTimeout(() => resolve(false), timeoutMs);
    });
    const completed = Promise.allSettled(active).then(() => true);
    const result = await Promise.race([completed, timeoutPromise]);
    clearTimeout(timeout);
    return result;
  }

  endDrain() {
    this.draining = false;
  }

  async readRecoveryEntries() {
    let operationDirs = [];
    try {
      operationDirs = await fs.readdir(this.quarantineDir, { withFileTypes: true });
    } catch {
      return [];
    }

    const entriesById = new Map();
    for (const operationDir of operationDirs) {
      if (!operationDir.isDirectory()) continue;
      const recoveryPath = path.join(this.quarantineDir, operationDir.name, 'recovery.jsonl');
      for await (const entry of this.readJsonLines(recoveryPath)) {
        if (entry.entryId) {
          entriesById.set(entry.entryId, { entry, recoveryPath });
        }
      }
    }
    return [...entriesById.values()];
  }

  async listRecovery() {
    const entries = [];
    for (const { entry } of await this.readRecoveryEntries()) {
      if (!entry.restored && await this.pathExists(entry.payloadPath)) {
        entries.push(entry);
      }
    }
    return entries;
  }

  async restoreRecovery(entryId) {
    const entries = await this.readRecoveryEntries();
    const match = entries.find(({ entry }) => (
      entry.entryId === entryId
      && !entry.restored
      && fsSync.existsSync(entry.payloadPath)
    ));
    if (!match) return null;
    const { entry, recoveryPath } = match;
    if (await this.pathExists(entry.originalPath)) {
      throw new OperationConflictError(`O caminho original já existe: ${entry.originalPath}`);
    }
    await fs.mkdir(path.dirname(entry.originalPath), { recursive: true });
    try {
      await fs.rename(entry.payloadPath, entry.originalPath);
    } catch (error) {
      if (error.code !== 'EXDEV') throw error;
      await this.copyFileToTarget(entry.operationId, entry.payloadPath, entry.originalPath, `restore/${entry.relativePath}`, {});
      await fs.unlink(entry.payloadPath);
    }

    const recoveryEntries = [];
    for await (const current of this.readJsonLines(recoveryPath)) {
      recoveryEntries.push(current.entryId === entryId ? { ...current, restored: true } : current);
    }
    await fs.rm(recoveryPath, { force: true });
    for (const current of recoveryEntries) {
      await this.appendJsonLine(recoveryPath, current);
    }
    return { ...entry, restored: true };
  }
}

module.exports = {
  TransactionalOperations,
  OperationConflictError
};
