# ARCHITECTURE_CONTRACT

## System shape

```text
browser UI / Playwright
  -> Express app in src/main.js
    -> route modules in src/routes/*
      -> service/util modules in src/services and src/utils
        -> runtime data under DEPARA_RUNTIME_ROOT
        -> filesystem paths allowed by validateSafePath
```

## Components

| Domain | Source | Contract |
|---|---|---|
| HTTP app | `src/main.js` | configure middleware, static UI, API routes, health, startup/shutdown |
| UI | `src/public/index.html`, `src/public/app.js`, `src/public/modules/*`, `src/public/styles.css` | local browser product surface |
| API router | `src/routes/index.js` | mount route modules and expose `/api/docs` |
| File operations | `src/routes/fileOperations.js`, `src/utils/fileOperations.js` | folders, workflows, execute, schedule, slideshow file browsing |
| File primitives | `src/utils/fileOps/*` | Node-only copy/move/permissions/image scan helpers |
| Config | `src/routes/config.js`, `src/utils/configStore.js` | persisted product configuration and backup import/export |
| Runtime paths | `src/utils/runtimePaths.js` | derive data/log/temp/release/current directories |
| Runtime env | `src/utils/runtimeConfig.js` | load `config.env` into `process.env` without overriding explicit env |
| Update | `src/routes/update.js`, `src/services/updateOrchestrator.js` | immutable release auto-update under PM2 |
| Status/health | `src/routes/status.js`, `src/routes/health.js` | readiness and operational diagnostics |
| Desktop/tray | `src/routes/tray.js`, `src/routes/desktop.js`, `start-depara.sh` | open UI windows and desktop integration |
| Process manager | `ecosystem.config.js` | PM2 runtime definition |

## Startup sequence

1. `loadOperationalConfig()` reads `~/.depara/config.env` unless overridden by `DEPARA_CONFIG_ENV_PATH`.
2. Express app is configured once.
3. Runtime directories are created:
   - logs
   - backups
   - temp
   - runtime public uploads/downloads
   - data
4. Config file is ensured.
5. Folder manager initializes.
6. Update orchestrator initializes.
7. Server listens on `HOST` and `PORT`.

Defaults:

- `HOST=127.0.0.1`
- `PORT=3000`
- `NODE_ENV=development` for direct `npm start`
- production values are set by PM2 env blocks and/or `config.env`

## Runtime persistence

| Data | Default path |
|---|---|
| Runtime root | `~/.depara` |
| Config env | `~/.depara/config.env` |
| Product config | `~/.depara/data/depara-config.json` |
| Scheduled operations | `~/.depara/data/scheduled-operations.json` |
| Folders | `~/.depara/data/folders.json` |
| Update config | `~/.depara/data/update-config.json` |
| Update state | `~/.depara/data/update-state.json` |
| Update history | `~/.depara/data/update-history.log` |
| Immutable releases | `~/.depara/releases/<commit>` |
| Active release wrapper | `~/.depara/current` |

Migration contract:

- On first runtime initialization, legacy data from repository `data/` or `src/data/` may be migrated to runtime data.
- After migration, runtime data is canonical.
- Release directories must not own mutable product state.

## Filesystem safety

`src/utils/fileOperations.js::validateSafePath` is the required guard for path input.

Validation behavior:

- Rejects empty values.
- Rejects null bytes.
- Rejects explicit traversal fragments: `../`, `..\`, `~/`.
- Resolves candidate path before authorization.
- Resolves existing real paths to block symlink escape.
- For missing targets, validates the nearest existing parent.
- Authorizes paths against allowed base directories.

Default allowed bases:

- Linux: `os.homedir()`, `os.tmpdir()`, `/media`, `/mnt`
- Windows: `os.homedir()`, `C:\`, `D:\`, `E:\`

`DEPARA_ALLOWED_PATHS` replaces defaults. Use platform delimiter:

- Linux/macOS delimiter: `:`
- Windows delimiter: `;`

Security invariant:

- No route or utility may trust a user-provided filesystem path without `validateSafePath`.
- Shell execution for `chmod`, `cp`, `mv` or similar file operations is disallowed.

## Rate limits

Global API reads use `readRateLimiter` before `/api`.

| Limiter | Window | Default | Env override |
|---|---:|---:|---|
| strict | 5 min | 20 | `DEPARA_STRICT_RATE_LIMIT` |
| normal | 15 min | 300 | `DEPARA_NORMAL_RATE_LIMIT` |
| read | 1 min | 1000 | `DEPARA_READ_RATE_LIMIT` |
| slideshow | 1 min | 1000 | `DEPARA_SLIDESHOW_RATE_LIMIT` |

`DEPARA_DISABLE_RATE_LIMITS=true` is allowed only for controlled tests or one-off diagnostics.

## Update architecture

Canonical update endpoints:

- `GET /api/update/auto/status`
- `POST /api/update/auto/check-now`
- `PUT /api/update/auto/config`
- `POST /api/update/auto/trigger`
- `GET /api/update/auto/history`
- `GET /api/update/auto/diagnostics`

Legacy endpoints:

- `/api/update/check`
- `/api/update/apply`
- `/api/update/restart`
- `/api/update/status`

Legacy endpoints must remain available only to return `410 Gone` with migration instructions.

Update invariant:

- The orchestrator prepares a clean immutable release, flips active release, restarts through PM2 and validates health.
- On failed health validation, rollback must restore the previous release.

## Fragile zones

- `src/public/app.js`: large legacy UI file; run E2E after any edit.
- `src/routes/fileOperations.js`: broad public API; run smoke and E2E after any edit.
- `src/services/updateOrchestrator.js`: side-effectful update logic; use `DEPARA_DISABLE_UPDATE_SIDE_EFFECTS=true` in tests.
- Express route syntax: project uses Express 5; do not reintroduce `:param(*)` or `app.use('*')`.
