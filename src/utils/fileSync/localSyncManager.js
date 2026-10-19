const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { getRuntimeDataDir, getRuntimeRoot } = require('../runtimePaths');
const { getResourceStatus } = require('../resourceGuard');
const store = require('./storage');

const FREQUENCIES = { manual: 0, '1h': 3600000, '6h': 21600000, '1d': 86400000 };
const identifier = () => crypto.randomUUID();
const fileKey = (relative) => crypto.createHash('sha256').update(relative.toLowerCase()).digest('hex');
const ignored = (name) => [store.RESERVED, 'system volume information', '$recycle.bin', 'thumbs.db', 'desktop.ini'].includes(name.toLowerCase())
  || name.includes('.depara-partial-');

class LocalSyncManager {
  constructor(options = {}) {
    this.root = options.root || path.join(getRuntimeDataDir(), 'file-sync');
    this.jobsFile = options.jobsFile || path.join(getRuntimeDataDir(), 'sync-jobs.json');
    this.files = options.files || (() => require('../fileOperations'));
    this.inspectVolume = options.volume || store.volume;
    this.checkSpace = options.space || store.space;
    this.resources = options.resources || getResourceStatus;
    this.jobs = [];
    this.active = new Map();
    this.controllers = new Map();
    this.timers = new Map();
    this.ready = null;
    this.stopped = false;
    this.volumeCache = new Map();
    this.retries = new Map();
    this.pendingStates = new Map();
    this.knownRepositories = new Set();
  }

  async init() {
    if (!this.ready) this.ready = (async () => {
      const persisted = await store.json(this.jobsFile, { version: 1, jobs: [] });
      this.jobs = Array.isArray(persisted) ? persisted : persisted?.version === 1 ? persisted.jobs : null;
      if (!Array.isArray(this.jobs)) throw store.failure('Configuração de sincronização inválida');
      const ids = new Set();
      for (const job of this.jobs) {
        if (!job || !/^[a-f0-9-]{36}$/.test(job.id) || ids.has(job.id) || !['new-only', 'versioned'].includes(job.mode)
            || ![1, 3, 5].includes(job.retention) || !Object.hasOwn(FREQUENCIES, job.frequency)
            || typeof job.sourcePath !== 'string' || typeof job.targetPath !== 'string') throw store.failure('Configuração de sincronização inválida');
        ids.add(job.id);
      }
      for (const job of this.jobs) this.arm(job);
    })().catch(() => {
      this.loadError = 'Configuração de sincronização inválida; restaure sync-jobs.json antes de usar este recurso';
      this.jobs = [];
    });
    return this.ready;
  }

  async save() { await store.writeJsonAtomic(this.jobsFile, { version: 1, jobs: this.jobs }); }
  assertRelationships(roots, ignoredId) {
    for (const job of this.jobs) {
      if (job.id === ignoredId) continue;
      if ([roots.sourcePath, roots.targetPath].some((candidate) => store.within(candidate, job.targetPath) || store.within(job.targetPath, candidate))
          || store.within(roots.targetPath, job.sourcePath) || store.within(job.sourcePath, roots.targetPath)) throw store.failure('Job sobreposto ou ciclo entre sincronizações');
    }
  }
  async review(id, input = {}) {
    const job = await this.job(id);
    if (this.active.has(id)) throw store.failure('Execução em andamento');
    return this.exclusive(`sync-review-${identifier()}`, async () => {
      if (this.active.has(id)) throw store.failure('Execução em andamento');
      const roots = input.destinationOnly === true
        ? await this.destinationRoots(job, input.targetPath)
        : await this.roots(input.sourcePath || job.sourcePath, input.targetPath || job.targetPath);
      this.assertRelationships(roots, id);
      const source = input.destinationOnly === true ? { id: job.sourceVolume } : await this.inspectVolume(roots.sourcePath);
      const target = await this.inspectVolume(roots.targetPath);
      if (target.filesystem && target.filesystem !== 'NTFS') throw store.failure('O destino deve usar NTFS');
      const changed = job.sourceVolume && job.sourceVolume !== source.id || job.targetVolume && job.targetVolume !== target.id;
      if (changed && input.confirmIdentityChange !== true) throw store.failure('Discos divergentes; confirme explicitamente o novo vínculo', 'VOLUME_CHANGED');
      const area = path.join(roots.targetPath, store.RESERVED, job.id);
      const candidate = { ...job, ...roots };
      await this.guardInternal(candidate, path.join(area, 'repository.json'));
      const repository = await store.json(path.join(area, 'repository.json'));
      if (repository && repository.id !== id || !repository && job.firstRun) throw store.failure('Repositório anterior não encontrado nesse destino');
      Object.assign(job, roots);
      job.sourceVolume = source.id;
      job.targetVolume = target.id;
      job.active = false;
      job.reviewed = false;
      if (repository) await store.writeJsonAtomic(path.join(area, 'repository.json'), { ...repository, targetVolume: target.id });
      await this.save();
      return job;
    });
  }
  assertHealthy() { if (this.loadError) throw store.failure(this.loadError, 'CONFIG_CORRUPT', 503); }
  async list() { await this.init(); this.assertHealthy(); return this.jobs.map((job) => ({ ...job, activeRun: this.active.get(job.id) })); }
  async volumeInfo(root, force = false) {
    const cached = this.volumeCache.get(root);
    if (!force && cached && Date.now() - cached.time < 300000) return cached.info;
    const info = await this.inspectVolume(root);
    this.volumeCache.set(root, { info, time: Date.now() });
    return info;
  }
  async job(id) {
    await this.init();
    this.assertHealthy();
    const job = this.jobs.find((entry) => entry.id === id);
    if (!job) throw store.failure('Sincronização não encontrada', 'NOT_FOUND', 404);
    return job;
  }

