# TESTING_CONTRACT

## Canonical local gates

```bash
npm run lint
npm run test:unit
npm run test:smoke
npm run test:e2e
npm audit --audit-level=high
```

`npm run test:all` executes the complete sequence above.

Expected audit result:

```text
found 0 vulnerabilities
```

## Suite separation

| Script | Scope |
|---|---|
| `npm test` | unit alias |
| `npm run test:unit` | Jest unit/backend contracts; excludes `tests/smoke/` |
| `npm run test:platform` | focused runtime-profile contracts |
| `npm run test:smoke` | API, filesystem and platform smoke contracts |
| `npm run test:e2e` | Playwright browser product flow |
| `npm run test:coverage` | unit coverage; excludes smoke |

Unit jobs must not execute smoke tests implicitly. Smoke runs once per operating system in its dedicated job.

## Cross-platform CI matrix

`.github/workflows/cross-platform-ci.yml` is canonical.

| Scope | Operating systems | Node versions |
|---|---|---|
| lint + unit | Ubuntu and Windows | 22 and 24 |
| smoke | Ubuntu and Windows | 22 |
| native launcher/config precedence/PowerShell/WinSW | Windows | 22 |
| dependency audit | Ubuntu | 22 |
| Playwright E2E | Ubuntu | 22 |

CI efficiency controls:

- pull-request commits run one workflow, not duplicate push plus PR workflows;
- direct `main` pushes remain validated;
- documentation-only changes are ignored;
- concurrency cancels obsolete runs for the same PR/ref;
- every job has a timeout;
- unit and smoke suites are separated;
- Actions use current Node 24-based major versions.

The Windows native job must:

- parse `build-package.ps1`, install, uninstall and certification scripts;
- parse `DeParaService.xml`;
- reject supervisor overrides for `HOST`, `PORT`, `NODE_ENV` and logging;
- start `scripts/start-windows.js` with a non-default port stored only in `config.env`;
- validate `/health`, `/api/status` and runtime directories.

The Linux Node 22 job must run `bash -n` on RP4 install, launcher and certification scripts.

## Required unit contracts

- Windows path selection uses `path.win32` even when simulated from another host.
- Windows launcher can defer network defaults so `config.env` remains canonical.
- RP4 bootstrap defaults to port `3001` and PM2 identity.
- Generic bootstrap remains on port `3000`.
- PM2 ecosystem consumes the persisted configured port in all environments.
- Explicit process environment remains higher priority than `config.env`.

## Filesystem smoke contracts

Smoke must cover:

- `/health` and `/api/status`;
- config persistence;
- copy/move/delete with isolated temporary files;
- folders and images;
- scheduled operation lifecycle;
- backup export/import;
- update status with destructive effects disabled;
- unsafe traversal and symlink/junction escape protection.

On Windows, `tests/smoke/windows-path-security.smoke.test.js` must create a real NTFS junction and prove that it cannot escape `DEPARA_ALLOWED_PATHS`. A skipped privilege-dependent directory-symlink test is not sufficient evidence.

Physical Windows testing still covers locked files, removable media, required UNC roots and service-account permissions.

## Process isolation

Tests set isolated values for runtime, data, config, backup, log and temp paths.

Update tests use:

```bash
DEPARA_DISABLE_UPDATE_SIDE_EFFECTS=true
DEPARA_DISABLE_UPDATE_SCHEDULER=true
```

Do not set update-side-effect suppression globally for the complete unit suite because mocked supervisor tests exercise the normal control path.

Lifecycle tests may use:

```bash
DEPARA_DISABLE_PROCESS_HOOKS=true
```

Rate-limit tests may use:

```bash
DEPARA_DISABLE_RATE_LIMITS=true
```

## Physical certification

Hosted CI cannot certify hardware boot/service restoration.

RP4 after install and after reboot:

```bash
./scripts/certify-rp4.sh
```

Required marker:

```text
"certification": "RP4_PASS"
```

Windows service after install and after reboot:

```powershell
.\certify-service.ps1
```

Required marker:

```text
"certification": "WINDOWS_SERVICE_PASS"
```

These scripts are non-destructive. Their reports should be attached to the release/change record used for promotion.

## Dependency audit policy

Targeted major-compatible overrides currently protect the test dependency tree:

- `@istanbuljs/load-nyc-config -> js-yaml@5.2.2`;
- `minimatch@10.2.5 -> brace-expansion@5.0.9`;
- `minimatch@9.0.9 -> brace-expansion@2.1.4`;
- `minimatch@3.1.5 -> brace-expansion@1.1.18`;
- `anymatch -> picomatch@2.3.2`.

Do not replace the three `brace-expansion` lines with a single incompatible major override.

## Generated artifacts

Do not commit:

- `test-results/`;
- `playwright-report/`;
- `coverage/`;
- runtime `logs/`, `backups/`, `data/`;
- `packaging/windows/dist/`;
- bundled Node/WinSW binaries;
- unsigned Windows installer outputs.
