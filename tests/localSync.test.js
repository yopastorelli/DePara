const fs = require('fs').promises;
const os = require('os');
const path = require('path');
jest.mock('../src/utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(), operationError: jest.fn(), startOperation: jest.fn(), endOperation: jest.fn() }));
const { LocalSyncManager } = require('../src/utils/fileSync/localSyncManager');
const { TransactionalOperations } = require('../src/utils/fileOps/transactionalOperations');
const storage = require('../src/utils/fileSync/storage');

describe('Sincronização local transacional', () => {
  let root;
  let source;
  let target;
  let manager;
  let job;
  let engine;
  let volumeId;
  const quiet = { warn() {}, error() {} };
  async function execute(kind = 'run', extra = {}) {
    const run = await manager.start(job.id, kind, extra);
    await manager.controllers.get(run.id)?.completion;
    return manager.getRun(run.id);
  }
  async function change(content) {
    await fs.writeFile(path.join(source, 'foto.txt'), content);
    const time = new Date(Date.now() + content.length * 2000);
    await fs.utimes(path.join(source, 'foto.txt'), time, time);
  }
  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'depara-sync-'));
    source = path.join(root, 'source'); target = path.join(root, 'target');
    await fs.mkdir(source); await fs.mkdir(target);
    engine = new TransactionalOperations({ dataDir: path.join(root, 'data'), quarantineDir: path.join(root, 'quarantine'), logger: quiet });
    await engine.init();
    const files = {
      init: async () => {}, transactionalOperations: engine,
      validateSafePath: async (candidate) => {
        if (!storage.within(path.resolve(candidate), root)) throw new Error('Fora da base de teste');
        try { return await fs.realpath(candidate); } catch (error) { if (error.code === 'ENOENT') return path.resolve(candidate); throw error; }
      }
    };
    volumeId = 'test-volume';
    manager = new LocalSyncManager({ root: path.join(root, 'runs'), jobsFile: path.join(root, 'jobs.json'), files: () => files,
      volume: async () => ({ id: volumeId }), space: async () => {}, resources: () => ({ canStartWork: true }) });
    job = await manager.create({ name: 'Teste', sourcePath: source, targetPath: target });
    await change('primeira');
    expect((await execute('preview')).status).toBe('completed');
  });
  afterEach(async () => {
    jest.restoreAllMocks();
    await manager.stop();
    await fs.rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  it('preview não modifica o destino; execuções têm ids novos e ignoram iguais sem hash', async () => {
    expect(await fs.readdir(target)).toEqual([]);
    const first = await execute();
    const hash = jest.spyOn(storage, 'hash');
    const second = await execute();
    expect(first.status).toBe('completed');
    expect(second.id).not.toBe(first.id);
    expect(second.counts.equal).toBe(1);
    expect(second.processed).toBe(0);
    expect(hash).not.toHaveBeenCalled();
    expect(await manager.history(job.id, 'foto.txt')).toEqual([]);
  });

  it.each([1, 3, 5])('preserva atual e %i anteriores com retenção auditada', async (retention) => {
    await manager.update(job.id, { retention });
    await execute();
    for (let index = 0; index < 7; index++) { await change(`versão ${index} ${'x'.repeat(index)}`); expect((await execute()).status).toBe('completed'); }
    const versions = await manager.history(job.id, 'foto.txt');
    expect(versions).toHaveLength(retention);
    expect(await fs.readFile(path.join(target, 'foto.txt'), 'utf8')).toBe(`versão 6 ${'x'.repeat(6)}`);
    expect((await fs.readdir(path.join(manager.area(job), 'versions', require('crypto').createHash('sha256').update('foto.txt').digest('hex'))))).toHaveLength(retention);
  });

  it('não cria versão para mudança apenas de data e preserva extras e arquivos .bak', async () => {
    await fs.mkdir(path.join(source, 'vazia'));
    await fs.writeFile(path.join(source, 'arquivo.bak'), 'importante');
    await execute();
    expect((await fs.stat(path.join(target, 'vazia'))).isDirectory()).toBe(true);
    await fs.writeFile(path.join(target, 'extra.txt'), 'preservar');
    await fs.utimes(path.join(source, 'foto.txt'), new Date(), new Date());
    const run = await execute();
    expect(run.counts.equal).toBe(2);
    expect(run.counts.extra).toBe(1);
    expect(await manager.history(job.id, 'foto.txt')).toHaveLength(0);
    expect(await fs.readFile(path.join(target, 'arquivo.bak'), 'utf8')).toBe('importante');
    await fs.unlink(path.join(source, 'foto.txt'));
    await execute();
    expect(await fs.readFile(path.join(target, 'foto.txt'), 'utf8')).toBe('primeira');
  });

  it('exige resolução de edição no destino e preserva conteúdo manual no histórico', async () => {
    await execute();
    await fs.writeFile(path.join(target, 'foto.txt'), 'edição manual');
    const run = await execute();
    expect(run.status).toBe('partial');
    const item = (await manager.results(run.id)).items.find((entry) => entry.type === 'conflict');
    expect(await fs.readFile(path.join(target, 'foto.txt'), 'utf8')).toBe('edição manual');
    const resolved = await execute('resolve', { ...item, choice: 'source' });
    expect(resolved.status).toBe('completed');
    const versions = await manager.history(job.id, 'foto.txt');
    expect(await fs.readFile(manager.versionPath(job, 'foto.txt', versions[0].id), 'utf8')).toBe('edição manual');
  });

  it('verificação completa detecta alteração conservando tamanho e data', async () => {
    await execute();
    const file = path.join(target, 'foto.txt');
    const before = await fs.stat(file);
    await fs.writeFile(file, 'alterada');
    await fs.utimes(file, before.atime, before.mtime);
    expect((await execute('verify')).status).toBe('partial');
    expect(await fs.readFile(file, 'utf8')).toBe('alterada');
  });

  it('cópia somente novos não substitui existentes nem cria histórico', async () => {
    job.mode = 'new-only';
    await execute(); await change('segunda versão');
    const run = await execute();
    expect(run.counts.preserved).toBe(1);
    expect(await fs.readFile(path.join(target, 'foto.txt'), 'utf8')).toBe('primeira');
    expect(await manager.history(job.id, 'foto.txt')).toHaveLength(0);
  });

  it('falha antes de preservar mantém destino; nova execução recupera journal staged', async () => {
    await execute(); await change('segunda versão');
    const finish = jest.spyOn(manager, 'finishPublish').mockRejectedValueOnce(new Error('interrupção'));
    expect((await execute()).status).toBe('failed');
    expect(await fs.readFile(path.join(target, 'foto.txt'), 'utf8')).toBe('primeira');
    finish.mockRestore();
    expect((await execute()).status).toBe('completed');
    expect(await fs.readFile(path.join(target, 'foto.txt'), 'utf8')).toBe('segunda versão');
  });

  it('recupera interrupção após mover destino ao histórico e antes da publicação', async () => {
    await execute(); await change('segunda versão');
    const original = fs.link.bind(fs);
    let interrupted = false;
    jest.spyOn(fs, 'link').mockImplementation(async (from, to) => {
      if (!interrupted && path.basename(from).startsWith('.depara-partial-') && to === path.join(target, 'foto.txt')) {
        interrupted = true; throw new Error('interrupção de energia simulada');
      }
      return original(from, to);
    });
    expect((await execute()).status).toBe('failed');
    jest.restoreAllMocks();
    expect((await execute()).status).toBe('completed');
    expect(await fs.readFile(path.join(target, 'foto.txt'), 'utf8')).toBe('segunda versão');
    expect(await manager.history(job.id, 'foto.txt')).toHaveLength(1);
  });

  it('bloqueia disco substituído, falta de espaço e pressão de memória sem modificar destino', async () => {
    volumeId = 'another-volume';
    expect((await execute()).status).toBe('paused');
    expect(await fs.readdir(target)).toEqual([]);
    volumeId = 'test-volume';
    manager.checkSpace = async () => { throw storage.failure('Sem espaço', 'NO_SPACE'); };
    expect((await execute()).status).toBe('paused');
    expect(await fs.readdir(target)).toEqual([]);
    expect(await storage.stats(path.join(target, 'foto.txt'))).toBeNull();
    manager.resources = () => ({ canStartWork: false });
    expect((await execute()).status).toBe('paused');
  });

  it('restaura versão em outro caminho e sobre atual preservando histórico', async () => {
    await execute(); await change('nova versão'); await execute();
    const [version] = await manager.history(job.id, 'foto.txt');
    const restored = path.join(root, 'recuperado.txt');
    expect((await execute('restore', { relative: 'foto.txt', versionId: version.id, targetPath: restored })).status).toBe('completed');
    expect(await fs.readFile(restored, 'utf8')).toBe('primeira');
    expect((await execute('restore', { relative: 'foto.txt', versionId: version.id, replace: true, confirm: true })).status).toBe('completed');
    expect(await fs.readFile(path.join(target, 'foto.txt'), 'utf8')).toBe('primeira');
    expect(await manager.history(job.id, 'foto.txt')).toHaveLength(2);
  });

  it('compartilha fila com operações existentes e bloqueia agendas antes da primeira cópia', async () => {
    manager.importing = true;
    await expect(manager.start(job.id, 'preview')).rejects.toThrow(/ocupada/);
    manager.importing = false;
    await expect(manager.update(job.id, { active: true, frequency: '1h' })).rejects.toThrow(/manualmente/);
    const order = [];
    const first = engine.withExclusiveWork('manual', async () => { order.push('manual'); });
    const second = engine.withExclusiveWork('sync', async () => { order.push('sync'); });
    await Promise.all([first, second]); expect(order).toEqual(['manual', 'sync']);
    await execute();
    await manager.update(job.id, { active: true, frequency: '1h' });
    await manager.replaceJobs(JSON.parse(JSON.stringify(await manager.list())));
    expect((await manager.job(job.id)).active).toBe(false);
    expect((await manager.job(job.id)).reviewed).toBe(false);
  });

  it('rejeita sobreposição, traversal e corrupção intermediária de journal', async () => {
    await expect(manager.create({ name: 'inválido', sourcePath: source, targetPath: source })).rejects.toThrow(/sobrepostas/);
    expect(() => storage.relativeTarget(target, '..\\fora.txt')).toThrow();
    const file = path.join(root, 'bad.jsonl'); await fs.writeFile(file, '{bad}\n{"valid":true}\n');
    await expect((async () => { for await (const entry of storage.lines(file)) void entry; })()).rejects.toThrow();
    await expect(manager.update(job.id, { frequency: 'constructor' })).rejects.toThrow(/inválida/);
    manager.inspectVolume = async () => ({ id: 'test-volume', filesystem: 'exFAT' });
    await expect(manager.validate(job, true)).rejects.toThrow(/NTFS/);
  });

  it('API retorna 202, pagina resultados e expõe erros sem alterar operações existentes', async () => {
    const express = require('express');
    const request = require('supertest');
    jest.doMock('../src/utils/fileSync/localSyncManager', () => manager);
    const app = express(); app.use(express.json());
    app.use('/api/sync', require('../src/routes/fileSync'));
    try {
      await request(app).get('/api/sync/jobs').expect(200);
      const response = await request(app).post(`/api/sync/jobs/${job.id}/run`).send({}).expect(202);
      const id = response.body.data.id;
      await manager.controllers.get(id)?.completion;
      const result = await request(app).get(`/api/sync/runs/${id}`).expect(200);
      expect(result.body.data.status).toBe('completed');
      const page = await request(app).get(`/api/sync/runs/${id}/results`).expect(200);
      expect(page.body.data.items[0].relative).toBe('foto.txt');
      await request(app).get(`/api/sync/runs/${id}/results?offset=-1`).expect(400);
      await request(app).post('/api/sync/jobs/missing/run').send({}).expect(404);
      await request(app).delete(`/api/sync/jobs/${job.id}`).expect(200);
      expect(await fs.readFile(path.join(target, 'foto.txt'), 'utf8')).toBe('primeira');
    } finally { jest.dontMock('../src/utils/fileSync/localSyncManager'); }
  });

  it('cancela cópia em preparação e mantém destino anterior', async () => {
    await execute(); await change('segunda versão');
    const original = storage.copyVerified;
    let abort;
    const entered = new Promise((resolve) => { abort = resolve; });
    jest.spyOn(storage, 'copyVerified').mockImplementation(async (from, to, signal) => {
      abort();
      await new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(Object.assign(new Error('cancelado'), { name: 'AbortError' })), { once: true }));
      return original(from, to, signal);
    });
    const run = await manager.start(job.id, 'run');
    await entered;
    const completion = manager.controllers.get(run.id).completion;
    await manager.cancel(run.id); await completion;
    expect((await manager.getRun(run.id)).status).toBe('cancelled');
    expect(await fs.readFile(path.join(target, 'foto.txt'), 'utf8')).toBe('primeira');
  });

  it('rejeita junctions e preserva versões corrompidas em vez de limpar', async () => {
    await execute();
    await fs.mkdir(path.join(root, 'outside'));
    await fs.symlink(path.join(root, 'outside'), path.join(source, 'link'), 'junction');
    const preview = await execute('preview');
    expect(preview.status).toBe('partial');
    await fs.rmdir(path.join(source, 'link'));
    await manager.update(job.id, { retention: 1 });
    await change('versão dois'); await execute();
    const [version] = await manager.history(job.id, 'foto.txt');
    await fs.writeFile(manager.versionPath(job, 'foto.txt', version.id), 'corrompida');
    await change('versão três');
    expect((await execute()).status).toBe('failed');
    expect(await fs.readFile(manager.versionPath(job, 'foto.txt', version.id), 'utf8')).toBe('corrompida');
  });

  it('não sobrescreve destino criado por outro processo na janela de publicação', async () => {
    const original = fs.link.bind(fs);
    let intercepted = false;
    jest.spyOn(fs, 'link').mockImplementation(async (from, to) => {
      if (!intercepted && to === path.join(target, 'foto.txt')) {
        intercepted = true; await fs.writeFile(to, 'outro processo');
      }
      return original(from, to);
    });
    expect((await execute()).status).toBe('failed');
    expect(await fs.readFile(path.join(target, 'foto.txt'), 'utf8')).toBe('outro processo');
    expect(await fs.readFile(path.join(source, 'foto.txt'), 'utf8')).toBe('primeira');
  });

  it('preserva pastas vazias, pagina preview e recupera final truncado', async () => {
    await fs.mkdir(path.join(source, 'vazia'));
    for (let index = 0; index < 105; index++) await fs.writeFile(path.join(source, `${index}.txt`), 'x');
    const preview = await execute('preview');
    const first = await manager.results(preview.id);
    expect(first.items).toHaveLength(100); expect(first.nextOffset).toBe(100);
    const second = await manager.results(preview.id, 100);
    expect(second.items.length).toBe(7);
    expect(second.nextOffset).toBeNull();
    const log = path.join(root, 'tail.jsonl');
    await fs.writeFile(log, '{"transaction":null}\n{"transac');
    await storage.repairTail(log);
    expect(await fs.readFile(log, 'utf8')).toBe('{"transaction":null}\n');
    await fs.writeFile(path.join(root, 'recover.json.previous'), '{"safe":true}');
    expect(await storage.json(path.join(root, 'recover.json'))).toEqual({ safe: true });
  });

  it('disco de origem ausente pausa sem propagar exclusões', async () => {
    await execute();
    await change('segunda versão'); await execute();
    const [version] = await manager.history(job.id, 'foto.txt');
    await fs.rename(source, path.join(root, 'offline'));
    expect((await execute()).status).toBe('paused');
    expect(await fs.readFile(path.join(target, 'foto.txt'), 'utf8')).toBe('segunda versão');
    const recovered = path.join(root, 'sem-origem.txt');
    expect((await execute('restore', { relative: 'foto.txt', versionId: version.id, targetPath: recovered })).status).toBe('completed');
    expect(await fs.readFile(recovered, 'utf8')).toBe('primeira');
  });

  it('arquivo instável fica pendente e não impede copiar os demais', async () => {
    await fs.writeFile(path.join(source, 'outro.txt'), 'outro conteúdo');
    const original = storage.copyVerified;
    jest.spyOn(storage, 'copyVerified').mockImplementation(async (from, to, signal) => {
      if (path.basename(from) === 'foto.txt') throw storage.failure('Origem instável', 'SOURCE_CHANGED');
      return original(from, to, signal);
    });
    const run = await execute();
    expect(run.status).toBe('partial');
    expect(run.counts.blocked).toBe(1);
    expect(await fs.readFile(path.join(target, 'outro.txt'), 'utf8')).toBe('outro conteúdo');
    expect(await storage.stats(path.join(target, 'foto.txt'))).toBeNull();
  });

  it('configuração de sincronização corrompida não impede inicializar outros recursos', async () => {
    const jobsFile = path.join(root, 'invalid-jobs.json');
    await fs.writeFile(jobsFile, '[null]');
    const broken = new LocalSyncManager({ jobsFile });
    await expect(broken.init()).resolves.toBeUndefined();
    await expect(broken.list()).rejects.toMatchObject({ code: 'CONFIG_CORRUPT' });
    expect(await fs.readFile(jobsFile, 'utf8')).toBe('[null]');
    await broken.stop();
  });
});
