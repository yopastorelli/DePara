# ARCHITECTURE_CONTRACT

## System shape

```text
Windows browser UI / Playwright
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
| Update | `src/routes/update.js`, `src/services/updateOrchestrator.js` | optional immutable release preparation with manual Windows restart |
| Status/health | `src/routes/status.js`, `src/routes/health.js` | readiness and operational diagnostics |
| Tray/browser | `src/routes/tray.js` | open dedicated Windows browser windows and screensaver state |
| Audit | `scripts/performance-audit.js` | controlled latency and memory measurements |

## Startup sequence

1. `scripts/start-windows-coexistence.ps1` loads the Windows runtime configuration and refuses to create a duplicate DePara process.
2. `%USERPROFILE%\.depara\current\src\main.js` loads `release.json` and resolves the immutable release selected by `bootstrap-runtime-release.js`.
3. `loadOperationalConfig()` reads `%USERPROFILE%\.depara\config.env` unless overridden by `DEPARA_CONFIG_ENV_PATH`.
4. Express app is configured once.
5. Runtime directories are created:
   - logs
   - backups
   - temp
   - runtime public uploads/downloads
   - data
6. Config file is ensured.
7. Folder manager initializes.
8. Server listens on `HOST` and `PORT`.
9. Update orchestrator initializes lazily only when an update route requires it.

Defaults:

- `HOST=127.0.0.1`
- `PORT=3000`
- `NODE_ENV=production` in the persisted runtime configuration; direct development runs may override it.

## Runtime persistence

| Data | Default path |
|---|---|
| Runtime root | `%USERPROFILE%\.depara` |
| Config env | `%USERPROFILE%\.depara\config.env` |
| Product config | `%USERPROFILE%\.depara\data\depara-config.json` |
| Scheduled operations | `%USERPROFILE%\.depara\data\scheduled-operations.json` |
| Folders | `%USERPROFILE%\.depara\data\folders.json` |
| Update config | `%USERPROFILE%\.depara\data\update-config.json` |
| Update state | `%USERPROFILE%\.depara\data\update-state.json` |
| Update history | `%USERPROFILE%\.depara\data\update-history.log` |
| Immutable releases | `%USERPROFILE%\.depara\releases\<commit>` |
| Active release wrapper | `%USERPROFILE%\.depara\current` |

Migration contract:

- On first runtime initialization, legacy data from repository `data/` or `src/data/` may be copied once to runtime data.
- After migration, runtime data is canonical and new code must not write to legacy locations.
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

Default allowed bases on Windows:

- `os.homedir()`
- `C:\`
- `D:\`
- `E:\`

`DEPARA_ALLOWED_PATHS` replaces defaults and uses `;` as delimiter.

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

- The orchestrator prepares a clean immutable release, flips active release and validates health; restarting the Windows process is an explicit manual step.
- On failed health validation, rollback must restore the previous release.

## Fragile zones

- `src/public/app.js`: large UI surface with compatibility-only helpers; run E2E after any edit and do not add new legacy paths.
- `src/routes/fileOperations.js`: broad public API; run smoke and E2E after any edit.
- `src/services/updateOrchestrator.js`: side-effectful update logic; use `DEPARA_DISABLE_UPDATE_SIDE_EFFECTS=true` in tests.
- `scripts/performance-audit.js`: use an isolated profile and compare reports from the same machine.
- Express route syntax: project uses Express 5; do not reintroduce `:param(*)` or `app.use('*')`.
