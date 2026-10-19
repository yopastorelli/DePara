'use strict';

const fs = require('fs').promises;
const path = require('path');
const http = require('http');
const os = require('os');
const { execFile } = require('child_process');
const { writeJsonAtomic } = require('../src/utils/atomicStore');

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };

function request(port, route, token) {
  return new Promise((resolve) => {
    const client = http.request({ hostname: '127.0.0.1', port, path: route,
      method: token ? 'POST' : 'GET', timeout: 5000,
      headers: token ? { 'X-DePara-Shutdown-Token': token, 'X-DePara-Update': 'true' } : {}
    }, (response) => {
      let body = '';
      response.on('data', (chunk) => { if (body.length < 65536) body += chunk; });
      response.on('end', () => {
        let data = {}; try { data = JSON.parse(body); } catch { data = {}; }
        resolve({ status: response.statusCode, data });
      });
    });
    client.on('error', () => resolve({ status: 0, data: {} }));
    client.on('timeout', () => { client.destroy(); });
    client.end();
  });
}

async function waitUntil(predicate, timeoutMs = 90000) {
  const deadline = Date.now() + timeoutMs;
  do {
    if (await predicate()) return true;
    await sleep(1000);
  } while (Date.now() < deadline);
  return false;
}

function launch(launcher, runtimeRoot) {
  return new Promise((resolve, reject) => {
    execFile('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', launcher], {
      windowsHide: true, timeout: 60000,
      env: { ...process.env, DEPARA_RUNTIME_ROOT: runtimeRoot }
    }, (error, stdout) => {
      if (error) { reject(new Error('Falha no launcher Windows')); return; }
      const match = stdout.match(/PID=(\d+)/);
      if (!match) { reject(new Error('Launcher não confirmou uma nova instância')); return; }
      resolve(Number(match[1]));
    });
  });
}

async function performHandoff(input, io) {
  const stopped = await io.stop(input.parentPid);
  if (!stopped) {
    await io.state({ status: 'idle', activationState: 'deferred', lastEvent: 'update_deferred_busy' });
    return 'deferred';
  }
  let newPid;
  try {
    await io.activate(input.release);
    await io.state({ status: 'restarting', activationState: 'restarting' });
    newPid = await io.launch();
    if (!(await io.healthy(input.release.commit))) throw new Error('Release novo não passou na verificação');
    await io.state({ status: 'idle', activationState: 'active', currentCommit: input.release.commit,
      currentRelease: input.release.releaseId, targetRelease: null, stagingRelease: null,
      lastSuccessAt: new Date().toISOString(), lastError: null, lastFailureStage: null,
      consecutiveFailures: 0, rollbackPerformed: false, rejectedCommit: null, lastEvent: 'validation_success' });
    return 'updated';
  } catch (error) {
    if (newPid && !(await io.stop(newPid))) {
      await io.state({ status: 'critical', lastError: 'Reinício bloqueado; intervenção manual necessária', lastEvent: 'rollback_blocked' });
      return 'blocked';
    }
    await io.restore();
    await io.state({ status: 'restarting', activationState: 'rollback_restart', rollbackPerformed: true,
      rejectedCommit: input.release.commit,
      currentCommit: input.current.activeCommit, currentRelease: input.current.activeRelease,
      lastError: error.message, lastFailureStage: 'restart_health' });
    await io.launch();
    const recovered = await io.healthy(input.current.activeCommit);
    await io.state({ status: recovered ? 'idle' : 'critical', activationState: recovered ? 'active' : 'rollback_failed',
      lastEvent: recovered ? 'rollback_success' : 'rollback_failed', targetRelease: null });
    return recovered ? 'rolled_back' : 'failed';
  }
}

