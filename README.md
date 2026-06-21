# DePara

AI_DOCUMENTATION_TARGET=agents
HUMAN_ONBOARDING_TARGET=false
CANONICAL_DOC_ENTRYPOINT=docs/README.md

## Product contract

DePara is a local-first file automation and image slideshow service for Raspberry Pi 4 and desktop Linux/Windows development. The product surface is a static web UI backed by an Express API.

Primary jobs:

- Configure folders and slideshow state.
- Execute copy, move and delete file operations.
- Persist and run scheduled file operations.
- Browse folders and image assets for slideshow flows.
- Export/import operational backup state.
- Run immutable-release auto-update under PM2 on RP4.

## Runtime contract

- HTTP entrypoint: `src/main.js`
- Default host: `127.0.0.1`
- Default app/config port: `3000`
- Default PM2 production port in `ecosystem.config.js`: `3001`
- UI: `http://127.0.0.1:<PORT>/ui`
- Root metadata: `http://127.0.0.1:<PORT>/`
- Health: `http://127.0.0.1:<PORT>/health`
- API health: `http://127.0.0.1:<PORT>/api/health`
- API docs endpoint: `http://127.0.0.1:<PORT>/api/docs`

Set `HOST=0.0.0.0` only when LAN exposure is intentional and the network boundary is controlled.

## Source of truth

- App metadata, scripts, dependency overrides: `package.json`
- Express setup and route mounting: `src/main.js`
- Public route modules: `src/routes/*`
- File operation engine: `src/utils/fileOperations.js`
- Low-level file permissions/copy/move helpers: `src/utils/fileOps/*`
- Runtime path derivation: `src/utils/runtimePaths.js`
- Operational config loader: `src/utils/runtimeConfig.js`
- Update orchestrator: `src/services/updateOrchestrator.js`
- PM2 process model: `ecosystem.config.js`
- RP4 launcher: `start-depara.sh`
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

Expected dependency audit state: `found 0 vulnerabilities`.

## Persistence contract

- Runtime root: `DEPARA_RUNTIME_ROOT` or `~/.depara`
- Config env file: `DEPARA_CONFIG_ENV_PATH` or `~/.depara/config.env`
- Functional data: `DEPARA_DATA_DIR` or `~/.depara/data`
- Active immutable release: `DEPARA_CURRENT_DIR` or `~/.depara/current`
- Release store: `DEPARA_RELEASES_DIR` or `~/.depara/releases`
- Logs: `DEPARA_LOG_DIR` or `~/.depara/logs`
- Backups: `DEPARA_BACKUP_DIR` or `~/.depara/backups`
- Temp files: `DEPARA_TEMP_DIR` or `~/.depara/temp`

## Non-negotiable invariants

- Production RP4 supervisor is PM2.
- `depara.service` is legacy/bootstrap-only, not the product supervisor.
- `start-depara.sh` validates health and opens the UI; it must not install, update or replace the backend.
- Runtime releases are immutable. Mutable state lives under `~/.depara/data`.
- New update flows must use `/api/update/auto/*`.
- Legacy update endpoints stay public only to return `410 Gone`.
- Path-based file operations must pass `validateSafePath`.
- Shell fallbacks for file copy/move/chmod are disallowed.
- Tests must isolate runtime, data, logs, backups and temp directories.
- Generated E2E artifacts must not be committed.

## Documentation read order

1. [docs/README.md](docs/README.md)
2. [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
3. [docs/API.md](docs/API.md)
4. [docs/INSTALLATION.md](docs/INSTALLATION.md)
5. [docs/TESTING.md](docs/TESTING.md)
6. [docs/RP4-OPS.md](docs/RP4-OPS.md)
7. [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)
