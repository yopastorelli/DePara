# RP4_OPERATIONS_CONTRACT

PLATFORM=Raspberry Pi 4
SUPPORTED_ARCHITECTURES=arm64,armv7l
SUPERVISOR=PM2
CERTIFIED_NODE_MAJORS=22,24
DEFAULT_BIND_HOST=127.0.0.1
DEFAULT_RUNTIME_ROOT=~/.depara
DEFAULT_PM2_PORT=3001

## Production invariants

- PM2 is the supported process supervisor.
- `HOST=127.0.0.1` is the safe default.
- `HOST=0.0.0.0` requires intentional LAN exposure and external network controls.
- `~/.depara/config.env` is the durable runtime env file and is canonical for the effective port.
- A clean RP4 bootstrap creates `PORT=3001`.
- `ecosystem.config.js` consumes the port loaded from `config.env`; it does not replace it.
- `~/.depara/data` is the durable mutable data store.
- `~/.depara/releases/<commit>` stores immutable releases.
- `~/.depara/current` is the active release wrapper.
- PM2 must execute `~/.depara/current/src/main.js`, never the repository source directly.
- `start-depara.sh` opens UI only after backend health is already OK.
- `depara.service` is legacy/bootstrap-only.

## Canonical installation

Run as the normal desktop user from `$HOME/DePara`:

```bash
chmod +x install-raspberry.sh scripts/certify-rp4.sh
./install-raspberry.sh
```

The installer:

- installs essential system tools;
- installs a pinned official Node.js 22 runtime when Node 22/24 is not already present;
- verifies the official Node.js SHA-256 manifest;
- supports ARM64 and ARMv7 Linux distributions;
- preserves an existing `~/.depara/config.env`;
- creates a safe RP4 baseline when config is absent;
- builds an immutable release;
- replaces divergent PM2 registrations with the canonical wrapper;
- saves PM2 state and configures startup;
- validates `/health`, `/api/status` and the desktop launcher before success.

The pinned Node version can be changed deliberately with:

```bash
DEPARA_NODE_VERSION=<approved-22.x-version> ./install-raspberry.sh
```

Do not point this variable at an untested Node major.

## Hardware certification

Run after installation and again after a real reboot:

```bash
./scripts/certify-rp4.sh
```

A passing report ends with JSON containing:

```json
{
  "certification": "RP4_PASS"
}
```

The certification is non-destructive and verifies:

- ARM architecture;
- Node 22 or 24;
- PM2 process online;
- PM2 entrypoint equals `~/.depara/current/src/main.js`;
- runtime directories and active release metadata;
- loopback bind and valid configured port;
- `/health` returns `OK`;
- `/api/status` returns `OPERATIONAL`;
- updater diagnostics respond successfully.

A CI simulation does not replace this physical certification.

## Manual diagnostics

```bash
PORT="$(grep -E '^PORT=' "$HOME/.depara/config.env" | tail -n 1 | cut -d '=' -f 2-)"
PORT="${PORT:-3001}"
pm2 status DePara
curl -fsS "http://127.0.0.1:${PORT}/health"
curl -fsS "http://127.0.0.1:${PORT}/api/status"
curl -fsS "http://127.0.0.1:${PORT}/api/update/auto/diagnostics"
```

## Expected diagnostics

Healthy state:

- PM2 process `DePara` is online.
- PM2 executes the active runtime wrapper.
- `runtime.supervisor.supervisor=pm2`.
- `runtime.supervisor.pm2.available=true`.
- `runtime.supervisor.pm2.registered=true`.
- `runtime.scheduler.stale=false`.
- `runtime.lastFailureStage` is empty or null.
- active release is present.
- data persistence is migrated or already canonical.

Blocked publication state:

- Node major is not 22 or 24.
- PM2 is missing, offline or points at repository source.
- Scheduler is stale.
- Health or status endpoints fail.
- Active release wrapper or metadata is missing.
- Legacy update endpoints are used by UI/client flow.

## Auto-update flow

1. Client calls `POST /api/update/auto/check-now`.
2. Client calls `POST /api/update/auto/trigger`.
3. Orchestrator fetches Git state.
4. Orchestrator prepares a clean staging release.
5. Dependencies are installed in the target release.
6. Active release wrapper is swapped.
7. PM2 restart is dispatched.
8. `/health` is validated.
9. Failure triggers rollback to the previous release.

## Launcher contract

Commands:

```bash
$HOME/DePara/start-depara.sh status
$HOME/DePara/start-depara.sh open
```

`status` reports runtime root, config path, app URL, PM2 app and backend health.

Forbidden launcher behavior:

- dependency installation;
- Git update;
- PM2 restart;
- backend start;
- release switch.

## Operational env baseline

```env
HOST=127.0.0.1
PORT=3001
NODE_ENV=production
LOG_LEVEL=warn
LOG_TO_CONSOLE=false
DEPARA_RUNTIME_ROOT=/home/pi/.depara
DEPARA_CONFIG_ENV_PATH=/home/pi/.depara/config.env
PM2_APP_NAME=DePara
DEPARA_ALLOW_SYSTEMD_FALLBACK=false
DEPARA_ALLOWED_PATHS=/home/pi:/media:/mnt
```

Use the actual home directory rather than assuming the username is `pi`.

## Logs

```bash
pm2 logs DePara --lines 100
tail -n 100 ~/.depara/logs/app.log
tail -n 100 ~/.depara/logs/depara-launcher.log
```

## Never commit from RP4 runtime

- `~/.depara/data`
- `~/.depara/logs`
- `~/.depara/backups`
- `~/.depara/releases`
- generated browser/test artifacts
