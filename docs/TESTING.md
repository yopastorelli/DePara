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
| `npm run test:smoke` | Jest API smoke contracts and controlled file operations |
| `npm run test:e2e` | Playwright browser E2E against real UI/API flow |
| `npm run test:all` | lint + unit + E2E |
| `npm run test:coverage` | Jest coverage |
| `npm run test:watch` | local Jest watch |

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

- On WSL/localhost scenarios, browser verification must be trusted to Playwright if the Codex in-app browser cannot reach WSL loopback.

## Isolation rules

Tests must set isolated paths for:

- `DEPARA_RUNTIME_ROOT`
- `DEPARA_DATA_DIR`
- `DEPARA_CONFIG_FILE`
- `DEPARA_BACKUP_DIR`
- `LOG_FILE`

Tests that touch update must set:

```bash
DEPARA_DISABLE_UPDATE_SIDE_EFFECTS=true
DEPARA_DISABLE_UPDATE_SCHEDULER=true
```

Tests that need deterministic limiter behavior may set:

```bash
DEPARA_DISABLE_RATE_LIMITS=true
```

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

## Dependency audit policy

Use:

```bash
npm audit --audit-level=high
```

Current lockfile is expected to have zero vulnerabilities because `package.json` includes targeted overrides:

- `@istanbuljs/load-nyc-config -> js-yaml@5.0.0`
- `anymatch -> picomatch@2.3.2`

Do not remove these overrides unless the upstream dependency tree no longer needs them and `npm audit --audit-level=high` still reports zero vulnerabilities.

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