  async exclusive(id, work) {
    if (this.importing) throw store.failure('Importação de configuração em andamento');
    const files = this.files();
    await files.init();
    return files.transactionalOperations.withExclusiveWork(id, work);
  }

  async roots(source, target) {
    const files = this.files();
    const sourcePath = await files.validateSafePath(source, 'read');
    const targetPath = await files.validateSafePath(target, 'write');
    const sourceStats = await store.stats(sourcePath);
    const targetStats = await store.stats(targetPath);
    if (!sourceStats?.directory || !targetStats?.directory) {
      throw store.failure('Selecione duas pastas locais existentes', 'ROOT_UNAVAILABLE');
    }
    if (!path.isAbsolute(sourcePath) || sourcePath.startsWith('\\\\') || targetPath.startsWith('\\\\')) throw store.failure('Use pastas em discos locais');
    if (store.within(sourcePath, targetPath) || store.within(targetPath, sourcePath)) throw store.failure('Pastas iguais ou sobrepostas');
    for (const candidate of [sourcePath, targetPath]) {
      if (candidate.toLowerCase().split(path.sep).includes(store.RESERVED)
          || store.within(candidate, getRuntimeRoot()) || store.within(getRuntimeRoot(), candidate)) throw store.failure('Pasta reservada ou raiz contendo o runtime');
    }
    return { sourcePath, targetPath, sourceDevice: sourceStats.device, targetDevice: targetStats.device };
  }

  async destinationRoots(job, target = job.targetPath) {
    const targetPath = await this.files().validateSafePath(target, 'write');
    const metadata = await store.stats(targetPath);
    if (!metadata?.directory || targetPath.startsWith('\\\\')) throw store.failure('Destino indisponível', 'ROOT_UNAVAILABLE');
    if (store.within(targetPath, getRuntimeRoot()) || store.within(getRuntimeRoot(), targetPath)
        || targetPath.toLowerCase().split(path.sep).includes(store.RESERVED)) throw store.failure('Destino reservado');
    return { sourcePath: job.sourcePath, targetPath, targetDevice: metadata.device };
  }

  async create(input) {
    if (!input || typeof input !== 'object') throw store.failure('Configuração obrigatória', 'INVALID_CONFIG', 400);
    await this.init();
    this.assertHealthy();
    return this.exclusive(`sync-config-${identifier()}`, async () => {
      const roots = await this.roots(input.sourcePath, input.targetPath);
      const mode = input.mode || 'versioned';
      const retention = Number(input.retention ?? 3);
      if (!['new-only', 'versioned'].includes(mode) || ![1, 3, 5].includes(retention)) throw store.failure('Modo ou retenção inválida', 'INVALID_CONFIG', 400);
      if (!String(input.name || '').trim()) throw store.failure('Nome obrigatório', 'INVALID_CONFIG', 400);
      this.assertRelationships(roots);
      const sourceVolume = await this.inspectVolume(roots.sourcePath);
      const targetVolume = await this.inspectVolume(roots.targetPath);
      if (targetVolume.filesystem && targetVolume.filesystem !== 'NTFS') throw store.failure('O destino de sincronização deve usar NTFS');
      const job = { id: identifier(), name: String(input.name).trim().slice(0, 120), ...roots, mode, retention,
        sourceVolume: sourceVolume.id, targetVolume: targetVolume.id, frequency: 'manual', active: false,
        reviewed: false, firstRun: false, createdAt: new Date().toISOString() };
      this.jobs.push(job);
      await this.save();
      return job;
    });
  }

