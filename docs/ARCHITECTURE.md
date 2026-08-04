# ARCHITECTURE_CONTRACT

## System shape

```text
browser UI / Playwright
  -> Express app in src/main.js
    -> route modules in src/routes/*
      -> service/util modules in src/services and src/utils
        -> platform runtime profile in src/platform/*
        -> runtime data outside the release directory
        -> filesystem paths allowed by validateSafePath
```

Platform operations:

```text
shared Node.js/Express product core
  -> RP4 adapter: PM2 + Linux launcher + Linux desktop integration
  -> Windows adapter: native launcher + WinSW service + future user-session shell
```

The shared core must not require WSL, Bash, PM2, systemd, WinSW or Electron. Those concerns belong to platform launch, supervision, packaging or desktop-integration boundaries.

## Components

| Domain | Source | Contract |
|---|---|---|
| HTTP app | `src/main.js` | configure middleware, static UI, API routes, health, startup/shutdown |
| Platform profile | `src/platform/runtimeProfile.js` | detect host target and apply safe runtime defaults without overriding explicit env |
| Windows launcher | `scripts/start-windows.js` | apply native Windows defaults before loading the shared backend |
| UI | `src/public/index.html`, `src/public/app.js`, `src/public/modules/*`, `src/public/styles.css` | local browser product surface |
| API router | `src/routes/index.js` | mount route modules and expose `/api/docs` |
| File operations | `src/routes/fileOperations.js`, `src/utils/fileOperations.js` | folders, workflows, execute, schedule, slideshow file browsing |
| File primitives | `src/utils/fileOps/*` | Node-only copy/move/permissions/image scan helpers |
| Config | `src/routes/config.js`, `src/utils/configStore.js` | persisted product configuration and backup import/export |
| Runtime paths | `src/utils/runtimePaths.js` | derive data/log/temp/release/current directories from configured runtime root |
| Runtime env | `src/utils/runtimeConfig.js` | load `config.env` into `process.env` without overriding explicit env |
| Update | `src/routes/update.js`, `src/services/updateOrchestrator.js` | RP4 immutable release auto-update under PM2; Windows packaged updater pending |
| Status/health | `src/routes/status.js`, `src/routes/health.js` | readiness and operational diagnostics |
| Linux desktop/tray | `src/routes/tray.js`, `src/routes/desktop.js`, `start-depara.sh` | RP4/Linux browser-window integration |
| RP4 process manager | `ecosystem.config.js` | PM2 runtime definition |
| Windows service | `packaging/windows/*` | WinSW service template and PowerShell lifecycle scripts |
| Future Windows shell | not implemented | user-session tray, window and fullscreen integration; must remain separate from service |

## Startup sequence

Shared sequence:

1. Platform launcher may set safe defaults before `src/main.js` is loaded.
2. `loadOperationalConfig()` reads `<runtime>/config.env` unless overridden by `DEPARA_CONFIG_ENV_PATH`.
3. Express app is configured once.
4. Runtime directories are created:
   - logs
   - backups
   - temp
   - runtime public uploads/downloads
   - data
5. Config file is ensured.
6. Folder manager initializes.
7. Update orchestrator initializes.
8. Server listens on `HOST` and `PORT`.

Defaults:

- `HOST=127.0.0.1`
- `PORT=3000`
- `NODE_ENV=development` for direct `npm start`
- RP4 production values are set by PM2 env blocks and/or `config.env`
- Windows interactive defaults are applied by `scripts/start-windows.js`
- Windows service values are set by `DeParaService.xml` and `%ProgramData%\DePara\config.env`

## Platform profile

`src/platform/runtimeProfile.js` is the current cross-platform boundary for runtime defaults.

Detection:

| Target | Detection | Default runtime root | Supervisor contract |
|---|---|---|---|
| RP4 | Linux plus `arm` or `arm64` | `~/.depara` | PM2 |
| Windows | `process.platform=win32` | `%LOCALAPPDATA%\DePara` for interactive runs | Windows service target |
| Other Linux | Linux non-ARM | `~/.depara` | unmanaged development process |

Rules:

