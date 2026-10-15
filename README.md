# DePara

AI_DOCUMENTATION_TARGET=agents
HUMAN_ONBOARDING_TARGET=false
CANONICAL_DOC_ENTRYPOINT=docs/README.md

## Product contract

DePara is a local-first file automation and image slideshow service exclusivo para Windows. O produto é uma interface web local apoiada por uma API Express.

Primary jobs:

- Configure folders and slideshow state.
- Execute copy, move and delete file operations.
- Persist and run scheduled file operations.
- Browse folders and image assets for slideshow flows.
- Export/import operational backup state.
- Preparar atualizações locais com reinício manual do processo Windows.

## Runtime contract

- HTTP entrypoint: `src/main.js`
- Default host: `127.0.0.1`
- Default app/config port: `3000`
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
- Update orchestrator: `src/services/updateOrchestrator.js` (opcional e desativado por padrão)
- Performance audit: `scripts/performance-audit.js`
- AI documentation: `docs/`

## Required release gate

Run all commands from repository root:

```powershell
npm ci
npm run lint
npm run test:unit
npm run test:smoke
npm run test:e2e
npm audit --audit-level=high
```

Expected dependency audit state: `found 0 vulnerabilities`.

## Persistence contract

- Runtime root: `DEPARA_RUNTIME_ROOT` or `%USERPROFILE%\.depara`
- Config env file: `DEPARA_CONFIG_ENV_PATH` or `%USERPROFILE%\.depara\config.env`
- Functional data: `DEPARA_DATA_DIR` or `%USERPROFILE%\.depara\data`
- Active release: `DEPARA_CURRENT_DIR` or `%USERPROFILE%\.depara\current`
- Release store: `DEPARA_RELEASES_DIR` or `%USERPROFILE%\.depara\releases`
- Logs: `DEPARA_LOG_DIR` or `%USERPROFILE%\.depara\logs`
- Backups: `DEPARA_BACKUP_DIR` or `%USERPROFILE%\.depara\backups`
- Temp files: `DEPARA_TEMP_DIR` or `%USERPROFILE%\.depara\temp`

## Non-negotiable invariants

- O processo Windows local é iniciado por `npm run start:windows`; PM2, systemd e launchers Linux não fazem parte do contrato.
- O auto-update permanece desativado por padrão e exige reinício manual do processo Windows.
- Runtime releases are immutable. Mutable state lives under `%USERPROFILE%\.depara\data`.
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
6. [docs/WINDOWS-OPS.md](docs/WINDOWS-OPS.md)
7. [docs/PERFORMANCE-AUDIT.md](docs/PERFORMANCE-AUDIT.md)
8. [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)