  async update(id, input) {
    const job = await this.job(id);
    if (this.active.has(id)) throw store.failure('Aguarde a execução terminar');
    return this.exclusive(`sync-edit-${identifier()}`, async () => {
      if (this.active.has(id)) throw store.failure('Aguarde a execução terminar');
      const frequency = input.frequency ?? job.frequency;
      const retention = Number(input.retention ?? job.retention);
      if (!Object.hasOwn(FREQUENCIES, frequency) || ![1, 3, 5].includes(retention)) throw store.failure('Configuração inválida', 'INVALID_CONFIG', 400);
      if (input.active && (!job.firstRun || !job.reviewed)) throw store.failure('Revise o preview e execute manualmente antes de agendar');
      if (input.sourcePath || input.targetPath || input.mode) throw store.failure('Crie um novo job para mudar pastas ou modo');
      if (input.name !== undefined && !String(input.name).trim()) throw store.failure('Nome obrigatório');
      Object.assign(job, { frequency, retention, active: input.active === undefined ? job.active : input.active === true });
      if (input.name !== undefined) job.name = String(input.name).trim().slice(0, 120);
      await this.save();
      if (!job.active) { clearTimeout(this.retries.get(id)); this.retries.delete(id); }
      this.arm(job);
      return job;
    });
  }

  arm(job) {
    clearInterval(this.timers.get(job.id));
    this.timers.delete(job.id);
    if (this.stopped || !job.active || !job.firstRun || !job.reviewed || !Object.hasOwn(FREQUENCIES, job.frequency) || !FREQUENCIES[job.frequency]) return;
    const timer = setInterval(() => {
      if (!this.active.has(job.id)) this.start(job.id, 'run').catch(() => {});
    }, FREQUENCIES[job.frequency]);
    timer.unref();
    this.timers.set(job.id, timer);
  }

  async remove(id) {
    await this.job(id);
    if (this.active.has(id)) throw store.failure('Execução em andamento');
    return this.exclusive(`sync-remove-${identifier()}`, async () => {
      if (this.active.has(id)) throw store.failure('Execução em andamento');
      clearInterval(this.timers.get(id));
      this.timers.delete(id);
      this.jobs = this.jobs.filter((job) => job.id !== id);
      this.knownRepositories.delete(id);
      clearTimeout(this.retries.get(id)); this.retries.delete(id);
      await this.save();
    });
  }

  area(job) { return path.join(job.targetPath, store.RESERVED, job.id); }
  recordPath(job, relative) {
    const key = fileKey(relative);
    return path.join(this.area(job), 'index', key.slice(0, 2), `${key}.json`);
  }
  pendingPath(job) { return path.join(this.area(job), 'pending.jsonl'); }
  async readPending(job) {
    if (this.pendingStates.has(job.id)) return this.pendingStates.get(job.id);
    let transaction = null;
    for await (const event of store.lines(this.pendingPath(job))) {
      if (!Object.hasOwn(event, 'transaction') || event.transaction !== null && typeof event.transaction !== 'object') throw store.failure('Registro de journal inválido');
      transaction = event.transaction;
    }
    this.pendingStates.set(job.id, transaction);
    return transaction;
  }
  async writePending(job, transaction) {
    await store.repairTail(this.pendingPath(job));
    await store.append(this.pendingPath(job), { transaction });
    this.pendingStates.set(job.id, transaction);
  }
  async compactPending(job) {
    if (await this.readPending(job)) return;
    const destination = this.pendingPath(job);
    const temp = `${destination}.compact`;
    await this.guardInternal(job, temp);
    const handle = await fs.open(temp, 'w');
    try { await handle.writeFile('{"transaction":null}\n'); await handle.sync(); }
    finally { await handle.close(); }
    await fs.rename(temp, destination);
  }
  async record(job, relative) {
    await this.guardInternal(job, this.recordPath(job, relative));
    const record = await store.json(this.recordPath(job, relative));
    if (record && record.relative !== relative) throw store.failure('Colisão de caminhos no destino');
    if (record && (!/^[a-f0-9]{64}$/.test(record.hash) || !Array.isArray(record.versions) || record.versions.length > 1000)) throw store.failure('Índice de versões inválido');
    return record;
  }
  versionPath(job, relative, versionId) {
    if (!/^[a-f0-9-]{36}$/.test(versionId)) throw store.failure('Versão inválida');
    return path.join(this.area(job), 'versions', fileKey(relative), versionId);
  }

  async guardInternal(job, file) {
    const reserved = path.join(job.targetPath, store.RESERVED);
    if (!store.within(file, reserved)) throw store.failure('Caminho interno inválido');
    let current = job.targetPath;
    for (const component of path.relative(job.targetPath, file).split(path.sep)) {
      current = path.join(current, component);
      const metadata = await store.stats(current);
      if (!metadata) break;
    }
  }

