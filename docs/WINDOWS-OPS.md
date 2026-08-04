# WINDOWS_OPERATIONS_CONTRACT

PLATFORM_PRIMARY=Windows 11 x64
PLATFORM_COMPATIBILITY=Windows 10 22H2 x64
RUNTIME_MODE=native
WSL_REQUIRED=false
SERVICE_SUPERVISOR=WinSW
CERTIFIED_NODE_MAJORS=22,24
DEFAULT_BIND_HOST=127.0.0.1
DEFAULT_SERVICE_PORT=3001
DEFAULT_SERVICE_RUNTIME_ROOT=%ProgramData%\DePara
DEFAULT_INTERACTIVE_RUNTIME_ROOT=%LOCALAPPDATA%\DePara

## Runtime contract

- The shared Node.js/Express backend runs natively on Windows.
- WSL, PM2, Bash and Git are not runtime dependencies of the packaged service.
- `config.env` is canonical for `HOST`, `PORT`, `NODE_ENV` and logging settings.
- WinSW defines only service identity and persistent runtime locations; it must not override operational network settings.
- Explicit process environment values take precedence over `config.env`.
- The RP4 Git/PM2 updater remains disabled on Windows.
- The service binds to loopback by default.

## Native source execution

Use PowerShell on Windows 10/11 x64:

```powershell
npm ci
npm run lint
npm run test:platform
npm run test:unit
npm run test:smoke
npm run start:windows
```

Interactive execution defaults to `%LOCALAPPDATA%\DePara`. When a config file exists under that runtime root, the launcher must respect its port rather than replacing it with `3000`.

Validation:

```powershell
Invoke-RestMethod http://127.0.0.1:3000/health
Start-Process http://127.0.0.1:3000/ui
```

Use the configured port when it differs from the default.

## Local package assembly

Package assembly is intentionally local and does not consume GitHub Actions minutes.

Required inputs:

- official Windows x64 Node.js ZIP for Node 22 or 24 LTS;
- SHA-256 from the official Node.js checksum manifest;
- WinSW executable;
- independently verified SHA-256 for that WinSW executable.

Run from PowerShell 7 at the repository root:

```powershell
.\packaging\windows\build-package.ps1 `
  -NodeArchivePath C:\inputs\node-v22.x-win-x64.zip `
  -NodeArchiveSha256 '<official-node-sha256>' `
  -WinSWPath C:\inputs\WinSW.exe `
  -WinSWSha256 '<verified-winsw-sha256>'
```

Output:

```text
packaging\windows\dist\
  DePara-windows-service.zip
  windows-dist\
    DeParaService.exe
    DeParaService.xml
    install-service.ps1
    uninstall-service.ps1
    certify-service.ps1
    config.env.example
    manifest.json
    runtime\
      node.exe
      npm.cmd
      ...
    app\
      package.json
      package-lock.json
      node_modules\
      scripts\
      src\
```

The builder:

- refuses inputs whose SHA-256 differs;
- accepts only Node 22 or 24;
- installs production dependencies with the bundled npm;
- creates a file manifest with hashes and source commit;
- produces a ZIP;
- does not sign the artifact.

The final ZIP and executables still require external code signing before public production distribution.

## Service installation

Extract the ZIP and run elevated PowerShell from the package directory:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\install-service.ps1
```

The installer:

- validates administrator elevation;
- validates WinSW, the application entrypoint and bundled Node runtime;
- accepts only Node 22 or 24;
- creates durable runtime directories;
- creates `config.env` only when absent;
- preserves existing configuration and product data;
- rejects non-loopback `HOST` values;
- validates the configured port;
- replaces an existing service registration idempotently;
- starts the service unless `-SkipStart` is supplied;
- polls `/health` and fails when the service is not healthy.

Post-install checks:

```powershell
Get-Service DePara
.\certify-service.ps1
```

## Service removal

Preserve data by default:

```powershell
.\uninstall-service.ps1
```

Purge data only when explicit:

```powershell
.\uninstall-service.ps1 -PurgeData
```

Removal is idempotent. When the WinSW package directory is unavailable, the script falls back to Windows service control APIs.

## Physical certification

Run after installation and again after a real reboot:

```powershell
.\certify-service.ps1
```

A passing report contains:

```json
{
  "certification": "WINDOWS_SERVICE_PASS"
}
```

The non-destructive certification verifies:

- 64-bit Windows;
- service registration and running state;
- service executable path;
- durable config and runtime directories;
- loopback bind and valid port;
- `/health` returns `OK`;
- `/api/status` returns `OPERATIONAL`.

CI starts the native launcher and validates PowerShell/XML syntax, but it does not install a real Windows service or replace reboot certification.

## Persistence contract

| Data | Default path |
|---|---|
| Runtime root | `%ProgramData%\DePara` |
| Config env | `%ProgramData%\DePara\config.env` |
| Product data | `%ProgramData%\DePara\data` |
| Logs | `%ProgramData%\DePara\logs` |
| Backups | `%ProgramData%\DePara\backups` |
| Temp | `%ProgramData%\DePara\temp` |
| Releases | `%ProgramData%\DePara\releases` |
| Current release | `%ProgramData%\DePara\current` |

Interactive development uses `%LOCALAPPDATA%\DePara` unless explicitly overridden.

## Filesystem and service-account contract

- All paths pass `validateSafePath`.
- Allowlist entries use `;` as the Windows delimiter.
- NTFS path comparison is case-insensitive and canonicalized.
- CI requires an NTFS junction escape test to pass.
- Prefer UNC paths rather than mapped drive letters in service mode.
- The service account must have explicit access to every allowed root.
- WinSW defaults to LocalSystem; network shares generally require a deliberate service identity and permissions.

Example:

```env
DEPARA_ALLOWED_PATHS=C:\Users;D:\Media;\\server\share
```

## Security invariants

- `HOST=127.0.0.1` is mandatory for the standard installer.
- The service does not interact with the user desktop.
- Native tray/fullscreen behavior belongs in a separate user-session shell.
- The Windows service cannot use the RP4 Git/PM2 updater.
- Installer, wrapper, runtime and update artifacts require signing before public distribution.
- Network exposure requires a separate security review.

## Production declaration gates

Do not claim Windows production certification while any required gate is open:

- final cross-platform CI is not green;
- physical Windows 11 service install/reboot/certification is incomplete;
- physical Windows 10 22H2 compatibility certification is incomplete;
- NTFS locked-file, removable-media and required UNC scenarios are incomplete;
- artifact code signing is incomplete;
- a required tray/fullscreen shell is absent;
- signed packaged update and rollback are absent.

Backend and service readiness must not be confused with completion of optional desktop-shell or updater products.
