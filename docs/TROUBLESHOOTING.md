# TROUBLESHOOTING_CONTRACT

Port note:

- `3000` is the app/config default for direct local runs.
- `3001` is the PM2/RP4 default from `ecosystem.config.js`.
- When troubleshooting production or launcher behavior, prefer the effective port from `~/.depara/config.env` or PM2 env.

## Symptom: UI does not load

Commands:

```bash
npm run lint
npm run test:e2e
curl -fsS http://127.0.0.1:3000/health
curl -fsS http://127.0.0.1:3000/api/status
```

Primary suspects:

- parser/runtime error in `src/public/app.js`
- static route regression in `src/main.js`
- API route failing before UI hydration
- rate limit too low for UI bootstrap
- wrong `HOST`/`PORT`

## Symptom: API is offline from UI but backend health is OK

Checks:

```bash
curl -i http://127.0.0.1:3000/api/status
curl -i http://127.0.0.1:3000/api/config
```

Likely causes:

- `429` from rate limiter
- frontend calling stale route
- browser cannot reach WSL/container loopback
- CSP regression

Controls:

- Raise `DEPARA_READ_RATE_LIMIT`, `DEPARA_NORMAL_RATE_LIMIT` or `DEPARA_SLIDESHOW_RATE_LIMIT`.
- Use `DEPARA_DISABLE_RATE_LIMITS=true` only for controlled diagnostics.

## Symptom: file operation returns access denied

Commands:

```bash
node -e "console.log(process.env.DEPARA_ALLOWED_PATHS)"
npm run test:smoke
```

Check:

- path is under allowed bases
- no `../`, `..\`, `~/` fragments
- symlink realpath does not escape allowed bases
- parent directory exists for write targets
- `DEPARA_ALLOWED_PATHS` did not accidentally replace needed defaults

Fix:

- Add the intended base directory to `DEPARA_ALLOWED_PATHS`.
- On Linux/macOS separate values with `:`.
- On Windows separate values with `;`.

## Symptom: slideshow lists no images

Commands:

```bash
curl -s -X POST http://127.0.0.1:3000/api/files/list-images \
  -H 'Content-Type: application/json' \
  -d '{"folderPath":"/absolute/path","extensions":[".jpg",".jpeg",".png",".gif",".bmp",".webp"],"recursive":true}'
```

Check:

- `folderPath` passes `validateSafePath`.
- extensions include leading dots for `POST /list-images`.
- images are not filtered by ignored-pattern rules.
- symlinks outside allowed bases are intentionally skipped/blocked.

## Symptom: direct image URL fails

Contract:

- Route is `GET /api/files/image/:imagePath`.
- Absolute file path must be encoded as a single segment.

Client expression:

```js
`/api/files/image/${encodeURIComponent(imagePath)}`
```

Failure causes:

- raw slash in URL path
- unsupported extension
- file outside allowed bases
- ignored filename

## Symptom: config does not persist

Commands:

```bash
curl -fsS http://127.0.0.1:3000/api/config
ls -la ~/.depara/data
```

Check:

- `DEPARA_DATA_DIR`
- `DEPARA_CONFIG_FILE`
- runtime write permissions
- process user owns runtime root

## Symptom: update is stuck or unsafe

Commands:

```bash
pm2 status
pm2 logs DePara --lines 100
curl -fsS http://127.0.0.1:3000/api/update/auto/status
curl -fsS http://127.0.0.1:3000/api/update/auto/diagnostics
```

Interpretation:

- `runtime.supervisor.pm2.registered=false`: PM2 process contract broken.
- `runtime.scheduler.stale=true`: scheduler/process lifecycle issue.
- `runtime.lastFailureStage` set: start investigation at that stage.
- health failure after activation: rollback should restore previous release.

## Symptom: RP4 menu does not open app

Commands:

```bash
pm2 status
curl -fsS http://127.0.0.1:3000/health
$HOME/DePara/start-depara.sh status
cat ~/.local/share/applications/depara.desktop
```

Fix order:

1. PM2 process healthy.
2. `/health` OK.
3. `start-depara.sh status` resolves expected URL.
4. `.desktop` `Exec=` points to `start-depara.sh open`.

Do not fix menu issues by making the launcher start or update the backend.

## Symptom: Playwright E2E cannot start browser

Commands:

```bash
npx playwright install chromium
npx playwright install-deps chromium
npm run test:e2e
```

On constrained environments, install native dependencies before retrying E2E.

## Symptom: dependency audit fails

Commands:

```bash
npm audit --audit-level=high
npm ls js-yaml picomatch --all
```

Expected overrides in `package.json`:

- `@istanbuljs/load-nyc-config -> js-yaml@5.0.0`
- `anymatch -> picomatch@2.3.2`

If removing overrides, require:

```bash
npm install
npm audit --audit-level=high
npm run test:unit
```

## Symptom: text encoding looks broken

Command:

```bash
rg -n "Ã[ƒ‚]|â[€™€œ€]|\x{00D2}|\x{FFFD}" README.md docs src/public src/routes
```

Decision:

- If source contains mojibake, fix UTF-8 source.
- If only terminal output is mojibake, do not rewrite files.