  async validate(job, force = false, destinationOnly = false) {
    if ((!destinationOnly && !job.sourceVolume) || !job.targetVolume) throw store.failure('Revise as pastas e vincule os discos importados');
    const roots = destinationOnly ? await this.destinationRoots(job) : await this.roots(job.sourcePath, job.targetPath);
    if (roots.sourcePath !== job.sourcePath || roots.targetPath !== job.targetPath) throw store.failure('Pastas foram redirecionadas');
    if (!destinationOnly && job.sourceDevice !== undefined && roots.sourceDevice !== job.sourceDevice || job.targetDevice !== undefined && roots.targetDevice !== job.targetDevice) throw store.failure('Identidade do disco mudou', 'VOLUME_CHANGED');
    const source = destinationOnly ? { id: job.sourceVolume } : await this.volumeInfo(job.sourcePath, force);
    const target = await this.volumeInfo(job.targetPath, force);
    if (target.filesystem && target.filesystem !== 'NTFS') throw store.failure('O destino de sincronização deve usar NTFS');
    if (source.id !== job.sourceVolume || target.id !== job.targetVolume) throw store.failure('Identidade do disco mudou', 'VOLUME_CHANGED');
    await store.safeTree(job.targetPath, `${store.RESERVED}-check`);
    const reserved = path.join(job.targetPath, store.RESERVED);
    const reservedStats = await store.stats(reserved);
    if (reservedStats && !reservedStats.directory) throw store.failure('Área de backup inválida');
    if (reservedStats && !store.within(await fs.realpath(reserved), job.targetPath)) throw store.failure('Área de backup redirecionada');
    const area = await store.stats(this.area(job));
    if (area && !area.directory) throw store.failure('Repositório inválido');
    if (area && !store.within(await fs.realpath(this.area(job)), reserved)) throw store.failure('Repositório redirecionado');
    await this.guardInternal(job, path.join(this.area(job), 'repository.json'));
    await this.guardInternal(job, this.pendingPath(job));
    const identity = await store.json(path.join(this.area(job), 'repository.json'));
    if (!identity && (job.firstRun || this.knownRepositories.has(job.id))) throw store.failure('Repositório de backup indisponível', 'ROOT_UNAVAILABLE');
    if (area && !identity) {
      const entries = await fs.readdir(this.area(job));
      if (entries.some((name) => !name.startsWith('repository.json.tmp-'))) throw store.failure('Inicialização de backup inconsistente');
    }
    if (identity && (identity.id !== job.id || identity.targetVolume !== job.targetVolume)) throw store.failure('Identidade do backup inválida');
    return identity;
  }

  async* walk(root, relative = '', depth = 0) {
    if (depth > 100) throw store.failure('Profundidade de pastas excedida');
    const directory = await fs.opendir(relative ? path.join(root, relative) : root);
    for await (const entry of directory) {
      if (ignored(entry.name)) continue;
      const next = path.join(relative, entry.name);
      try {
        const file = await store.safeTree(root, next);
        const metadata = await store.stats(file);
        if (metadata?.directory) {
          yield { relative: next, metadata, directory: true };
          yield* this.walk(root, next, depth + 1);
        }
        else if (metadata?.file) yield { relative: next, metadata };
        else yield { relative: next, error: 'Arquivo indisponível ou especial' };
      } catch (error) { yield { relative: next, error: error.message }; }
    }
  }

  async classify(job, entry, verify, signal) {
    if (entry.error) return { relative: entry.relative, type: 'blocked', error: entry.error };
    const sourcePath = store.relativeTarget(job.sourcePath, entry.relative);
    const targetPath = await store.safeTree(job.targetPath, entry.relative);
    const source = entry.metadata || await store.stats(sourcePath);
    const target = await store.stats(targetPath);
    if (entry.directory) return { relative: entry.relative, type: target ? target.directory ? 'directory' : 'conflict' : 'new-directory' };
    const record = await this.record(job, entry.relative);
    if (!source?.file || target && !target.file) return { relative: entry.relative, type: 'conflict', error: 'Tipo de arquivo mudou' };
    if (!target) return { relative: entry.relative, type: 'new', source, target: null };
    if (record && sameRecord(record, source, target) && !verify) return { relative: entry.relative, type: 'equal', source, target };
    const sourceHash = await store.hash(sourcePath, signal);
    const targetHash = await store.hash(targetPath, signal);
    if (!store.same(source, await store.stats(sourcePath)) || !store.same(target, await store.stats(targetPath))) throw store.failure('Arquivo instável', 'SOURCE_CHANGED');
    let type = sourceHash === targetHash ? 'equal' : job.mode === 'new-only' ? 'preserved' : 'changed';
    if (record && targetHash !== record.hash) type = 'conflict';
    if (verify && record && sameRecord(record, source, target) && sourceHash !== record.hash) type = 'integrity';
    return { relative: entry.relative, type, source, target, sourceHash, targetHash };
  }

  async checkWork(signal) {
    signal.throwIfAborted();
    if (!this.resources().canStartWork) throw store.failure('Execução pausada por pressão de memória', 'RESOURCE_CONSTRAINED', 503);
  }

