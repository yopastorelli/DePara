# AGENT_CONTEXT DePara

DOC_FORMAT=agent_contract
DOC_OWNER=repository
LAST_AUDIT_SCOPE=technical_product_e2e_cross_platform_foundation

## Mission

Maintain DePara as a local-first file automation and slideshow product with safe filesystem boundaries, deterministic runtime persistence, RP4-friendly operations, native Windows execution and verifiable E2E behavior.

## Platform contract

- Raspberry Pi 4 production remains supervised by PM2.
- Windows execution is native; WSL is not a production dependency.
- Shared product behavior stays in Node.js/Express modules.
- Supervisor, desktop integration, packaging and update behavior are platform adapters.
- Windows service mode uses WinSW and `%ProgramData%\DePara`.
- Windows interactive development uses `%LOCALAPPDATA%\DePara` unless overridden.
- Windows packaged auto-update is not enabled until signed artifact activation and rollback are implemented.

## Agent read order

1. `README.md`
2. `docs/ARCHITECTURE.md`
3. `docs/API.md`
4. `docs/INSTALLATION.md`
5. `docs/TESTING.md`
6. `docs/RP4-OPS.md`
7. `docs/WINDOWS-OPS.md`
8. `docs/TROUBLESHOOTING.md`
9. Source files referenced by the target change
10. Tests covering the target change

## Change policy

- If a public route changes, update `docs/API.md`, smoke/E2E coverage and UI callers in the same change.
- If shared runtime behavior changes, update `docs/ARCHITECTURE.md`, `docs/INSTALLATION.md`, `docs/RP4-OPS.md`, `docs/WINDOWS-OPS.md` and environment templates.
- If a Windows runtime behavior changes, update `docs/WINDOWS-OPS.md` and cross-platform CI coverage.
- If an RP4 runtime behavior changes, update `docs/RP4-OPS.md` and preserve the PM2/immutable-release contract.
- If a test setup changes, update `docs/TESTING.md`.
- If an operational failure mode is fixed, add or update `docs/TROUBLESHOOTING.md`.
- Keep docs in UTF-8.
- Do not add human-oriented prose when a contract, table or command is clearer for an agent.

## Current hardening decisions

- HTTP server binds to `HOST` with safe default `127.0.0.1`.
- Express 5 route patterns avoid wildcard syntax incompatible with `path-to-regexp`.
- Dev mode uses `node --watch`; `nodemon` is not a dependency.
- PM2 is operational/global only and remains the RP4 supervisor.
- Windows service supervision is external to the backend and uses WinSW packaging.
- Windows runtime defaults are defined in `src/platform/runtimeProfile.js`.
- Windows defaults disable the RP4 auto-update scheduler until a packaged updater exists.
- Dependency overrides patch transitive audit issues while preserving current Jest:
  - `@istanbuljs/load-nyc-config -> js-yaml@5.2.2`
  - `minimatch@10.2.5 -> brace-expansion@5.0.9`
  - `minimatch@9.0.9 -> brace-expansion@2.1.4`
  - `minimatch@3.1.5 -> brace-expansion@1.1.18`
  - `anymatch -> picomatch@2.3.2`
- File operations use Node APIs only. Shell fallbacks are not allowed.
- `DEPARA_ALLOWED_PATHS` can replace default allowed bases for file operations.
- Rate limits are configurable and can be disabled only for controlled tests with `DEPARA_DISABLE_RATE_LIMITS=true`.
- `src/public/app.js` is normalized as UTF-8 source; do not reintroduce DOM-level mojibake monkey patches.

## Required verification after modifications

Minimum for any source change:

```bash
npm run lint
npm run test:unit
```

Minimum for route, UI, file operation, dependency or runtime changes:

```bash
npm run lint
npm run test:unit
npm run test:smoke
npm run test:e2e
npm audit --audit-level=high
```

Cross-platform runtime changes additionally require:

- Linux x64 CI.
- Windows x64 CI.
- Physical RP4 release validation before production promotion.
- Physical Windows 10 and Windows 11 validation before declaring Windows production-ready.

Expected result:

- lint exit code `0`
- unit suites pass
- smoke suites pass
- Playwright E2E passes
- audit reports `found 0 vulnerabilities`

## Repository outputs that must stay untracked

- `node_modules/`
- `coverage/`
- `test-results/`
- `playwright-report/`
- `logs/`
- `backups/`
- `data/`
- `src/data/`
- local `.env*` files
- Windows packaged runtime binaries and unsigned installer outputs
