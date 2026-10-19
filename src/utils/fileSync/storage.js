const fs = require('fs').promises;
const nativeFs = require('fs');
const path = require('path');
const crypto = require('crypto');
const readline = require('readline');
const { Transform } = require('stream');
const { pipeline } = require('stream/promises');
const { execFile } = require('child_process');
const { promisify } = require('util');
const { writeJsonAtomic } = require('../atomicStore');

const runFile = promisify(execFile);
const BUFFER_SIZE = 256 * 1024;
const RESERVED = '.depara-sync';
const RESERVE = 256 * 1024 * 1024;

function failure(message, code = 'SYNC_CONFLICT', statusCode = 409) {
  return Object.assign(new Error(message), { code, statusCode });
}

function within(candidate, root) {
  const relative = path.relative(root, candidate);
  return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

function relativeTarget(root, relative) {
  if (typeof relative !== 'string' || !relative || path.isAbsolute(relative)
      || relative.split(/[\\/]/).some((part) => ['..', '.', RESERVED].includes(part.toLowerCase()))
      || relative.includes(':') || relative.includes('\0')) throw failure('Caminho relativo inválido');
  const destination = path.resolve(root, relative);
  if (!within(destination, root)) throw failure('Caminho fora da base');
  return destination;
}

async function json(file, fallback = null) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); }
  catch (error) {
    if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error;
    try { return JSON.parse(await fs.readFile(`${file}.previous`, 'utf8')); }
    catch (previousError) {
      if (error.code === 'ENOENT' && previousError.code === 'ENOENT') return fallback;
      throw error;
    }
  }
}

async function stats(file) {
  try {
    const result = await fs.lstat(file);
    if (result.isSymbolicLink()) throw failure('Link ou junction não permitido');
    return { size: result.size, mtimeMs: result.mtimeMs, device: result.dev, directory: result.isDirectory(), file: result.isFile() };
  } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

function same(left, right) {
  return Boolean(left && right && left.size === right.size && left.mtimeMs === right.mtimeMs);
}

async function safeTree(root, relative) {
  const target = relativeTarget(root, relative);
  let current = root;
  for (const component of path.relative(root, target).split(path.sep)) {
    current = path.join(current, component);
    const entry = await stats(current);
    if (!entry) break;
  }
  return target;
}

async function hash(file, signal) {
  const digest = crypto.createHash('sha256');
  const stream = nativeFs.createReadStream(file, { highWaterMark: BUFFER_SIZE, signal });
  for await (const chunk of stream) digest.update(chunk);
  return digest.digest('hex');
}

async function append(file, value, durable = true) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  if (!durable) { await fs.appendFile(file, `${JSON.stringify(value)}\n`); return; }
  const handle = await fs.open(file, 'a');
  try { await handle.writeFile(`${JSON.stringify(value)}\n`); await handle.sync(); }
  finally { await handle.close(); }
}

async function repairTail(file) {
  let handle;
  try { handle = await fs.open(file, 'r+'); }
  catch (error) { if (error.code === 'ENOENT') return; throw error; }
  try {
    const metadata = await handle.stat();
    if (!metadata.size) return;
    const bytes = Buffer.alloc(Math.min(65536, metadata.size));
    await handle.read(bytes, 0, bytes.length, metadata.size - bytes.length);
    if (bytes[bytes.length - 1] === 10) return;
    const newline = bytes.lastIndexOf(10);
    if (newline < 0 && metadata.size > bytes.length) throw failure('Final de journal excede limite de recuperação');
    await handle.truncate(metadata.size - bytes.length + newline + 1);
    await handle.sync();
  } finally { await handle.close(); }
}

async function* lines(file) {
  try { await fs.access(file); } catch (error) { if (error.code === 'ENOENT') return; throw error; }
  const stream = nativeFs.createReadStream(file, { encoding: 'utf8' });
  const reader = readline.createInterface({ input: stream, crlfDelay: Infinity });
  let previous;
  try {
    for await (const line of reader) {
      if (previous !== undefined) yield JSON.parse(previous);
      previous = line;
    }
    if (previous) {
      let parsed;
      try { parsed = JSON.parse(previous); }
      catch {
        const handle = await fs.open(file, 'r');
        try {
          const info = await handle.stat();
          const last = Buffer.alloc(1);
          await handle.read(last, 0, 1, info.size - 1);
          if (last[0] === 10) throw failure('Journal inválido', 'JOURNAL_CORRUPT');
        } finally { await handle.close(); }
      }
      if (parsed !== undefined) yield parsed;
    }
  } finally { reader.close(); stream.destroy(); }
}

async function copyVerified(source, temporary, signal) {
  const before = await stats(source);
  if (!before?.file) throw failure('Origem não é arquivo regular');
  const digest = crypto.createHash('sha256');
  const transform = new Transform({ transform(chunk, encoding, callback) { digest.update(chunk); callback(null, chunk); } });
  await pipeline(nativeFs.createReadStream(source, { highWaterMark: BUFFER_SIZE }), transform,
    nativeFs.createWriteStream(temporary, { flags: 'wx', highWaterMark: BUFFER_SIZE }), { signal });
  const handle = await fs.open(temporary, 'r+');
  try { await handle.sync(); } finally { await handle.close(); }
  const fingerprint = digest.digest('hex');
  if (!same(before, await stats(source)) || (await stats(temporary)).size !== before.size
      || await hash(temporary, signal) !== fingerprint) throw failure('Origem instável ou cópia inválida', 'SOURCE_CHANGED');
  return { fingerprint, source: before };
}

async function volume(root) {
  const script = path.resolve(__dirname, '../../../scripts/inspect-sync-volume.ps1');
  let result;
  try {
    result = await runFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script, '-LiteralPath', root],
      { windowsHide: true, timeout: 30000, maxBuffer: 16384 });
  } catch { throw failure('Volume indisponível ou identidade não verificável', 'VOLUME_UNAVAILABLE'); }
  const info = JSON.parse(result.stdout.replace(/^\uFEFF/, '').trim());
  if (!info.id) throw failure('Volume sem identidade');
  return info;
}

async function space(root, required = 0) {
  const info = await fs.statfs(root, { bigint: true });
  if (info.bavail * info.bsize < BigInt(required) + BigInt(RESERVE)) throw failure('Espaço insuficiente; reserve 256 MiB livres', 'NO_SPACE');
  return { freeBytes: Number(info.bavail * info.bsize), reserveBytes: RESERVE };
}

module.exports = { RESERVED, failure, within, relativeTarget, safeTree, json, stats, same, hash, append, repairTail, lines, copyVerified, volume, space, writeJsonAtomic };
