# TROUBLESHOOTING_CONTRACT

## Resolve the effective port first

Generic source defaults to `3000`; RP4 PM2 and Windows service default to `3001`. Persisted `config.env` is canonical for supervised operation.

RP4:

```bash
CONFIG="$HOME/.depara/config.env"
PORT="$(grep -E '^PORT=' "$CONFIG" | tail -n 1 | cut -d '=' -f 2-)"
PORT="${PORT:-3001}"
echo "$PORT"
```

Windows service:

```powershell
Get-Content "$env:ProgramData\DePara\config.env"
```

Do not diagnose a service using a hardcoded port when the persisted config differs.

## RP4: PM2 online but health fails

```bash
pm2 jlist
pm2 logs DePara --lines 100
./scripts/certify-rp4.sh
```

Required PM2 entrypoint:

```text
~/.depara/current/src/main.js
```

Likely causes:

- stale PM2 registration pointing to repository source;
- `config.env` port differs from the PM2 environment;
- active wrapper/release missing;
- unsupported Node major;
- runtime ownership problem.

Canonical repair:

```bash
cd "$HOME/DePara"
./install-raspberry.sh
```

The installer preserves config/data, replaces the PM2 registration and fails unless health/status pass.

## RP4: fresh installation uses the wrong port

A clean audited install must create `PORT=3001`. Generic direct execution remains `3000`.

```bash
grep -E '^(HOST|PORT)=' "$HOME/.depara/config.env"
pm2 env DePara | grep '^PORT:'
```

Both supervised values must agree. Do not patch `ecosystem.config.js` with another hardcoded port; edit persisted config and restart with environment refresh.

## RP4: Node installation fails

The installer downloads an official Node archive and verifies `SHASUMS256.txt`.

Check:

```bash
uname -m
curl -I "https://nodejs.org/dist/v${DEPARA_NODE_VERSION:-22.23.1}/"
```

Supported architecture labels are ARM64/AArch64 and ARMv7. A checksum mismatch is a hard failure and must never be bypassed.

## Windows: interactive launcher ignores config.env

Check:

```powershell
Get-Content "$env:LOCALAPPDATA\DePara\config.env"
Get-ChildItem Env:HOST,Env:PORT -ErrorAction SilentlyContinue
npm run start:windows
```

Direct execution precedence is explicit process environment, then config, then defaults. Remove an unintended explicit environment variable or update the config deliberately.

## Windows: service listens on an unexpected port

```powershell
Get-Content "$env:ProgramData\DePara\config.env"
Get-Content .\DeParaService.xml
.\certify-service.ps1
```

The XML must not define `HOST`, `PORT`, `NODE_ENV`, `LOG_LEVEL` or `LOG_TO_CONSOLE`. Service mode reloads persisted config to isolate operation from inherited system variables.

## Windows: service installs but does not become healthy

`install-service.ps1` polls health and prints recent logs before failing.

```powershell
Get-Service DePara
Get-ChildItem "$env:ProgramData\DePara\logs"
Get-Content "$env:ProgramData\DePara\logs\*" -Tail 100
```

Likely causes:

- invalid or occupied configured port;
- bundled Node is not version 22/24;
- incomplete package layout;
- filesystem permissions;
- invalid config.

Reinstallation is idempotent and preserves product data.

## Windows: package build fails

```powershell
.\packaging\windows\build-package.ps1 `
  -NodeArchivePath <zip> `
  -NodeArchiveSha256 <sha256> `
  -WinSWPath <exe> `
  -WinSWSha256 <sha256>
```

Hard failures include:

- input SHA-256 mismatch;
- Node ZIP without `node.exe`/`npm.cmd`;
- Node major other than 22/24;
- production dependency installation failure;
- missing source directories.

Never suppress a hash failure. Obtain the expected Node hash from the official release checksum manifest and verify the WinSW hash independently.

## Windows: UNC share is inaccessible

The standard WinSW service identity is typically LocalSystem, which usually lacks the intended remote-share identity.

Check:

- service logon identity;
- share permissions;
- NTFS permissions;
- UNC root in `DEPARA_ALLOWED_PATHS`;
- no mapped drive dependency.

Use a deliberate service account when network shares are required.

## File operation returns access denied

```bash
npm run test:smoke
```

Check:

- intended path is beneath an allowed root;
- traversal fragments are absent;
- real path/reparse target does not escape the root;
- parent exists for a new target;
- platform delimiter is correct.

Linux delimiter: `:`. Windows delimiter: `;`.

## UI does not load

Use the effective port:

```bash
curl -fsS "http://127.0.0.1:${PORT:-3000}/health"
curl -fsS "http://127.0.0.1:${PORT:-3000}/api/status"
npm run test:e2e
```

Suspects:

- frontend parser/runtime error;
- API failure before hydration;
- rate-limit regression;
- wrong port;
- CSP/static-route regression.

## Update is stuck or unsafe on RP4

```bash
curl -fsS "http://127.0.0.1:${PORT:-3001}/api/update/auto/status"
curl -fsS "http://127.0.0.1:${PORT:-3001}/api/update/auto/diagnostics"
pm2 logs DePara --lines 100
```

Windows must keep `DEPARA_DISABLE_UPDATE_SCHEDULER=true`; the RP4 updater is not a Windows recovery mechanism.

## Dependency audit fails

```bash
npm audit --audit-level=high
npm ls js-yaml brace-expansion picomatch --all
```

Expected targeted overrides are documented in `docs/TESTING.md`. Do not replace major-compatible `brace-expansion` overrides with one global version.

## Physical certification fails

RP4 marker:

```text
RP4_CERTIFICATION_FAIL
```

Windows certifier throws a terminating PowerShell error. Fix the reported machine condition and rerun the same non-destructive certification. Do not mark the platform promoted from hosted CI alone.