  async start(id, kind = 'preview', extra = {}) {
    const job = await this.job(id);
    if (this.stopped || this.importing || this.active.has(id)) throw store.failure('Sincronização ocupada ou encerrando');
    if (kind === 'run' && !job.reviewed) throw store.failure('Gere e revise o preview primeiro');
    const runId = identifier();
    const controller = new AbortController();
    this.controllers.set(runId, controller);
    this.active.set(id, runId);
    const run = { id: runId, jobId: id, kind, status: 'queued', startedAt: new Date().toISOString(), counts: {}, bytes: 0, historyBytes: 0, copiedBytes: 0, processed: 0 };
    try { await this.persistRun(run); }
    catch (error) { this.active.delete(id); this.controllers.delete(runId); throw error; }
    const completion = this.exclusive(runId, () => this.execute(job, run, controller.signal, extra))
      .catch(async (error) => {
        run.status = controller.signal.aborted ? 'cancelled' : ['RESOURCE_CONSTRAINED', 'NO_SPACE', 'VOLUME_CHANGED', 'VOLUME_UNAVAILABLE', 'ROOT_UNAVAILABLE', 'ENOENT', 'ENOSPC', 'EIO'].includes(error.code) ? 'paused' : 'failed';
        run.error = error.message;
        run.code = error.code;
        run.finishedAt = new Date().toISOString();
        job.lastRun = { id: run.id, status: run.status, kind: run.kind, finishedAt: run.finishedAt };
        await this.save();
        await this.persistRun(run);
      }).finally(() => { this.active.delete(id); this.controllers.delete(runId); });
    this.controllers.get(runId).completion = completion;
    completion.then(() => {
      if (run.code !== 'RESOURCE_CONSTRAINED' || this.stopped || controller.signal.aborted) return;
      const retry = setTimeout(() => {
        this.retries.delete(id);
        if (!this.stopped && !this.active.has(id)) this.start(id, kind, extra).catch(() => {});
      }, 30000);
      retry.unref(); this.retries.set(id, retry);
    }).catch(() => {});
    return run;
  }

  runDir(id) {
    if (!/^[a-f0-9-]{36}$/.test(id)) throw store.failure('Execução inválida');
    return path.join(this.root, id);
  }
  async persistRun(run) { await store.writeJsonAtomic(path.join(this.runDir(run.id), 'state.json'), { ...run, updatedAt: new Date().toISOString() }); }
  async getRun(id) {
    const run = await store.json(path.join(this.runDir(id), 'state.json'));
    if (!run) throw store.failure('Execução não encontrada', 'NOT_FOUND', 404);
    if (!this.controllers.has(id) && ['running', 'queued'].includes(run.status)) run.status = 'interrupted';
    return run;
  }
  async results(id, offset = 0) {
    await this.getRun(id);
    const items = [];
    let index = 0;
    let more = false;
    for await (const item of store.lines(path.join(this.runDir(id), 'results.jsonl'))) {
      if (index++ < offset) continue;
      if (items.length === 100) { more = true; break; }
      items.push(item);
    }
    return { items, nextOffset: more ? offset + items.length : null };
  }
  async cancel(id) {
    const run = await this.getRun(id);
    this.controllers.get(id)?.abort();
    if (this.retries.has(run.jobId) || run.status === 'paused') {
      clearTimeout(this.retries.get(run.jobId)); this.retries.delete(run.jobId);
      run.status = 'cancelled'; await this.persistRun(run);
      const job = this.jobs.find((entry) => entry.id === run.jobId);
      if (job?.lastRun?.id === id) { job.lastRun.status = 'cancelled'; await this.save(); }
    }
  }

  async prepare(job, destinationOnly = false) {
    const identity = await this.validate(job, false, destinationOnly);
    if (!identity) {
      await fs.mkdir(this.area(job), { recursive: true });
      await store.writeJsonAtomic(path.join(this.area(job), 'repository.json'), { id: job.id, targetVolume: job.targetVolume, version: 1,
        job: { ...job, active: false, reviewed: false, frequency: 'manual' } });
    }
    this.knownRepositories.add(job.id);
    await this.recover(job);
  }

