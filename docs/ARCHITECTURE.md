# ARCHITECTURE_CONTRACT

DOC_AUDIENCE=AI_development_agents
PLATFORM_CONTRACT=Windows_only

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
| File operations | `src/routes/fileOperations.js`, `src/utils/fileOperations.js` | folders, execute, schedule, slideshow file browsing; workflows only for compatibility |
| Transaction engine | `src/utils/fileOps/transactionalOperations.js`, `src/utils/atomicStore.js` | journal, atomic publication, interruption reconciliation, quarantine and recovery |
| File primitives | `src/utils/fileOps/*` | Node-only transactional mutation, image scan and catalog helpers |
| Config | `src/routes/config.js`, `src/utils/configStore.js` | persisted product configuration and backup import/export |
| Runtime paths | `src/utils/runtimePaths.js` | derive data/log/temp/release/current directories |
| Runtime env | `src/utils/runtimeConfig.js` | load `config.env` into `process.env` without overriding explicit env |
| Update | `src/routes/update.js`, `src/services/updateOrchestrator.js` | optional immutable release preparation with manual Windows restart |
| Status/health | `src/routes/status.js`, `src/routes/health.js` | readiness and operational diagnostics |
| Tray/browser | `src/routes/tray.js` | open dedicated Windows browser windows and screensaver state |
| Audit | `scripts/performance-audit.js` | controlled latency and memory measurements |

## Canonical product surface

The visible UI has five tabs: `dashboard`, `fileops`, `scheduled`, `backups` and `settings`. `fileops` owns one operation draft and is the only entry point for immediate file mutations or opening a schedule from that draft. Workflows, templates, conversion and drag-and-drop remain compatibility-only backend/helpers and are not startup dependencies or new UI entry points.

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
7. File-operation manager creates its journal/quarantine roots, reconciles unfinished work and reloads schedules.
8. Folder manager initializes.
9. Pending operational-config imports are reconciled from `data\config-import-journal.json`; an interrupted `prepared`/`applying` import restores its previous snapshot before serving requests.
10. Server listens on `HOST` and `PORT`.
11. Update orchestrator initializes lazily only when an update route requires it.

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
| Workflows | `%USERPROFILE%\.depara\data\workflows.json` |
| File-operation journals | `%USERPROFILE%\.depara\data\file-operations\<operationId>` |
| Operational-config import journal | `%USERPROFILE%\.depara\data\config-import-journal.json` |
| Recoverable quarantine | `%USERPROFILE%\.depara\quarantine\<operationId>` |
| Delete/overwrite quarantine | `%USERPROFILE%\.depara\quarantine\<operationId>` |
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

## Transaction and interruption model

The mutation path is intentionally sequential (`MAX_CONCURRENT_OPERATIONS=1`) and follows this order:

1. Validate source, destination, path relationship and symlink boundary.
2. Create a state file and append a manifest without loading the whole directory into memory.
3. For copy, stream to a unique partial file, flush it, verify size and publish with rename.
4. For move, use rename on the same volume; otherwise use the verified copy path and remove the source only after publication.
5. For delete or overwrite, register a recovery entry and move the original into runtime quarantine.
6. Append per-item progress and update counts after each committed/skipped/conflicted item.

The state and JSON configuration files use a temporary file plus a previous-version file. On startup, unfinished journals are marked `interrupted`, recorded partial files are removed, and completed journal events are not repeated. Never delete a journal or quarantine directory as a “cleanup” step; use the recovery API and a reviewed retention policy.

Operational configuration import follows a separate product-level journal. It records the previous complete backup before applying the incoming payload. A failure rolls back in-process; a restart seeing `prepared` or `applying` restores the previous snapshot and records `rolled_back`. The journal is retained as audit evidence.

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
