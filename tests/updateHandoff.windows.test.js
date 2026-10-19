const fs = require('fs').promises;
const os = require('os');
const path = require('path');
const net = require('net');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execute = promisify(execFile);
const windowsTest = process.platform === 'win32' ? describe : describe.skip;

windowsTest('Windows update real process handoff in disposable runtime', () => {
  it('defers busy work, restarts a valid release and rolls back failed startup through the Windows launcher', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'depara-handoff-'));
    const listener = net.createServer();
    await new Promise((resolve) => listener.listen(0, '127.0.0.1', resolve));
    const port = listener.address().port;
    await new Promise((resolve) => listener.close(resolve));
    const previous = 'a'.repeat(40);
    const target = 'b'.repeat(40);
    const launcher = path.resolve(__dirname, '../scripts/start-windows-coexistence.ps1');
    const env = { ...process.env, DEPARA_RUNTIME_ROOT: root, DEPARA_LOG_DIR: path.join(root, 'logs'),
      DEPARA_CONFIG_ENV_PATH: path.join(root, 'config.env'), PORT: String(port),
      DEPARA_ENABLE_UPDATE_SCHEDULER: 'false', NODE_ENV: 'test' };
    const fixture = `const fs = require('fs'); const path = require('path');
const root = process.env.DEPARA_RUNTIME_ROOT;
const control = {pid:process.pid,port:Number(process.env.PORT),token:'disposable-test-token'};
fs.writeFileSync(path.join(root,'control','shutdown.json'),JSON.stringify(control));
const server = require('http').createServer((req,res) => {
 if(req.url==='/internal/shutdown' && req.headers['x-depara-shutdown-token']===control.token) {
  if(fs.existsSync(path.join(root,'data','busy'))) {res.writeHead(409);res.end('{}');return;}
  res.writeHead(202);res.end('{}');server.close(()=>process.exit(0));return;
 }
 res.setHeader('content-type','application/json');res.end(JSON.stringify({status:'OK',releaseCommit:process.env.DEPARA_RELEASE_COMMIT}));
}); server.listen(Number(process.env.PORT),'127.0.0.1');`;
    const pids = new Set();
    try {
      for (const folder of ['data', 'control', 'current/src', `releases/${previous}/src`, `releases/${target}/src`]) {
        await fs.mkdir(path.join(root, folder), { recursive: true });
      }
      for (const commit of [previous, target]) await fs.writeFile(path.join(root, 'releases', commit, 'src/main.js'), fixture);
      const meta = { activeCommit: previous, activeRelease: previous, activePath: path.join(root, 'releases', previous) };
      await fs.writeFile(path.join(root, 'current/release.json'), JSON.stringify(meta));
      await fs.writeFile(path.join(root, 'current/src/main.js'), `const meta=require('../release.json');process.env.DEPARA_RELEASE_COMMIT=meta.activeCommit;require(require('path').join(meta.activePath,'src/main.js'));`);
      await fs.writeFile(path.join(root, 'data/update-state.json'), '{}');
      const start = await execute('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', launcher], { env, windowsHide: true });
      const oldPid = Number(start.stdout.match(/PID=(\d+)/)[1]);
      pids.add(oldPid);
      for (let attempt = 0; attempt < 20; attempt += 1) {
        try {
          const ready = await fetch(`http://127.0.0.1:${port}/health`);
          if (ready.ok) break;
        } catch {}
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      const requestPath = path.join(root, 'data/update-handoff.json');
      await fs.writeFile(requestPath, JSON.stringify({ runtimeRoot: root, parentPid: oldPid, current: meta,
        release: { commit: target, releaseId: target, releasePath: path.join(root, 'releases', target) }, launcher }));
      await fs.writeFile(path.join(root, 'data/busy'), 'fixture');
      await execute(process.execPath, [path.resolve(__dirname, '../scripts/update-handoff.js'), requestPath], { env, windowsHide: true, timeout: 15000 });
      expect(JSON.parse(await fs.readFile(path.join(root, 'current/release.json'), 'utf8')).activeCommit).toBe(previous);
      expect(JSON.parse(await fs.readFile(path.join(root, 'data/update-state.json'), 'utf8')).activationState).toBe('deferred');
      await fs.unlink(path.join(root, 'data/busy'));
      await execute(process.execPath, [path.resolve(__dirname, '../scripts/update-handoff.js'), requestPath], { env, windowsHide: true, timeout: 45000 });
      const control = JSON.parse(await fs.readFile(path.join(root, 'control/shutdown.json'), 'utf8'));
      pids.add(control.pid);
      expect(control.pid).not.toBe(oldPid);
      const health = await fetch(`http://127.0.0.1:${port}/health`).then((response) => response.json());
      expect(health.releaseCommit).toBe(target);
      const state = JSON.parse(await fs.readFile(path.join(root, 'data/update-state.json'), 'utf8'));
      expect(state.lastEvent).toBe('validation_success');
      expect(state.currentCommit).toBe(target);
      const rejected = 'c'.repeat(40);
      await fs.mkdir(path.join(root, 'releases', rejected, 'src'), { recursive: true });
      await fs.writeFile(path.join(root, 'releases', rejected, 'src/main.js'), "throw new Error('disposable startup failure');");
      const current = JSON.parse(await fs.readFile(path.join(root, 'current/release.json'), 'utf8'));
      await fs.writeFile(requestPath, JSON.stringify({ runtimeRoot: root, parentPid: control.pid, current,
        release: { commit: rejected, releaseId: rejected, releasePath: path.join(root, 'releases', rejected) }, launcher }));
      const helper = path.resolve(__dirname, '../scripts/update-handoff.js');
      const command = `require(${JSON.stringify(helper)}).main(process.argv[1],{healthTimeoutMs:5000}).then(()=>process.exit(0),()=>process.exit(1))`;
      await execute(process.execPath, ['-e', command, requestPath], { env, windowsHide: true, timeout: 25000 });
      const rollback = JSON.parse(await fs.readFile(path.join(root, 'data/update-state.json'), 'utf8'));
      expect(rollback.lastEvent).toBe('rollback_success');
      expect(rollback.rejectedCommit).toBe(rejected);
      expect(JSON.parse(await fs.readFile(path.join(root, 'current/release.json'), 'utf8')).activeCommit).toBe(target);
    } finally {
      try { pids.add(JSON.parse(await fs.readFile(path.join(root, 'control/shutdown.json'), 'utf8')).pid); } catch {}
      for (const pid of pids) { try { process.kill(pid); } catch {} }
      await new Promise((resolve) => setTimeout(resolve, 300));
      await fs.rm(root, { recursive: true, force: true });
    }
  }, 60000);
});
