const fs = require('fs').promises;
const os = require('os');
const path = require('path');
const { performance } = require('perf_hooks');

async function main() {
  const argument = (name, fallback) => Number(process.argv.find((entry) => entry.startsWith(`--${name}=`))?.split('=')[1] || fallback);
  const count = argument('files', 50);
  const largeBytes = argument('large-bytes', 0);
  const scanOnly = process.argv.includes('--scan-only');
  const realVolume = process.argv.includes('--real-volume');
  if (!Number.isInteger(count) || count < 1 || count > 50000 || !Number.isSafeInteger(largeBytes) || largeBytes < 0 || largeBytes > 1073741824) throw new Error('Parâmetros fora dos limites');
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'depara-sync-audit-'));
  process.env.DEPARA_RUNTIME_ROOT = path.join(root, 'runtime');
  process.env.LOG_FILE = path.join(root, 'runtime', 'logs', 'audit.log');
  process.env.NODE_ENV = 'test';
  const { LocalSyncManager } = require('../src/utils/fileSync/localSyncManager');
  const { TransactionalOperations } = require('../src/utils/fileOps/transactionalOperations');
  const storage = require('../src/utils/fileSync/storage');
  const source = path.join(root, 'source'); const target = path.join(root, 'target');
  const engine = new TransactionalOperations({ dataDir: path.join(root, 'data'), quarantineDir: path.join(root, 'quarantine'), logger: { warn() {}, error() {} } });
  const files = { init: async () => {}, transactionalOperations: engine, validateSafePath: async (candidate) => {
    if (!storage.within(path.resolve(candidate), root)) throw new Error('Fora do ambiente temporário');
    return path.resolve(candidate);
  } };
  const manager = new LocalSyncManager({ root: path.join(root, 'runs'), jobsFile: path.join(root, 'jobs.json'), files: () => files,
    volume: realVolume ? storage.volume : async () => ({ id: 'synthetic-same-volume', filesystem: 'NTFS' }), resources: () => ({ canStartWork: true }) });
  try {
    await fs.mkdir(source); await fs.mkdir(target); await engine.init();
    for (let index = 0; index < count; index++) {
      await fs.writeFile(path.join(source, `${index}.txt`), `conteúdo sintético ${index}`);
      if (index && index % 5000 === 0) process.stderr.write(`Fixtures: ${index}/${count}\n`);
    }
    if (largeBytes) {
      const handle = await fs.open(path.join(source, 'large.bin'), 'w');
      try { await handle.truncate(largeBytes); } finally { await handle.close(); }
    }
    const job = await manager.create({ name: 'Auditoria sintética', sourcePath: source, targetPath: target });
    const results = [];
    async function measure(kind, label) {
      let peakRss = process.memoryUsage().rss;
      let largestTick = 0; let lastTick = performance.now();
      const timer = setInterval(() => {
        peakRss = Math.max(peakRss, process.memoryUsage().rss);
        const now = performance.now(); largestTick = Math.max(largestTick, now - lastTick); lastTick = now;
      }, 50);
      const started = performance.now();
      try {
        const run = await manager.start(job.id, kind);
        await manager.controllers.get(run.id)?.completion;
        const state = await manager.getRun(run.id);
        results.push({ label, durationMs: Math.round(performance.now() - started), peakRssMiB: +(peakRss / 1048576).toFixed(1),
          largestTimerGapMs: Math.round(largestTick), status: state.status, counts: state.counts, processed: state.processed });
        if (state.status !== 'completed') throw new Error(JSON.stringify(state));
      } finally { clearInterval(timer); }
    }
    for (let repetition = 0; repetition < 3; repetition++) await measure('preview', 'preview');
    if (!scanOnly) {
      await measure('run', 'initial-copy');
      for (let repetition = 0; repetition < 3; repetition++) await measure('run', 'unchanged');
      for (let index = 0; index < Math.max(1, Math.floor(count / 100)); index++) await fs.writeFile(path.join(source, `${index}.txt`), `atualizado ${index}`);
      await measure('run', 'changed-1-percent');
      await measure('verify', 'full-verification');
    }
    process.stdout.write(`${JSON.stringify({ synthetic: true, volumeIdentitySimulated: !realVolume, physicalTwoDrivePilot: false, count, largeBytes, scanOnly, results }, null, 2)}\n`);
  } finally {
    await manager.stop();
    require('../src/utils/logger').stopBufferFlush();
    const resolved = await fs.realpath(root);
    if (!storage.within(resolved, await fs.realpath(os.tmpdir())) || !path.basename(resolved).startsWith('depara-sync-audit-')) throw new Error('Limpeza fora da base temporária bloqueada');
    await fs.rm(resolved, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}
main().catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
