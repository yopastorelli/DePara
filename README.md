# DePara

AI_DOCUMENTATION_TARGET=agents
HUMAN_ONBOARDING_TARGET=false
CANONICAL_DOC_ENTRYPOINT=docs/README.md

## Product contract

DePara is a local-first file automation and image-slideshow service with one shared Node.js/Express core and explicit adapters for Raspberry Pi 4 and native Windows 10/11 x64.

Primary jobs:

- configure folders and slideshow state;
- execute copy, move and delete operations;
- persist and run scheduled operations;
- browse folders and images;
- export/import operational state;
- run immutable releases under PM2 on RP4;
- run the backend natively on Windows without WSL;
- run as a Windows service through WinSW.

## Platform readiness

| Platform | Runtime | Supervisor | Repository readiness | Physical gate |
|---|---|---|---|---|
| Raspberry Pi 4 ARM64/ARMv7 | Native Linux | PM2 | installer, immutable release, health gate and certifier implemented | run `scripts/certify-rp4.sh` after install and reboot |
| Windows 11 x64 | Native Windows | WinSW | launcher, service lifecycle, local packager, health gate and certifier implemented | install/reboot and run `certify-service.ps1` |
| Windows 10 22H2 x64 | Native Windows | WinSW | compatibility contract implemented | repeat physical service certification |
| WSL | Linux compatibility | none | diagnostics only | not a production target |

Hosted CI validates source/runtime behavior but cannot certify a physical boot or a real Windows service installation.

Windows tray/fullscreen shell, public code signing and signed packaged auto-update are independent product/release gates. They are not required for the headless backend/service to run, but they remain required before claiming those specific capabilities.

## Runtime configuration

Precedence for direct execution:

1. explicit process environment;
2. persisted `<runtime>/config.env`;
3. defaults.

For supervised production, persisted config is canonical for operational values so inherited shell/system variables cannot silently change the listening port.

| Mode | Runtime root | Default port |
|---|---|---:|
| generic source | `~/.depara` | 3000 |
| RP4 PM2 | `~/.depara` | 3001 |
| Windows interactive | `%LOCALAPPDATA%\DePara` | 3000 |
| Windows service | `%ProgramData%\DePara` | 3001 |

Default host is `127.0.0.1`. Standard installers reject non-loopback exposure.

## Source of truth

- application metadata/scripts/dependencies: `package.json`;
- Express lifecycle: `src/main.js`;
- platform profile: `src/platform/runtimeProfile.js`;
- operational config: `src/utils/runtimeConfig.js`;
- runtime paths: `src/utils/runtimePaths.js`;
- file safety: `src/utils/fileOperations.js`;
- RP4 immutable bootstrap: `bootstrap-runtime-release.js`;
- RP4 PM2 model: `ecosystem.config.js`;
- RP4 installer/certifier: `install-raspberry.sh`, `scripts/certify-rp4.sh`;
- Windows launcher: `scripts/start-windows.js`;
- Windows package/service/certifier: `packaging/windows/`;
- operating contracts: `docs/`.

## Automated release gate

```bash
npm ci
npm run test:all
```

Equivalent explicit sequence:

```bash
npm run lint
npm run test:unit
npm run test:smoke
npm run test:e2e
npm audit --audit-level=high
```

Cross-platform changes require the green GitHub Actions matrix on Ubuntu and Windows with Node 22/24. The workflow runs once per PR commit, cancels obsolete runs, ignores documentation-only changes and enforces job timeouts.

## Physical promotion gates

RP4, after installation and again after reboot:

```bash
./scripts/certify-rp4.sh
```

Required marker: `RP4_PASS`.

Windows service, after installation and again after reboot:

```powershell
.\certify-service.ps1
```

Required marker: `WINDOWS_SERVICE_PASS`.

## Non-negotiable invariants

- RP4 production uses PM2 and executes `~/.depara/current/src/main.js`.
- Mutable state stays outside immutable releases.
- `start-depara.sh` validates health and opens UI; it does not start, update or replace the backend.
- Windows service uses bundled Node and does not depend on WSL, PM2, Bash or Git.
- The RP4 Git/PM2 updater is disabled on Windows.
- All user filesystem paths pass `validateSafePath`.
- Windows allowlist authorization canonicalizes case and reparse targets.
- Generated runtime, E2E and unsigned packaging artifacts are not committed.

## Documentation read order

1. [docs/README.md](docs/README.md)
2. [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
3. [docs/API.md](docs/API.md)
4. [docs/INSTALLATION.md](docs/INSTALLATION.md)
5. [docs/TESTING.md](docs/TESTING.md)
6. [docs/RP4-OPS.md](docs/RP4-OPS.md)
7. [docs/WINDOWS-OPS.md](docs/WINDOWS-OPS.md)
8. [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)
