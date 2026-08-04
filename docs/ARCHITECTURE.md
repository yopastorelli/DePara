# ARCHITECTURE_CONTRACT

## System shape

```text
browser UI
  -> Express app (`src/main.js`)
    -> routes (`src/routes/*`)
      -> shared services/utilities
        -> runtime paths and persisted config
        -> safe filesystem authorization

shared core
  -> RP4 adapter: immutable release + PM2 + Linux launcher
  -> Windows adapter: native launcher + WinSW service + local package builder
```

The shared core has no production dependency on WSL, Bash, PM2, systemd, WinSW or Electron. Those belong to platform adapters.

## Configuration lifecycle

Direct execution precedence:

1. explicit process environment;
2. persisted `<runtime>/config.env`;
3. defaults.

Supervised production deliberately makes persisted config canonical for operational values:

- `ecosystem.config.js` loads `config.env` with override semantics before building PM2 environments;
- Windows service mode loads `config.env` with override semantics before loading `src/main.js`;
- platform safety markers are reasserted after the Windows service config load;
- WinSW XML does not define `HOST`, `PORT`, `NODE_ENV` or logging values.

This prevents inherited shell or system environment variables from silently changing a supervised port.

Default modes:

| Mode | Runtime root | Port | Supervisor |
|---|---|---:|---|
| generic source | `~/.depara` | 3000 | process |
| RP4 | `~/.depara` | 3001 | PM2 |
| Windows interactive | `%LOCALAPPDATA%\DePara` | 3000 | process |
| Windows service | `%ProgramData%\DePara` | 3001 | WinSW |

## Core components

| Domain | Source | Contract |
|---|---|---|
| HTTP lifecycle | `src/main.js` | directories, config, managers, listener, shutdown |
| Platform profile | `src/platform/runtimeProfile.js` | host detection and safe defaults |
| Runtime config | `src/utils/runtimeConfig.js` | dotenv parsing and explicit precedence control |
| Runtime paths | `src/utils/runtimePaths.js` | mutable-data and immutable-release locations |
| Product config | `src/utils/configStore.js` | durable application state |
| File operations | `src/utils/fileOperations.js`, `src/utils/fileOps/*` | Node-only operations and path authorization |
| Update orchestration | `src/services/updateOrchestrator.js` | RP4 immutable activation/rollback |
| RP4 bootstrap | `bootstrap-runtime-release.js` | build release from Git commit and active wrapper |
| RP4 supervisor | `ecosystem.config.js` | PM2 executes active wrapper using persisted port |
| RP4 installation | `install-raspberry.sh` | verified Node, PM2 registration and health gate |
| Windows launcher | `scripts/start-windows.js` | native interactive/service startup |
| Windows package | `packaging/windows/build-package.ps1` | checksum-gated local bundle assembly |
| Windows service | `packaging/windows/DeParaService.xml`, lifecycle scripts | WinSW registration, data preservation and health gate |
| Hardware certification | `scripts/certify-rp4.sh`, `packaging/windows/certify-service.ps1` | non-destructive machine checks |

## Startup sequences

### RP4

1. Installer creates or preserves `~/.depara/config.env`.
2. Bootstrap creates `~/.depara/releases/<commit>` and `~/.depara/current`.
3. PM2 ecosystem reloads persisted config canonically.
4. PM2 executes `~/.depara/current/src/main.js`.
5. Wrapper loads production dependencies from the immutable release.
6. Express initializes mutable runtime directories and managers.
7. Health/status checks must pass before installation succeeds.

### Windows interactive

1. Launcher determines `%LOCALAPPDATA%\DePara` unless explicitly overridden.
2. It defers network defaults.
3. `src/main.js` loads explicit environment, then persisted config, then defaults.
4. Express starts natively.

### Windows service

1. WinSW supplies only package entrypoint, persistent paths and platform safety markers.
2. Launcher reloads `config.env` canonically for service operation.
3. Scheduler/systemd safety markers are forced.
4. Express starts with bundled Node.
5. Installer polls health before reporting success.

## Persistence

Mutable state never belongs to a release directory.

RP4 defaults:

- `~/.depara/data`
- `~/.depara/logs`
- `~/.depara/backups`
- `~/.depara/temp`
- `~/.depara/releases/<commit>`
- `~/.depara/current`

Windows service defaults:

- `%ProgramData%\DePara\data`
- `%ProgramData%\DePara\logs`
- `%ProgramData%\DePara\backups`
- `%ProgramData%\DePara\temp`
- reserved release/current directories for future packaged updates.

Install/reinstall/uninstall preserve persisted data unless purge is explicit.

## Filesystem authorization

`validateSafePath` is mandatory for user-provided filesystem paths.

It:

- rejects empty/null/traversal inputs;
- resolves candidates;
- canonicalizes existing paths;
- validates nearest existing parent for new targets;
- compares against allowed bases;
- uses case-insensitive comparable paths on Windows;
- blocks symlink and NTFS junction escapes.

`DEPARA_ALLOWED_PATHS` replaces defaults and uses the host delimiter (`:` on Linux, `;` on Windows).

Windows services should use UNC paths rather than mapped drives. Access depends on the WinSW service identity and share/NTFS permissions.

## Updates

RP4 updater:

- stages a clean immutable release;
- installs target dependencies;
- switches the active wrapper;
- restarts PM2;
- validates health;
- rolls back on failure.

Windows:

- RP4 updater is disabled;
- package installation is currently a deliberate local/release operation;
- future auto-update must use signed prebuilt artifacts, service restart, health validation and rollback;
- end-user hosts must not run Git or npm for an update.

## Packaging boundary

`build-package.ps1` receives predownloaded Node and WinSW binaries plus mandatory SHA-256 values. It accepts Node 22/24, installs production dependencies with bundled npm, generates a per-file manifest and creates a ZIP locally.

Code signing is outside the repository builder and remains a release gate for public distribution.

## Desktop/session boundary

The Windows service is headless and cannot own tray/fullscreen UI. A future user-session shell may call the loopback API but remains a separate deliverable. RP4 browser/desktop launcher behavior remains independent.

## Verification boundary

Hosted CI proves:

- Ubuntu/Windows source behavior;
- Node 22/24 unit compatibility;
- Windows/Linux smoke behavior;
- native Windows launcher and persisted-config precedence;
- NTFS junction escape protection;
- PowerShell/XML syntax;
- browser E2E;
- dependency audit.

Hosted CI cannot prove physical boot restoration or a real Windows service lifecycle. Physical promotion requires the repository certifiers after installation and reboot.
