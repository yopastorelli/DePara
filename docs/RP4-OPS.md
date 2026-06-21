# RP4_OPERATIONS_CONTRACT

PLATFORM=Raspberry Pi 4
SUPERVISOR=PM2
DEFAULT_BIND_HOST=127.0.0.1
DEFAULT_RUNTIME_ROOT=~/.depara
DEFAULT_PM2_PORT=3001

## Production invariants

- PM2 is the supported process supervisor.
- `HOST=127.0.0.1` is the safe default.
- `HOST=0.0.0.0` requires intentional LAN exposure and external network controls.
- `~/.depara/config.env` is the durable runtime env file.
- `ecosystem.config.js` sets `PORT=3001` for PM2 env blocks unless overridden.
- `~/.depara/data` is the durable mutable data store.
- `~/.depara/releases/<commit>` stores immutable releases.
- `~/.depara/current` is the active release wrapper.
- `start-depara.sh` opens UI only after backend health is already OK.
- `depara.service` is legacy/bootstrap-only.

## Go-live checklist

```bash
npm ci
npm run lint
npm run test:unit
npm run test:smoke
npm run test:e2e
npm audit --audit-level=high
git status --short
node bootstrap-runtime-release.js
npm install -g pm2
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
PORT="$(grep -E '^PORT=' "$HOME/.depara/config.env" | tail -n 1 | cut -d '=' -f 2-)"
PORT="${PORT:-3001}"
pm2 status
curl -fsS "http://127.0.0.1:${PORT}/health"
curl -fsS "http://127.0.0.1:${PORT}/api/update/auto/diagnostics"
```

## Expected diagnostics

Healthy state:

- `runtime.supervisor.supervisor=pm2`
- `runtime.supervisor.pm2.available=true`
- `runtime.supervisor.pm2.registered=true`
- `runtime.scheduler.stale=false`
- `runtime.lastFailureStage` empty or null
- active release present
- data persistence migrated or already canonical

Blocked publication state:

- PM2 missing or app unregistered.
- Scheduler stale.
- Health endpoint failing after release switch.
- Legacy update endpoints used by UI/client flow.
- Logs in console at high volume in production.

## Auto-update flow

1. Client calls `POST /api/update/auto/check-now`.
2. Client calls `POST /api/update/auto/trigger`.
3. Orchestrator fetches Git state.
4. Orchestrator prepares clean staging release.
5. Dependencies are installed in the target release.
6. Active release wrapper is swapped.
7. PM2 restart is dispatched.
8. `/health` is validated.
9. Failure triggers rollback to previous release.

## Launcher contract

Commands:

```bash
$HOME/DePara/start-depara.sh status
$HOME/DePara/start-depara.sh open
```

`status` reports:

- resolved runtime root
- config env path
- resolved app URL
- PM2 app name
- backend health

`open` behavior:

- read port from env or config
- validate health
- open `http://127.0.0.1:<PORT>/ui`

Forbidden launcher behavior:

- `npm install`
- Git update
- PM2 restart
- backend start
- release switch

## Operational env baseline

Recommended `~/.depara/config.env`:

```env
HOST=127.0.0.1
PORT=3001
NODE_ENV=production
LOG_LEVEL=warn
LOG_TO_CONSOLE=false
DEPARA_RUNTIME_ROOT=/home/pi/.depara
PM2_APP_NAME=DePara
DEPARA_ALLOW_SYSTEMD_FALLBACK=false
```

Optional path hardening:

```env
DEPARA_ALLOWED_PATHS=/home/pi:/media:/mnt
```

## Logs

Commands:

```bash
pm2 logs DePara --lines 100
tail -n 100 ~/.depara/logs/app.log
tail -n 100 ~/.depara/logs/depara-launcher.log
```

Expected production log posture:

- `LOG_LEVEL=warn`
- `LOG_TO_CONSOLE=false`
- debug enabled only temporarily

## Never commit from RP4 runtime

- `~/.depara/data`
- `~/.depara/logs`
- `~/.depara/backups`
- `~/.depara/releases`
- generated browser/test artifacts
