# DePara

AI_DOCUMENTATION_TARGET=agents
HUMAN_ONBOARDING_TARGET=false
CANONICAL_DOC_ENTRYPOINT=docs/README.md

## Product contract

DePara is a local-first file automation and image slideshow service for Raspberry Pi 4, desktop Linux and native Windows 10/11 x64. The product surface is a static web UI backed by an Express API.

Primary jobs:

- Configure folders and slideshow state.
- Execute copy, move and delete file operations.
- Persist and run scheduled file operations.
- Browse folders and image assets for slideshow flows.
- Export/import operational backup state.
- Run immutable-release auto-update under PM2 on RP4.
- Run the shared backend natively on Windows without WSL.

## Platform contract

| Platform | Runtime | Supervisor | Status |
|---|---|---|---|
| Raspberry Pi 4 | Native Linux ARM | PM2 | Production contract preserved |
| Windows 11 x64 | Native Windows | WinSW service target | Foundation implemented; certification pending |
| Windows 10 22H2 x64 | Native Windows | WinSW service target | Compatibility target; certification pending |
| WSL | Linux compatibility layer | none | Not a production target |

Windows tray, fullscreen shell, signed installer and packaged auto-update are separate delivery gates. See `docs/WINDOWS-OPS.md`.

## Runtime contract

- HTTP entrypoint: `src/main.js`
- Windows launcher: `scripts/start-windows.js`
- Default host: `127.0.0.1`
- Default app/config port: `3000`
- Default PM2/WinSW service port: `3001`
- UI: `http://127.0.0.1:<PORT>/ui`
- Root metadata: `http://127.0.0.1:<PORT>/`
- Health: `http://127.0.0.1:<PORT>/health`
- API health: `http://127.0.0.1:<PORT>/api/health`
- API docs endpoint: `http://127.0.0.1:<PORT>/api/docs`

Set `HOST=0.0.0.0` only when LAN exposure is intentional and the network boundary is controlled.

## Source of truth

- App metadata, scripts, dependency overrides: `package.json`
- Express setup and route mounting: `src/main.js`
- Platform runtime defaults: `src/platform/runtimeProfile.js`
- Public route modules: `src/routes/*`
- File operation engine: `src/utils/fileOperations.js`
- Low-level file permissions/copy/move helpers: `src/utils/fileOps/*`
- Runtime path derivation: `src/utils/runtimePaths.js`
- Operational config loader: `src/utils/runtimeConfig.js`
- Update orchestrator: `src/services/updateOrchestrator.js`
- PM2 process model: `ecosystem.config.js`
- RP4 launcher: `start-depara.sh`
- Windows service packaging: `packaging/windows/`
- AI documentation: `docs/`

## Required release gate

Run all commands from repository root:

```bash
npm ci
npm run lint
npm run test:unit
npm run test:smoke
npm run test:e2e
npm audit --audit-level=high
```

Cross-platform runtime changes additionally require green Linux and Windows CI plus physical RP4 validation. Windows production promotion also requires physical Windows 10 and Windows 11 certification.

Expected dependency audit state: `found 0 vulnerabilities`.

## Persistence contract

RP4/Linux defaults:

- Runtime root: `DEPARA_RUNTIME_ROOT` or `~/.depara`
- Config env file: `DEPARA_CONFIG_ENV_PATH` or `~/.depara/config.env`
- Functional data: `DEPARA_DATA_DIR` or `~/.depara/data`
- Active immutable release: `DEPARA_CURRENT_DIR` or `~/.depara/current`
- Release store: `DEPARA_RELEASES_DIR` or `~/.depara/releases`
- Logs: `DEPARA_LOG_DIR` or `~/.depara/logs`
- Backups: `DEPARA_BACKUP_DIR` or `~/.depara/backups`
- Temp files: `DEPARA_TEMP_DIR` or `~/.depara/temp`

Windows defaults:

- Interactive source execution: `%LOCALAPPDATA%\DePara`
- Service execution: `%ProgramData%\DePara`
- Explicit environment variables override platform defaults.

## Non-negotiable invariants

- Production RP4 supervisor is PM2.
- `depara.service` is legacy/bootstrap-only, not the product supervisor.
- `start-depara.sh` validates health and opens the UI; it must not install, update or replace the backend.
- Runtime releases are immutable. Mutable state lives outside release directories.
- New RP4 update flows must use `/api/update/auto/*`.
- Legacy update endpoints stay public only to return `410 Gone`.
- The RP4 Git/PM2 updater must not run as the Windows update strategy.
- Windows defaults keep the update scheduler disabled until packaged update and rollback exist.
- Path-based file operations must pass `validateSafePath`.
- Shell fallbacks for file copy/move/chmod are disallowed.
- Tests must isolate runtime, data, logs, backups and temp directories.
- Generated E2E and packaging artifacts must not be committed.

## Documentation read order

1. [docs/README.md](docs/README.md)
2. [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
3. [docs/API.md](docs/API.md)
4. [docs/INSTALLATION.md](docs/INSTALLATION.md)
5. [docs/TESTING.md](docs/TESTING.md)
6. [docs/RP4-OPS.md](docs/RP4-OPS.md)
7. [docs/WINDOWS-OPS.md](docs/WINDOWS-OPS.md)
8. [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)