  async execute(job, run, signal, extra) {
    await this.checkWork(signal);
    this.pendingStates.delete(job.id);
    await this.validate(job, true, run.kind === 'restore');
    if (run.kind === 'run') run.space = await this.checkSpace(job.targetPath, job.previewBytes || 0);
    if (run.kind !== 'preview' && run.kind !== 'verify') await this.prepare(job, run.kind === 'restore');
    else if (await this.readPending(job)) throw store.failure('Execute o job para reconciliar a transação interrompida');
    run.status = 'running';
    await this.persistRun(run);
    let lastProgress = 0;
    const process = async (entry) => {
      await this.checkWork(signal);
      let item;
      try { item = await this.classify(job, entry, run.kind === 'verify', signal); }
      catch (error) {
        if (signal.aborted || ['ENOENT', 'ENOSPC', 'EIO'].includes(error.code)) throw error;
        item = { relative: entry.relative, type: 'blocked', error: error.message };
      }
      run.counts[item.type] = (run.counts[item.type] || 0) + 1;
      if (run.kind === 'run' && item.type === 'new-directory') {
        await this.writePending(job, { id: identifier(), relative: item.relative, kind: 'directory', stage: 'copying' });
        await this.recover(job);
      }
      if (['new', 'changed'].includes(item.type)) run.bytes += item.source.size;
      if (item.type === 'changed') run.historyBytes += item.target.size;
      if (run.kind === 'run' && ['new', 'changed'].includes(item.type)) {
        try {
          await this.publish(job, item, run, signal);
          run.processed++;
          run.copiedBytes += item.source.size;
        } catch (error) {
          if (signal.aborted || ['ENOSPC', 'EIO', 'NO_SPACE', 'ENOENT', 'VOLUME_CHANGED'].includes(error.code)
              || await this.readPending(job)) throw error;
          run.counts[item.type]--;
          run.counts.blocked = (run.counts.blocked || 0) + 1;
          item = { ...item, type: 'blocked', error: error.message };
        }
      } else if (run.kind === 'run' && item.type === 'equal' && item.sourceHash) {
        const previous = await this.record(job, item.relative);
        await store.writeJsonAtomic(this.recordPath(job, item.relative), { relative: item.relative, hash: item.sourceHash,
          source: item.source, target: item.target, versions: previous?.versions || [] });
      }
      await store.append(path.join(this.runDir(run.id), 'results.jsonl'), item, false);
      if (Date.now() - lastProgress >= 1000) { await this.persistRun(run); lastProgress = Date.now(); }
    };
    if (run.kind === 'restore') {
      await this.restore(job.id, extra, run, signal);
    } else if (run.kind === 'resolve') {
      const entryPath = await store.safeTree(job.sourcePath, extra.relative);
      const item = await this.classify(job, { relative: extra.relative, metadata: await store.stats(entryPath) }, true, signal);
      if (item.sourceHash !== extra.sourceHash || item.targetHash !== extra.targetHash) throw store.failure('Conflito mudou; atualize o preview');
      if (extra.choice === 'source') await this.publish(job, { ...item, type: 'changed' }, run, signal);
      else if (extra.choice !== 'target') throw store.failure('Escolha de conflito inválida');
      await store.append(path.join(this.runDir(run.id), 'results.jsonl'), { ...item, resolution: extra.choice }, false);
    } else {
      for await (const entry of this.walk(job.sourcePath)) await process(entry);
      for await (const entry of this.walk(job.targetPath)) {
        await this.checkWork(signal);
        if (!await store.stats(await store.safeTree(job.sourcePath, entry.relative))) {
          run.counts.extra = (run.counts.extra || 0) + 1;
          await store.append(path.join(this.runDir(run.id), 'results.jsonl'), { relative: entry.relative, type: 'extra' }, false);
        }
      }
      if (run.kind === 'verify') await this.verifyHistory(job, run, signal);
    }
    await this.validate(job, false, run.kind === 'restore');
    if (run.kind === 'preview') { run.space = await this.checkSpace(job.targetPath, run.bytes); job.previewBytes = run.bytes; job.reviewed = true; }
    if (run.kind === 'run') job.firstRun = true;
    if (!['preview', 'verify'].includes(run.kind)) await this.compactPending(job);
    run.status = ['conflict', 'blocked', 'integrity'].some((key) => run.counts[key]) ? 'partial' : 'completed';
    run.finishedAt = new Date().toISOString();
    job.lastRun = { id: run.id, status: run.status, kind: run.kind, finishedAt: run.finishedAt };
    await this.save();
    await this.persistRun(run);
  }

  async publish(job, item, run, signal, sourceOverride = null) {
    await this.validate(job, false, Boolean(sourceOverride));
    const source = sourceOverride || await store.safeTree(job.sourcePath, item.relative);
    const target = await store.safeTree(job.targetPath, item.relative);
    await this.checkSpace(job.targetPath, item.source.size);
    const previous = await this.record(job, item.relative);
    if (!store.same(item.source, await store.stats(source)) || !equalOptional(item.target, await store.stats(target))) throw store.failure('Arquivos mudaram após o planejamento');
    const transaction = { relative: item.relative, id: identifier(), stage: 'copying', runId: run.id, previous,
      oldHash: item.targetHash || previous?.hash || null, expectedTarget: item.target, source: item.source };
    transaction.tempName = `.depara-partial-${transaction.id}`;
    await this.writePending(job, transaction);
    const temp = path.join(path.dirname(target), transaction.tempName);
    try {
      await fs.mkdir(path.dirname(target), { recursive: true });
      const copied = await store.copyVerified(source, temp, signal);
      if (!store.same(item.source, await store.stats(source))) throw store.failure('Origem mudou durante a verificação', 'SOURCE_CHANGED');
      if (!equalOptional(item.target, await store.stats(target))) throw store.failure('Destino mudou durante a cópia');
      if (item.target && transaction.oldHash && await store.hash(target, signal) !== transaction.oldHash) throw store.failure('Destino mudou durante a cópia');
      if (item.sourceHash && copied.fingerprint !== item.sourceHash) throw store.failure('Origem mudou desde o preview');
      transaction.hash = copied.fingerprint;
      transaction.stage = 'staged';
      if (item.target) {
        transaction.version = { id: identifier(), hash: transaction.oldHash || await store.hash(target, signal), createdAt: new Date().toISOString(), size: item.target.size };
      }
      await this.writePending(job, transaction);
      signal.throwIfAborted();
      await this.finishPublish(job, transaction);
    } catch (error) {
      if (transaction.stage === 'copying') {
        await fs.rm(temp, { force: true });
        await this.writePending(job, null);
      }
      throw error;
    }
  }

