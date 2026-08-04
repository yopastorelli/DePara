# WINDOWS_OPERATIONS_CONTRACT

PLATFORM_PRIMARY=Windows 11 x64
PLATFORM_COMPATIBILITY=Windows 10 22H2 x64
RUNTIME_MODE=native
WSL_REQUIRED=false
SERVICE_SUPERVISOR=WinSW
DEFAULT_BIND_HOST=127.0.0.1
DEFAULT_SERVICE_PORT=3001
DEFAULT_SERVICE_RUNTIME_ROOT=%ProgramData%\DePara
DEFAULT_INTERACTIVE_RUNTIME_ROOT=%LOCALAPPDATA%\DePara

## Scope of this foundation

This contract establishes a native Windows backend without changing the Raspberry Pi 4 production contract.

Included:

- Native Node.js/Express execution on Windows.
- Platform-specific runtime defaults.
- Windows service template using WinSW.
- PowerShell installation and removal scripts.
- Windows/Linux CI coverage.
- Browser UI at `http://127.0.0.1:<PORT>/ui`.

Not included yet:

- Electron tray shell.
- Native fullscreen/screensaver window control.
- Signed installer artifact.
- Signed packaged-release auto-update and rollback.
- Production certification on physical Windows 10 and Windows 11 hosts.

The RP4 remains supervised by PM2 and keeps its immutable Git release workflow.

## Source execution

Requirements:

- Windows 10 or Windows 11 x64.
- Node.js and npm compatible with `package.json`.
- Git only when working from a repository clone.

Commands in PowerShell:

```powershell
npm ci
npm run lint
npm run test:platform
npm run test:unit
npm run test:smoke
npm run start:windows
```

Validation:

```powershell
Invoke-RestMethod http://127.0.0.1:3000/health
Start-Process http://127.0.0.1:3000/ui
```

Interactive execution defaults to `%LOCALAPPDATA%\DePara` unless `DEPARA_RUNTIME_ROOT` is explicitly configured.

## Service artifact layout

The packaging pipeline must produce this layout before `install-service.ps1` is executed:

```text
windows-dist\
  DeParaService.exe
  DeParaService.xml
  install-service.ps1
  uninstall-service.ps1
  runtime\
    node.exe
  app\
    package.json
    node_modules\
    scripts\start-windows.js
    src\
```

`DeParaService.exe` is the WinSW executable renamed to match `DeParaService.xml`.

The final distribution must bundle a pinned Node.js runtime and production dependencies. End users must not need global Node.js, npm, Git, PM2, Bash, WSL or Linux utilities.

## Service installation

Run an elevated PowerShell from the packaged directory:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\install-service.ps1
```

Post-install assertions:

```powershell
Get-Service DePara
Invoke-RestMethod http://127.0.0.1:3001/health
Invoke-RestMethod http://127.0.0.1:3001/api/status
```

The installation script:

- Refuses non-administrator execution.
- Validates the service wrapper, bundled Node runtime and application entrypoint.
- Creates durable runtime directories.
- Creates `config.env` only when it does not already exist.
- Installs the service.
- Starts it unless `-SkipStart` is supplied.

## Service removal

Preserve product data by default:

```powershell
.\uninstall-service.ps1
```

Remove service and durable data only when explicitly required:

```powershell
.\uninstall-service.ps1 -PurgeData
```

## Persistence contract

Service runtime:

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

Interactive development runtime:

- `%LOCALAPPDATA%\DePara` by default.
- Explicit environment variables always override platform defaults.

## Filesystem contract

- Use Node.js filesystem APIs only.
- All user paths must pass `validateSafePath`.
- Windows allowlist entries use `;` as delimiter.
- Prefer UNC paths such as `\\server\share` for service-accessed network storage.
- Do not depend on mapped drive letters in service mode.
- Test NTFS junctions, symlinks, locked files, removable media and long paths.

Example:

```env
DEPARA_ALLOWED_PATHS=C:\Users;D:\Media;\\server\share
```

The account running the service must have explicit filesystem permissions for every allowed root.

## Security invariants

- `HOST=127.0.0.1` is mandatory by default.
- `HOST=0.0.0.0` requires a separate network-security review.
- The service must not display UI or interact directly with a user desktop session.
- Native tray/window behavior belongs in a separate user-session shell.
- Installer and update artifacts must be signed before production distribution.
- The Windows packaged updater must not use the RP4 Git/PM2 update path.
- Until the packaged updater exists, `DEPARA_DISABLE_UPDATE_SCHEDULER=true` is mandatory on Windows.

## Cross-platform change policy

A change to shared backend code must pass:

```text
Ubuntu x64 / supported Node versions
Windows x64 / supported Node versions
Raspberry Pi 4 physical release gate
```

A Windows-specific change must not alter:

- PM2 as RP4 supervisor.
- `~/.depara` as the RP4 runtime root.
- RP4 immutable release activation and rollback.
- `start-depara.sh` launcher behavior.

## Production blockers

Do not declare Windows production-ready while any item below is open:

- Windows matrix CI is not green.
- Physical Windows 10 and Windows 11 validation is incomplete.
- Service install, reboot, health, stop and uninstall are not proven.
- Installer and binaries are unsigned.
- Native packaged update with rollback is absent.
- Tray/screensaver functionality required by the product is absent.
- File operations on NTFS, removable media and UNC shares are unverified.

## Support posture

- Windows 11 x64 is the primary Windows target.
- Windows 10 22H2 x64 is a compatibility target and must have an explicit physical certification gate.
- Windows 32-bit is unsupported.
- WSL is not part of the production runtime contract.