- Explicit environment values are never replaced.
- Windows defaults bind to loopback.
- Windows defaults disable the RP4 update scheduler.
- Service mode explicitly overrides runtime root to `%ProgramData%\DePara`.
- Platform detection is data; route and service modules should consume capabilities rather than grow scattered platform conditionals.

## Runtime persistence

RP4/Linux:

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

Windows service:

| Data | Default path |
|---|---|
| Runtime root | `%ProgramData%\DePara` |
| Config env | `%ProgramData%\DePara\config.env` |
| Product data | `%ProgramData%\DePara\data` |
| Logs | `%ProgramData%\DePara\logs` |
| Backups | `%ProgramData%\DePara\backups` |
| Temp | `%ProgramData%\DePara\temp` |
| Future packaged releases | `%ProgramData%\DePara\releases` |
| Future active release | `%ProgramData%\DePara\current` |

Migration contract:

- On first runtime initialization, legacy data from repository `data/` or `src/data/` may be migrated to runtime data.
- After migration, runtime data is canonical.
- Release directories must not own mutable product state.
- Windows installation and uninstallation preserve runtime data unless purge is explicit.

## Filesystem safety

`src/utils/fileOperations.js::validateSafePath` is the required guard for path input.

Validation behavior:

- Rejects empty values.
- Rejects null bytes.
- Rejects explicit traversal fragments: `../`, `..\\`, `~/`.
- Resolves candidate path before authorization.
- Resolves existing real paths to block symlink escape.
- For missing targets, validates the nearest existing parent.
- Authorizes paths against allowed base directories.

Default allowed bases:

- Linux: `os.homedir()`, `os.tmpdir()`, `/media`, `/mnt`
- Windows: `os.homedir()`, `C:\\`, `D:\\`, `E:\\`

`DEPARA_ALLOWED_PATHS` replaces defaults. Use platform delimiter:

- Linux/macOS delimiter: `:`
- Windows delimiter: `;`

Windows service rules:

- Prefer UNC paths for network shares.
- Do not rely on user-session mapped drive letters.
- Service identity needs explicit access to every allowed root.
- Junction, symlink/reparse point, locked-file and removable-media behavior must be certified.

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

RP4 update invariant:

- The orchestrator prepares a clean immutable release, flips active release, restarts through PM2 and validates health.
- On failed health validation, rollback must restore the previous release.

Windows update invariant:

- The RP4 Git/PM2 update strategy is not a valid Windows production updater.
- Windows runs with `DEPARA_DISABLE_UPDATE_SCHEDULER=true` until packaged release staging, signature/checksum validation, service restart, health validation and rollback are implemented.
- The future Windows updater must activate prebuilt artifacts and must not run npm or Git on the end-user host.

## Desktop/session architecture

- A Windows service runs outside the interactive user desktop and must not own tray or window UI.
- Native Windows tray/fullscreen behavior belongs to a separate user-session shell.
- The shell may call the loopback API but must use a constrained authenticated channel before production.
- RP4 Linux desktop routes remain operational during the migration, but new shared code must not depend on Linux window-management tools.

## Fragile zones

- `src/public/app.js`: large legacy UI file; run E2E after any edit.
- `src/routes/fileOperations.js`: broad public API; run smoke and E2E after any edit.
- `src/services/updateOrchestrator.js`: side-effectful RP4 update logic; use `DEPARA_DISABLE_UPDATE_SIDE_EFFECTS=true` in tests.
- `src/routes/tray.js`: Linux-specific desktop control; do not extend it with embedded Windows command branches.
- `src/utils/desktopManager.js`: Linux `.desktop` integration; Windows shortcut/tray work belongs to a Windows adapter/shell.
- Express route syntax: project uses Express 5; do not reintroduce `:param(*)` or `app.use('*')`.

## Cross-platform verification

Shared source changes require:

- Linux x64 lint/unit coverage.
- Windows x64 lint/unit coverage.
- Windows and Linux smoke coverage.
- Existing Playwright E2E coverage.
- Physical RP4 release gate before RP4 promotion.

Windows production declaration additionally requires physical Windows 10 and Windows 11 service lifecycle and filesystem certification.