  async finishPublish(job, transaction) {
    const target = await store.safeTree(job.targetPath, transaction.relative);
    const temp = path.join(path.dirname(target), transaction.tempName);
    if (transaction.stage === 'staged') {
      if (transaction.version) {
        const versionPath = this.versionPath(job, transaction.relative, transaction.version.id);
        await this.guardInternal(job, versionPath);
        await fs.mkdir(path.dirname(versionPath), { recursive: true });
        if (!await store.stats(versionPath)) {
          if (!equalOptional(transaction.expectedTarget, await store.stats(target)) || await store.hash(target) !== transaction.version.hash) throw store.failure('Destino mudou antes da publicação');
          await fs.rename(target, versionPath);
        }
      } else if (await store.stats(target) && await store.hash(target) !== transaction.hash) throw store.failure('Destino apareceu durante a cópia');
      transaction.stage = 'preserved';
    }
    if (transaction.stage === 'preserved') {
      if (!await store.stats(target)) {
        if (!await store.stats(temp) || await store.hash(temp) !== transaction.hash) {
          if (transaction.version) {
            const version = this.versionPath(job, transaction.relative, transaction.version.id);
            await fs.link(version, target);
            await fs.unlink(version);
          }
          await this.writePending(job, null);
          throw store.failure('Publicação incompleta revertida; execute novamente');
        }
        await fs.link(temp, target);
      } else if (await store.hash(target) !== transaction.hash) throw store.failure('Publicação interrompida com destino divergente');
      await fs.rm(temp, { force: true });
      await fs.utimes(target, new Date(), new Date(transaction.source.mtimeMs));
      transaction.stage = 'published';
    }
    if (transaction.stage === 'published') {
      if (await store.hash(target) !== transaction.hash) throw store.failure('Conteúdo publicado divergente');
      const versions = [...(transaction.previous?.versions || []), ...(transaction.version ? [transaction.version] : [])];
      transaction.record = { relative: transaction.relative, hash: transaction.hash, source: transaction.source, target: await store.stats(target), versions };
      await store.writeJsonAtomic(this.recordPath(job, transaction.relative), transaction.record);
      transaction.stage = 'committed';
      await this.writePending(job, transaction);
    }
    if (transaction.stage === 'committed') {
      const record = transaction.record;
      while (record.versions.length > job.retention) {
        const oldest = record.versions[0];
        const versionPath = this.versionPath(job, transaction.relative, oldest.id);
        await this.guardInternal(job, versionPath);
        if (await store.stats(versionPath) && await store.hash(versionPath) !== oldest.hash) throw store.failure('Versão corrompida; limpeza bloqueada', 'INTEGRITY');
        await store.append(path.join(this.area(job), 'retention.jsonl'), { type: 'delete-intent', relative: transaction.relative, versionId: oldest.id });
        await fs.rm(versionPath, { force: true });
        record.versions.shift();
        await store.writeJsonAtomic(this.recordPath(job, transaction.relative), record);
        await store.append(path.join(this.area(job), 'retention.jsonl'), { type: 'deleted', relative: transaction.relative, versionId: oldest.id });
        await this.writePending(job, transaction);
      }
      await this.writePending(job, null);
    }
  }

  async recover(job) {
    const transaction = await this.readPending(job);
    if (!transaction) return;
    if (transaction.kind === 'directory') {
      if (!/^[a-f0-9-]{36}$/.test(transaction.id)) throw store.failure('Journal inválido');
      const directory = await store.safeTree(job.targetPath, transaction.relative);
      await fs.mkdir(directory, { recursive: true });
      await this.writePending(job, null);
      return;
    }
    if (!/^[a-f0-9-]{36}$/.test(transaction.id) || transaction.tempName !== `.depara-partial-${transaction.id}`) throw store.failure('Journal inválido');
    if (!['copying', 'staged', 'preserved', 'published', 'committed'].includes(transaction.stage)) throw store.failure('Etapa de journal inválida');
    if (transaction.stage === 'copying') {
      const target = await store.safeTree(job.targetPath, transaction.relative);
      await fs.rm(path.join(path.dirname(target), transaction.tempName), { force: true });
      await this.writePending(job, null);
      return;
    }
    await this.finishPublish(job, transaction);
  }

