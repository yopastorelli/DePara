# AGENT_CONTEXT DePara

DOC_FORMAT=agent_contract
DOC_OWNER=repository
LAST_AUDIT_SCOPE=technical_product_e2e_cross_platform_readiness

## Mission

Maintain DePara as a local-first file automation and slideshow product with safe filesystem boundaries, deterministic runtime persistence, RP4 operations, native Windows execution and reproducible hardware certification.

## Platform contract

- RP4 production is supervised by PM2 and executes `~/.depara/current/src/main.js`.
- Windows execution is native; WSL is not a production dependency.
- Shared product behavior remains in Node.js/Express modules.
- Supervisor, packaging, desktop integration and update behavior are platform adapters.
- Persisted `config.env` is canonical after explicit process environment and before defaults.
- RP4 defaults to `~/.depara` and port `3001`.
- Windows interactive defaults to `%LOCALAPPDATA%\DePara` and port `3000`.
- Windows service defaults to `%ProgramData%\DePara` and port `3001`.
- Windows service supervision uses WinSW.
- Windows packaged auto-update remains disabled until signed activation and rollback exist.
- Production installation scripts certify Node 22 or 24 LTS.

## Agent read order

1. `README.md`
2. `docs/ARCHITECTURE.md`
3. `docs/API.md`
4. `docs/INSTALLATION.md`
5. `docs/TESTING.md`
6. `docs/RP4-OPS.md`
7. `docs/WINDOWS-OPS.md`
8. `docs/TROUBLESHOOTING.md`
9. target source files
10. tests covering the target

## Change policy

- Public route changes update API docs, smoke/E2E coverage and UI callers together.
- Shared runtime changes update architecture, installation, RP4, Windows and test contracts.
- Windows runtime changes preserve RP4 PM2/immutable-release behavior.
- RP4 runtime changes preserve Windows native launcher/service behavior.
- Operational failure fixes add regression coverage and troubleshooting documentation.
- Keep docs and source in UTF-8.

## Current hardening decisions

- Default HTTP bind is `127.0.0.1`.
- Platform launchers do not override persisted network config.
- PM2 consumes the effective port loaded from `config.env`.
- RP4 clean bootstrap and launcher fallback both use `3001`.
- Windows WinSW XML does not define `HOST`, `PORT`, `NODE_ENV` or logging overrides.
- Windows service install/remove are idempotent.
- Windows installation is health-gated.
- Windows package assembly is local and checksum-gated through `packaging/windows/build-package.ps1`.
- RP4 Node installation uses a pinned official archive and official SHA-256 manifest.
- NTFS allowlist protection is canonicalized and has a mandatory junction escape smoke test.
- Unit and smoke suites are separate to avoid duplicate CI work.
- CI runs once per PR commit, cancels obsolete runs and ignores documentation-only changes.
- Dependency overrides remain major-compatible:
  - `@istanbuljs/load-nyc-config -> js-yaml@5.2.2`
  - `minimatch@10.2.5 -> brace-expansion@5.0.9`
  - `minimatch@9.0.9 -> brace-expansion@2.1.4`
  - `minimatch@3.1.5 -> brace-expansion@1.1.18`
  - `anymatch -> picomatch@2.3.2`

## Required verification

Source gate:

```bash
npm run test:all
```

Cross-platform changes require the complete GitHub Actions matrix.

Physical promotion gates:

```bash
./scripts/certify-rp4.sh
```

```powershell
.\certify-service.ps1
```

Run each certification after installation and after a real reboot on its target machine.

Expected markers:

- `RP4_PASS`
- `WINDOWS_SERVICE_PASS`

Hosted CI does not replace these physical markers.

## Untracked outputs

- `node_modules/`
- `coverage/`
- `test-results/`
- `playwright-report/`
- runtime `logs/`, `backups/`, `data/`, `temp/`
- `packaging/windows/dist/`
- bundled Node/WinSW binaries
- unsigned Windows package/installer outputs