async function main(requestPath, { healthTimeoutMs = 90000 } = {}) {
  try { os.setPriority(0, os.constants.priority.PRIORITY_BELOW_NORMAL); } catch {}
  const input = JSON.parse(await fs.readFile(requestPath, 'utf8'));
  const root = path.resolve(input.runtimeRoot);
  const releasePath = path.join(root, 'releases', input.release.commit);
  if (!/^[a-f0-9]{40}$/i.test(input.release.commit) || path.resolve(input.release.releasePath) !== releasePath
    || path.resolve(input.current.activePath) !== path.join(root, 'releases', input.current.activeCommit)
    || !Number.isSafeInteger(input.parentPid) || input.parentPid < 1) throw new Error('Handoff inválido');
  await fs.access(path.join(releasePath, 'src', 'main.js'));
  const lockPath = path.join(root, 'data', 'update-handoff.lock');
  let lock;
  try { lock = await fs.open(lockPath, 'wx'); }
  catch (error) {
    if (error.code !== 'EEXIST') throw error;
    const previous = Number(await fs.readFile(lockPath, 'utf8'));
    if (alive(previous)) throw new Error('Handoff já ativo');
    await fs.unlink(lockPath);
    lock = await fs.open(lockPath, 'wx');
  }
  await lock.writeFile(String(process.pid));
  await lock.close();
  const statePath = path.join(root, 'data', 'update-state.json');
  const historyPath = path.join(root, 'data', 'update-history.log');
  const state = async (patch) => {
    const current = JSON.parse(await fs.readFile(statePath, 'utf8'));
    await writeJsonAtomic(statePath, { ...current, ...patch });
    await fs.appendFile(historyPath, `${JSON.stringify({ timestamp: new Date().toISOString(), event: patch.lastEvent || patch.activationState })}\n`);
  };
  const metaPath = path.join(root, 'current', 'release.json');
  let port;
  const stop = async (pid) => {
    if (!alive(pid)) return true;
    const control = JSON.parse(await fs.readFile(path.join(root, 'control', 'shutdown.json'), 'utf8'));
    port = control.port;
    if (control.pid !== pid) return false;
    const response = await request(port, '/internal/shutdown', control.token);
    if (response.status !== 202) return false;
    return waitUntil(() => !alive(pid));
  };
  try {
    port = JSON.parse(await fs.readFile(path.join(root, 'control', 'shutdown.json'), 'utf8')).port;
    if (process.send) {
      process.send('ready');
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Handoff não confirmado')), 20000);
        process.once('message', (message) => { clearTimeout(timeout); message === 'go' ? resolve() : reject(new Error('Handoff cancelado')); });
      });
    }
    return await performHandoff(input, { stop, state,
      activate: () => writeJsonAtomic(metaPath, { activeRelease: input.release.releaseId,
        activeCommit: input.release.commit, activePath: releasePath,
        previousRelease: input.current.activeRelease, previousCommit: input.current.activeCommit,
        updatedAt: new Date().toISOString() }),
      restore: () => writeJsonAtomic(metaPath, input.current),
      launch: () => launch(input.launcher, root),
      healthy: (commit) => waitUntil(async () => {
        const response = await request(port, '/health');
        return response.status === 200 && response.data.status === 'OK' && response.data.releaseCommit === commit;
      }, healthTimeoutMs)
    });
  } finally { await fs.unlink(lockPath); }
}

if (require.main === module) {
  main(process.argv[2]).then(() => process.exit(0)).catch(async () => {
    try {
      const input = JSON.parse(await fs.readFile(process.argv[2], 'utf8'));
      const statePath = path.join(input.runtimeRoot, 'data', 'update-state.json');
      const state = JSON.parse(await fs.readFile(statePath, 'utf8'));
      await writeJsonAtomic(statePath, { ...state, status: 'critical', lastEvent: 'handoff_failed',
        lastError: 'Handoff interrompido; verificar release e processo antes de tentar novamente' });
    } catch {}
    process.exit(1);
  });
}

module.exports = { performHandoff, waitUntil, request, main };
