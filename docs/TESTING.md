# TESTING_CONTRACT

## Canonical gates

```bash
npm run lint
npm run test:unit
npm run test:smoke
npm run test:e2e
npm audit --audit-level=high
```

Expected audit output:

```text
found 0 vulnerabilities
```

## Test scripts

| Script | Scope |
|---|---|
| `npm test` | alias for unit tests |
| `npm run test:unit` | Jest backend/unit contracts |
| `npm run test:platform` | focused Windows/RP4 runtime-profile contracts |
| `npm run test:smoke` | Jest API smoke contracts and controlled file operations |
| `npm run test:e2e` | Playwright browser E2E against real UI/API flow |
| `npm run test:all` | lint + unit + E2E |
| `npm run test:coverage` | Jest coverage |
| `npm run test:watch` | local Jest watch |

## Cross-platform CI matrix

`.github/workflows/cross-platform-ci.yml` is the canonical source-level matrix.

Required jobs:

| Scope | Operating systems | Node versions |
|---|---|---|
| lint + unit | Ubuntu and Windows | 22 and 24 |
| smoke | Ubuntu and Windows | 22 |
| dependency audit | Ubuntu | 22 |
| Playwright E2E | Ubuntu | 22 |

CI proves source portability; it does not replace physical release certification.

Production release gates additionally require:

- Raspberry Pi 4 physical validation for every shared runtime change.
- Windows 11 x64 physical validation before Windows promotion.
- Windows 10 22H2 x64 physical compatibility validation before claiming Windows 10 support.
- Windows service install, reboot, health, stop, uninstall and data-preservation validation.
- NTFS, removable-media, locked-file and UNC-path file-operation validation.

## Browser dependencies

Install Playwright browser once per machine/runtime:

```bash
npx playwright install chromium
```

Install native Chromium dependencies when the OS image lacks them:

```bash
npx playwright install-deps chromium
```

Known environment note:

- WSL is allowed for development diagnostics only; it is not the Windows production runtime contract.
- Browser verification must be trusted to Playwright when an in-app browser cannot reach a test loopback endpoint.

## Isolation rules

Tests must set isolated paths for:

- `DEPARA_RUNTIME_ROOT`
- `DEPARA_DATA_DIR`
- `DEPARA_CONFIG_FILE`
- `DEPARA_BACKUP_DIR`
- `DEPARA_LOG_DIR`
- `DEPARA_TEMP_DIR`
- `LOG_FILE`

Tests that touch update must set:

```bash
DEPARA_DISABLE_UPDATE_SIDE_EFFECTS=true
DEPARA_DISABLE_UPDATE_SCHEDULER=true
```

Do not set `DEPARA_DISABLE_UPDATE_SIDE_EFFECTS=true` globally for the complete unit suite because supervisor/restart unit tests intentionally verify the non-suppressed control flow with mocks.

Tests that start or import process lifecycle code may set:

```bash
DEPARA_DISABLE_PROCESS_HOOKS=true
```

Tests that need deterministic limiter behavior may set:

```bash
DEPARA_DISABLE_RATE_LIMITS=true
```

## Platform-profile coverage

`tests/unit/platform/runtimeProfile.test.js` must verify at least:

- RP4 ARM detection.
- RP4 runtime root and PM2 contract remain unchanged.
- Windows x64 detection.
- Windows interactive runtime root uses `%LOCALAPPDATA%\DePara`.
- Explicit env values override defaults.
- Windows disables the RP4 scheduler by default.
- Windows-only flags are not injected on Linux.

## E2E product story

Playwright must verify at least:

- UI loads without parser/runtime console errors.
- API status is reachable from the UI.
- Configuration can be saved and rehydrated.
- File operation flow can use controlled fixture paths.
- Slideshow can list fixture images and serve image assets.

## Smoke coverage requirements

Smoke tests must cover:

- `/health` and `/api/status`
- config persistence
- copy/move/delete with temp files
- folder listing
- image listing
- scheduled operation create/edit/pause/execute
- backup export/import
- auto-update status with destructive side effects disabled
- invalid input returning actionable errors
- path security for unsafe traversal/symlink cases

Windows-specific smoke expansion must eventually cover:

- drive-root allowlists;
- path delimiters and casing;
- NTFS junction escape prevention;
- locked-file error contracts;
- UNC path authorization;
- service runtime persistence.

## Dependency audit policy

Use:

```bash
npm audit --audit-level=high
```

Current lockfile is expected to have zero vulnerabilities because `package.json` includes targeted, major-compatible overrides:

- `@istanbuljs/load-nyc-config -> js-yaml@5.2.2`
- `minimatch@10.2.5 -> brace-expansion@5.0.9`
- `minimatch@9.0.9 -> brace-expansion@2.1.4`
- `minimatch@3.1.5 -> brace-expansion@1.1.18`
- `anymatch -> picomatch@2.3.2`

The `brace-expansion` overrides intentionally preserve the dependency major expected by each `minimatch` line. Do not replace them with one global major override.

Do not remove or change these overrides unless the upstream dependency tree no longer needs them and `npm audit --audit-level=high` still reports zero vulnerabilities.

## Text/encoding verification

Command:

```bash
rg -n "Ã[ƒ‚]|â[€™€œ€]|\x{00D2}|\x{FFFD}" README.md docs src/public src/routes
```

Interpretation:

- If only terminal rendering is wrong, do not rewrite files.
- If source files contain mojibake, fix UTF-8 content and rerun lint/E2E.
- Do not mask mojibake by overriding `innerHTML` or `textContent`; fix source encoding.

## Generated artifact policy

Do not commit:

- `test-results/`
- `playwright-report/`
- `coverage/`
- runtime `logs/`, `backups/`, `data/`
- bundled Node/WinSW binaries
- unsigned Windows installer outputs
