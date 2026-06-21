# INSTALLATION_CONTRACT

## Requirements

| Requirement | Version/contract |
|---|---|
| Node.js | `>=18.0.0` |
| npm | `>=9.0.0` |
| Git | required for update flows |
| Chromium | required for Playwright E2E |
| PM2 | required for RP4 production; global/operational dependency |

## Local setup

```bash
npm ci
npm run lint
npm run test:unit
npm run test:smoke
npm run start
```

Default URLs:

- UI: `http://127.0.0.1:3000/ui`
- Health: `http://127.0.0.1:3000/health`
- API docs: `http://127.0.0.1:3000/api/docs`

## Script contract

| Script | Contract |
|---|---|
| `npm run start` | start backend with `node src/main.js` |
| `npm run dev` | start backend with native `node --watch src/main.js` |
| `npm run start:bg` | start `src/main.js` under global PM2 as `DePara` |
| `npm run start:bg:prod` | start under global PM2 with production env |
| `npm run stop:bg` | stop PM2 app `DePara` |
| `npm run restart:bg` | restart PM2 app `DePara` |
| `npm run status` | show PM2 status |
| `npm run logs` | tail PM2 logs |
| `npm run setup` | install npm dependencies |
| `npm run setup:bg` | install npm dependencies and global PM2 |

`nodemon` is intentionally not a dependency.

## Environment variables

Use `env.example` as the canonical template.

| Variable | Default | Contract |
|---|---|---|
| `HOST` | `127.0.0.1` | bind host; use `0.0.0.0` only for intentional LAN exposure |
| `PORT` | `3000` | HTTP port |
| `NODE_ENV` | `development` or PM2 env | runtime mode |
| `MAX_PAYLOAD` | `100mb` | Express body limit |
| `DEPARA_RUNTIME_ROOT` | `~/.depara` | operational root |
| `DEPARA_CONFIG_ENV_PATH` | `<runtime>/config.env` | persisted env file |
| `DEPARA_DATA_DIR` | `<runtime>/data` | mutable product data |
| `DEPARA_CONFIG_FILE` | `<data>/depara-config.json` | product config file |
| `DEPARA_LOG_DIR` | `<runtime>/logs` | log directory |
| `LOG_FILE` | `<logDir>/app.log` | log file |
| `DEPARA_BACKUP_DIR` | `<runtime>/backups` | operational backups |
| `DEPARA_TEMP_DIR` | `<runtime>/temp` | runtime temp |
| `DEPARA_RUNTIME_PUBLIC_DIR` | `<runtime>/public` | runtime uploads/downloads public root |
| `DEPARA_RELEASES_DIR` | `<runtime>/releases` | immutable release store |
| `DEPARA_CURRENT_DIR` | `<runtime>/current` | active release wrapper |
| `DEPARA_UPDATE_SOURCE_ROOT` | repository root | Git source root for update/bootstrap |
| `DEPARA_ALLOWED_PATHS` | platform defaults | allowed bases for file operations; replaces defaults |
| `DEPARA_DISABLE_RATE_LIMITS` | unset | disable limits only for controlled tests |
| `DEPARA_STRICT_RATE_LIMIT` | `20` | strict limiter max |
| `DEPARA_NORMAL_RATE_LIMIT` | `300` | normal limiter max |
| `DEPARA_READ_RATE_LIMIT` | `1000` | read limiter max |
| `DEPARA_SLIDESHOW_RATE_LIMIT` | `1000` | slideshow limiter max |
| `DEPARA_DISABLE_UPDATE_SIDE_EFFECTS` | unset | block destructive update side effects |
| `DEPARA_DISABLE_UPDATE_SCHEDULER` | unset | block auto scheduler |
| `DEPARA_DISABLE_PROCESS_HOOKS` | unset | skip process signal hooks in controlled tests |
| `PM2_APP_NAME` | `DePara` | PM2 app expected by diagnostics |
| `DEPARA_ALLOW_SYSTEMD_FALLBACK` | `false` in PM2 env | legacy fallback gate |

## RP4 production setup

```bash
git fetch origin
git checkout main
git pull --ff-only origin main
npm ci --omit=dev
node bootstrap-runtime-release.js
npm install -g pm2
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
```

Post-setup assertions:

- `~/.depara/config.env` exists.
- `~/.depara/releases/<commit>` exists.
- `~/.depara/current` exists and points/wraps to active release.
- PM2 process `DePara` is registered.
- `/health` returns `status: OK`.

## Desktop launcher setup

```bash
cp depara.desktop ~/.local/share/applications/depara.desktop
sed -i "s|__DEPARA_DIR__|$HOME/DePara|g" ~/.local/share/applications/depara.desktop
update-desktop-database ~/.local/share/applications || true
```

Launcher contract:

- `start-depara.sh open` reads `PORT` from `~/.depara/config.env` unless `PORT` env is set.
- It validates `/health`.
- It opens the UI.
- It does not start, restart, install or update the backend.

## Post-start validation

```bash
PORT="$(grep -E '^PORT=' "$HOME/.depara/config.env" | tail -n 1 | cut -d '=' -f 2-)"
PORT="${PORT:-3000}"
pm2 status
curl -fsS "http://127.0.0.1:${PORT}/health"
curl -fsS "http://127.0.0.1:${PORT}/api/status"
curl -fsS "http://127.0.0.1:${PORT}/api/update/auto/status"
curl -fsS "http://127.0.0.1:${PORT}/api/update/auto/diagnostics"
```
