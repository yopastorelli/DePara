const fs = require('fs').promises;
const os = require('os');
const path = require('path');

const PROFILES = {
  small: { files: 100, images: 50, depth: 3 },
  medium: { files: 1000, images: 250, depth: 5 },
  large: { files: 10000, images: 1000, depth: 7 }
};

const PNG_FIXTURE = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
);

function parseArguments(argv) {
  const options = {
    profile: 'small',
    files: null,
    images: null,
    depth: null,
    output: path.join(process.cwd(), 'performance-results', `depara-audit-${Date.now()}.json`)
  };

  for (const argument of argv) {
    const [key, value] = argument.split('=', 2);
    if (key === '--profile' && PROFILES[value]) options.profile = value;
    if (key === '--files') options.files = Number(value);
    if (key === '--images') options.images = Number(value);
    if (key === '--depth') options.depth = Number(value);
    if (key === '--output' && value) options.output = path.resolve(value);
  }

  const profile = PROFILES[options.profile];
  options.files = Number.isFinite(options.files) ? Math.max(0, options.files) : profile.files;
  options.images = Number.isFinite(options.images) ? Math.max(0, options.images) : profile.images;
  options.depth = Number.isFinite(options.depth) ? Math.max(1, options.depth) : profile.depth;
  return options;
}

function memorySnapshot() {
  const memory = process.memoryUsage();
  return {
    rss: memory.rss,
    heapUsed: memory.heapUsed,
    heapTotal: memory.heapTotal,
    external: memory.external,
    arrayBuffers: memory.arrayBuffers
  };
}

function memoryDelta(before, after) {
  return Object.fromEntries(Object.keys(after).map((key) => [key, after[key] - before[key]]));
}

async function createDataset(root, options) {
  const inputDir = path.join(root, 'input');
  const imagesDir = path.join(root, 'images');
  await fs.mkdir(inputDir, { recursive: true });
  await fs.mkdir(imagesDir, { recursive: true });

  for (let index = 0; index < options.files; index += 1) {
    const level = index % options.depth;
    const directory = path.join(inputDir, ...Array.from({ length: level }, (_, depth) => `level-${depth}`));
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(path.join(directory, `fixture-${index}.dat`), 'depara-performance-fixture');
  }

  for (let index = 0; index < options.images; index += 1) {
    const level = index % options.depth;
    const directory = path.join(imagesDir, ...Array.from({ length: level }, (_, depth) => `level-${depth}`));
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(path.join(directory, `image-${index}.png`), PNG_FIXTURE);
  }

  return { inputDir, imagesDir };
}

async function requestJson(baseUrl, route, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(`${baseUrl}${route}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    });
    const body = await response.json();
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${body?.error?.details || body?.error || response.statusText}`);
    }
    return body;
  } finally {
    clearTimeout(timeout);
  }
}

async function measure(name, task, summarizeResult = (value) => value) {
  const before = memorySnapshot();
  const startedAt = process.hrtime.bigint();
  let result;
  let error = null;

  try {
    result = await task();
  } catch (taskError) {
    error = taskError;
  }

  const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
  const after = memorySnapshot();
  return {
    name,
    durationMs: Math.round(durationMs * 100) / 100,
    success: !error,
    error: error ? error.message : null,
    memoryBefore: before,
    memoryAfter: after,
    memoryDelta: memoryDelta(before, after),
    result: result === undefined ? undefined : summarizeResult(result)
  };
}

async function run() {
  const options = parseArguments(process.argv.slice(2));
  const auditRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'depara-performance-'));
  const runtimeRoot = path.join(auditRoot, 'runtime');
  const dataset = await createDataset(auditRoot, options);

  process.env.DEPARA_RUNTIME_ROOT = runtimeRoot;
  process.env.DEPARA_ALLOWED_PATHS = [auditRoot, runtimeRoot].join(path.delimiter);
  process.env.DEPARA_DISABLE_UPDATE_SCHEDULER = 'true';
  process.env.DEPARA_DISABLE_PROCESS_HOOKS = 'true';
  process.env.DEPARA_HTTP_LOGGING = 'false';
  process.env.LOG_LEVEL = 'error';
  process.env.LOG_TO_CONSOLE = 'false';
  process.env.NODE_ENV = 'test';

  const app = require('../src/main');
  const measurements = [];
  let server;

  try {
    server = await app.startServer({ port: 0 });
    const address = server.address();
    const baseUrl = `http://127.0.0.1:${address.port}`;

    measurements.push(await measure(
      'health',
      () => requestJson(baseUrl, '/health'),
      (result) => ({ status: result.status, version: result.version })
    ));
    measurements.push(await measure(
      'status-resources',
      () => requestJson(baseUrl, '/api/status/resources'),
      (result) => ({
        processRss: result.memory?.process?.rss,
        processHeapUsed: result.memory?.process?.heapUsed,
        driveCount: result.disk?.drives?.length || 0
      })
    ));
    measurements.push(await measure(
      'status-resources-concurrent-x5',
      () => Promise.all(Array.from({ length: 5 }, () => requestJson(baseUrl, '/api/status/resources'))),
      (results) => ({ responses: results.length })
    ));
    const imageMeasurement = await measure('list-images', () => requestJson(baseUrl, '/api/files/list-images', {
      method: 'POST',
      body: JSON.stringify({
        folderPath: dataset.imagesDir,
        recursive: true,
        extensions: ['.png']
      })
    }), (result) => ({
      totalCount: result.data?.totalCount,
      limited: result.data?.limited,
      pageSize: result.data?.pagination?.pageSize,
      pageStatus: result.data?.pagination?.status,
      hasMore: result.data?.pagination?.hasMore,
      catalogTotalCount: result.data?.pagination?.totalCount,
      duration: result.duration
    }));
    measurements.push(imageMeasurement);

    const report = {
      generatedAt: new Date().toISOString(),
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      profile: options.profile,
      dataset: {
        files: options.files,
        images: options.images,
        depth: options.depth,
        inputDir: dataset.inputDir,
        imagesDir: dataset.imagesDir
      },
      measurements,
      finalMemory: memorySnapshot()
    };

    await fs.mkdir(path.dirname(options.output), { recursive: true });
    await fs.writeFile(options.output, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    process.stdout.write(`${JSON.stringify({ output: options.output, report }, null, 2)}\n`);

    if (measurements.some((measurement) => !measurement.success)) {
      process.exitCode = 1;
    }
  } finally {
    if (app && typeof app.stopServer === 'function') {
      await app.stopServer();
    }
    await fs.rm(auditRoot, { recursive: true, force: true, maxRetries: 3 });
  }
}

run().catch((error) => {
  process.stderr.write(`Performance audit failed: ${error.stack || error.message}\n`);
  process.exitCode = 1;
});