  async verifyHistory(job, run, signal) {
    const indexRoot = path.join(this.area(job), 'index');
    await this.guardInternal(job, indexRoot);
    if (!await store.stats(indexRoot)) return;
    for await (const entry of this.walk(indexRoot)) {
      await this.checkWork(signal);
      if (entry.error) throw store.failure('Índice inacessível');
      if (!entry.relative.endsWith('.json')) continue;
      const record = await store.json(path.join(indexRoot, entry.relative));
      const expected = this.recordPath(job, record.relative);
      if (path.resolve(indexRoot, entry.relative) !== expected) throw store.failure('Índice com identidade inválida');
      await this.record(job, record.relative);
      for (const version of record.versions) {
        const file = this.versionPath(job, record.relative, version.id);
        await this.guardInternal(job, file);
        let valid = false;
        try { valid = await store.hash(file, signal) === version.hash; }
        catch (error) { if (signal.aborted) throw error; }
        if (!valid) {
          run.counts.integrity = (run.counts.integrity || 0) + 1;
          await store.append(path.join(this.runDir(run.id), 'results.jsonl'), { type: 'integrity', relative: record.relative, versionId: version.id }, false);
        }
      }
    }
  }

  async history(id, relative) {
    const job = await this.job(id);
    await this.validate(job, false, true);
    store.relativeTarget(job.targetPath, relative);
    return (await this.record(job, relative))?.versions || [];
  }

  async restore(id, input, run, signal) {
    const job = await this.job(id);
    const versions = await this.history(id, input.relative);
    const version = versions.find((entry) => entry.id === input.versionId);
    if (!version) throw store.failure('Versão não encontrada', 'NOT_FOUND', 404);
    const source = this.versionPath(job, input.relative, version.id);
    await this.guardInternal(job, source);
    if (await store.hash(source) !== version.hash) throw store.failure('Versão corrompida');
    if (input.replace === true) {
      if (input.confirm !== true) throw store.failure('Confirme a substituição do arquivo atual');
      const target = await store.safeTree(job.targetPath, input.relative);
      const targetStats = await store.stats(target);
      const item = { relative: input.relative, source: await store.stats(source), sourceHash: version.hash, target: targetStats,
        targetHash: targetStats ? await store.hash(target, signal) : null };
      await this.publish(job, item, run, signal, source);
      return;
    }
    const target = await this.files().validateSafePath(input.targetPath, 'write');
    if (this.jobs.some((entry) => store.within(target, entry.targetPath) || store.within(target, entry.sourcePath))) throw store.failure('Restaure fora das pastas sincronizadas');
    let parent = path.dirname(target);
    while (!await store.stats(parent)) {
      const next = path.dirname(parent);
      if (next === parent) throw store.failure('Pasta de restauração indisponível');
      parent = next;
    }
    const volume = await this.inspectVolume(parent);
    if (volume.filesystem && volume.filesystem !== 'NTFS') throw store.failure('Restaure em destino NTFS');
    await this.checkSpace(parent, version.size);
    const result = await this.files().transactionalOperations.runOperation(run.id, 'copy', source, target,
      { exclusivePublish: true, expectedFingerprint: version.hash });
    if (!result.success) throw store.failure(result.message);
    await store.append(path.join(this.runDir(run.id), 'results.jsonl'), { relative: input.relative, type: 'restored', targetPath: target });
  }

  async replaceJobs(jobs, imported = true) {
    await this.init();
    if (!Array.isArray(jobs) || this.active.size) throw store.failure('Não é possível importar sincronizações agora');
    const normalized = [];
    for (const job of jobs) {
      if (!job || !/^[a-f0-9-]{36}$/.test(job.id) || !['new-only', 'versioned'].includes(job.mode)
          || ![1, 3, 5].includes(job.retention) || !job.sourcePath || !job.targetPath || !Object.hasOwn(FREQUENCIES, job.frequency)
          || normalized.some((previous) => previous.id === job.id)) throw store.failure('Job importado inválido');
      normalized.push({ ...job, active: imported ? false : job.active, reviewed: imported ? false : job.reviewed });
    }
    for (const timer of this.timers.values()) clearInterval(timer);
    this.timers.clear();
    this.jobs = normalized;
    await this.save();
    for (const job of this.jobs) this.arm(job);
    return this.jobs;
  }

  async stop() {
    this.stopped = true;
    for (const timer of this.timers.values()) clearInterval(timer);
    this.timers.clear();
    for (const retry of this.retries.values()) clearTimeout(retry);
    this.retries.clear();
    for (const controller of this.controllers.values()) controller.abort();
    let timeout;
    await Promise.race([
      Promise.allSettled([...this.controllers.values()].map((controller) => controller.completion)),
      new Promise((resolve) => { timeout = setTimeout(resolve, 30000); timeout.unref(); })
    ]);
    clearTimeout(timeout);
  }
}

function sameRecord(record, source, target) { return store.same(record.source, source) && store.same(record.target, target); }
function equalOptional(left, right) { return left === null && right === null || store.same(left, right); }

const manager = new LocalSyncManager();
module.exports = manager;
module.exports.LocalSyncManager = LocalSyncManager;
