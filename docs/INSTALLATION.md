# INSTALLATION_CONTRACT

## Supported runtime baseline

| Requirement | Contract |
|---|---|
| Node.js | application engine remains `>=18`; production installers certify Node 22 or 24 LTS |
| npm | `>=9.0.0`; bundled Windows package uses npm from the approved Node distribution |
| Git | development and RP4 immutable update source only |
| PM2 | RP4 production supervisor only |
| WinSW | Windows packaged-service supervisor only |
| PowerShell 7 | Windows package assembly |
| Elevated PowerShell | Windows service installation/removal |

Node 18 and 20 are end-of-life and are not accepted by the production installation scripts.

## Shared development setup

```bash
npm ci
npm run lint
npm run test:unit
npm run test:smoke
npm run start
```

Generic source defaults:

- UI: `http://127.0.0.1:3000/ui`
- Health: `http://127.0.0.1:3000/health`
- API docs: `http://127.0.0.1:3000/api/docs`

## Script contract

| Script | Contract |
|---|---|
| `npm run start` | source backend with `node src/main.js` |
| `npm run start:windows` | native Windows launcher; persisted config is loaded before network defaults |
| `npm run runtime:bootstrap` | create/activate immutable runtime release |
| `npm run start:bg` | bootstrap and start the canonical PM2 ecosystem in production mode |
| `npm run start:bg:prod` | production alias for canonical PM2 bootstrap/start |
| `npm run restart:bg` | restart PM2 app and refresh environment |
| `npm run test:unit` | unit suites only; smoke tests are excluded |
| `npm run test:smoke` | API/platform smoke suites |
| `npm run test:all` | lint, unit, smoke, E2E and dependency audit |

## Configuration precedence

1. explicit process environment;
2. persisted `<runtime>/config.env`;
3. application/platform defaults.

Supervisors must not replace canonical `HOST` or `PORT` values from `config.env`.

| Mode | Runtime root | Default port |
|---|---|---|
| generic source | `~/.depara` | `3000` |
| RP4 PM2 | `~/.depara` | `3001` |
| Windows interactive | `%LOCALAPPDATA%\DePara` | `3000` |
| Windows service | `%ProgramData%\DePara` | `3001` |

## Raspberry Pi 4

Canonical installation from `$HOME/DePara`:

```bash
chmod +x install-raspberry.sh scripts/certify-rp4.sh
./install-raspberry.sh
```

The installer is safe for ARM64 and ARMv7, verifies the official Node archive checksum, preserves existing config/data, aligns PM2 to the immutable wrapper and fails unless health/status validation succeeds.

Certification after installation and after reboot:

```bash
./scripts/certify-rp4.sh
```

Expected terminal result contains:

```text
"certification": "RP4_PASS"
```

Manual endpoint check:

```bash
PORT="$(grep -E '^PORT=' "$HOME/.depara/config.env" | tail -n 1 | cut -d '=' -f 2-)"
PORT="${PORT:-3001}"
pm2 status DePara
curl -fsS "http://127.0.0.1:${PORT}/health"
curl -fsS "http://127.0.0.1:${PORT}/api/status"
```

The PM2 process must execute `~/.depara/current/src/main.js`.

## Native Windows source

Use Windows PowerShell rather than WSL:

```powershell
npm ci
npm run lint
npm run test:platform
npm run test:unit
npm run test:smoke
npm run start:windows
```

Use the effective port from `%LOCALAPPDATA%\DePara\config.env` when present.

## Windows service package

Build locally without GitHub Actions:

```powershell
.\packaging\windows\build-package.ps1 `
  -NodeArchivePath C:\inputs\node-v22.x-win-x64.zip `
  -NodeArchiveSha256 '<official-node-sha256>' `
  -WinSWPath C:\inputs\WinSW.exe `
  -WinSWSha256 '<verified-winsw-sha256>'
```

The builder verifies both input hashes, accepts only Node 22/24, installs production dependencies and emits `DePara-windows-service.zip` plus a hashed manifest.

Install from the extracted package using elevated PowerShell:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\install-service.ps1
```

The installer is idempotent, preserves `config.env` and product data, rejects a non-loopback host and completes only after `/health` returns `OK`.

Certification after installation and after reboot:

```powershell
.\certify-service.ps1
```

Expected result contains:

```text
"certification": "WINDOWS_SERVICE_PASS"
```

Removal preserves data:

```powershell
.\uninstall-service.ps1
```

Explicit purge:

```powershell
.\uninstall-service.ps1 -PurgeData
```

## Filesystem allowlists

RP4 example:

```env
DEPARA_ALLOWED_PATHS=/home/pi:/media:/mnt
```

Windows example:

```env
DEPARA_ALLOWED_PATHS=C:\Users;D:\Media;\\server\share
```

Use the real user home on RP4. Windows service access to UNC roots depends on the configured service identity and share/NTFS permissions.

## Production boundaries

Automated CI proves source-level behavior on hosted Ubuntu and Windows runners. It does not prove:

- a real RP4 boot/PM2 restore;
- a real Windows service installation/reboot;
- removable-media and locked-file hardware behavior;
- required UNC credentials;
- code signing;
- a separate tray/fullscreen shell;
- signed packaged update and rollback.

Those gates are executed through the local certification scripts and release procedures documented in `RP4-OPS.md` and `WINDOWS-OPS.md`.
