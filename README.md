# DePara

DOC_AUDIENCE=AI_development_agents
CANONICAL_DOC_ENTRYPOINT=AGENTS.md
DETAILED_DOC_ENTRYPOINT=docs/README.md

DePara é uma aplicação local-first de automação de arquivos e slideshow, exclusiva para Windows. A interface web local é servida por uma API Express e usa o filesystem da máquina somente dentro das regras de segurança do projeto.

## Instalação reproduzível em máquina nova

Requisitos: Windows 10/11 x64, Node.js `>=18.15.0`, npm `>=9.0.0`, Git for Windows e `tar` no `PATH`.

```powershell
git clone https://github.com/yopastorelli/DePara.git C:\DePara
Set-Location C:\DePara
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\install.ps1 -Production -CreateShortcut -Start
npm run doctor:windows
```

Após o diagnóstico com código `0`, a UI está disponível em `http://127.0.0.1:3000/ui`. Os atalhos `DePara` da Área de Trabalho e do Menu Iniciar iniciam o serviço local se necessário e abrem a UI no navegador padrão do Windows. O processo é local, oculto, separado do Codex e configurado para coexistir com pouca memória.

## Desenvolvimento e release

```powershell
npm ci
npm run lint
npm run test:unit
npm run test:smoke
npm run test:e2e
npm audit --audit-level=high
```

Para publicar o commit validado no runtime Windows:

```powershell
npm run deploy:windows
npm run stop:windows
npm run start:windows
npm run doctor:windows
```

## Contrato operacional

- UI: `http://127.0.0.1:3000/ui`
- Health: `http://127.0.0.1:3000/health`
- API: `http://127.0.0.1:3000/api`
- Documentação da API: `http://127.0.0.1:3000/api/docs`
- Runtime mutável: `%USERPROFILE%\.depara`
- Configuração de ambiente: `%USERPROFILE%\.depara\config.env`
- Release ativo: `%USERPROFILE%\.depara\current`

O host padrão é `127.0.0.1`. Não defina `HOST=0.0.0.0` sem uma decisão explícita de rede e firewall. O auto-update fica desativado por padrão e exige reinício manual.

## Documentação normativa para agentes

Leia `AGENTS.md` primeiro. Depois leia `docs/README.md`, que define limites, ordem de leitura, procedimento de alteração, gates de validação, instalação, configuração e exclusões de legado. Os contratos específicos ficam em `docs/AUDIT-REPORT.md`, `docs/ARCHITECTURE.md`, `docs/API.md`, `docs/INSTALLATION.md`, `docs/TESTING.md`, `docs/WINDOWS-OPS.md`, `docs/PERFORMANCE-AUDIT.md` e `docs/TROUBLESHOOTING.md`. Estes arquivos são instruções para agentes de desenvolvimento, não um manual operacional alternativo.
