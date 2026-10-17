# DePara — contrato para agentes de desenvolvimento com IA

DOC_FORMAT=agent_contract
DOC_AUDIENCE=AI_development_agents
PLATFORM_CONTRACT=Windows_only
CANONICAL_ENTRYPOINT=docs/README.md
LAST_AUDIT_SCOPE=full_application_installation_runtime_documentation
LAST_AUDIT_DATE=2026-10-17

## Missão

Manter o DePara como uma aplicação local-first para Windows, com automação de arquivos, slideshow de imagens, persistência determinística, limites explícitos de filesystem, baixo consumo de memória e execução verificável.

Este diretório é a fonte normativa para agentes. Não introduza instruções genéricas de Python, Linux, Raspberry Pi, Docker, PM2 ou systemd: nenhuma delas pertence ao produto.

## Limites obrigatórios

- Plataforma suportada: Windows 10/11 x64.
- Runtime: Node.js `>=18.15.0`, npm `>=9.0.0`, Git for Windows e `tar` disponível no `PATH`.
- Rede: `HOST=127.0.0.1` por padrão; não habilite LAN sem uma decisão explícita de rede.
- Processo: use o launcher `npm run start:windows`; ele é independente do terminal/Codex.
- Atualizações: release imutável, reinício manual e scheduler desativado por padrão.
- Memória: preserve `MAX_CONCURRENT_OPERATIONS=1`, paginação, catálogo em disco e `DEPARA_SLIDESHOW_PRELOAD=false` no perfil de coexistência.
- Segurança: todo caminho recebido de usuário passa por `validateSafePath`; não use shell para copiar, mover, apagar ou alterar permissões.
- Dados mutáveis pertencem ao runtime `%USERPROFILE%\.depara`, nunca ao release ou ao repositório.
- Não registre, imprima, versione ou peça credenciais, tokens, chaves ou conteúdo privado.

## Ordem de leitura do agente

1. `README.md`
2. `docs/README.md`
3. `docs/AUDIT-REPORT.md`
4. `docs/ARCHITECTURE.md`
5. `docs/API.md`
6. `docs/INSTALLATION.md`
7. `docs/TESTING.md`
8. `docs/WINDOWS-OPS.md`
9. `docs/PERFORMANCE-AUDIT.md`
10. `docs/TROUBLESHOOTING.md`
11. Os arquivos-fonte e testes diretamente relacionados à alteração.

Para alterações da interface, leia também `docs/UI-UX-AUDIT.md`; esse contrato inclui layout de imagens grandes, foco, teclado, cursor, fullscreen e funcionamento sem fontes externas.

## Protocolo de execução do agente

### Antes de alterar

```powershell
git status --short --branch
git remote -v
git log --oneline -5
```

Leia as instruções aplicáveis, preserve alterações locais e não use `git reset --hard`, `git clean`, sobrescrita de arquivos ou stash automático como atalho.

### Ao alterar

- Corrija a causa raiz e mantenha o escopo mínimo.
- Se uma rota mudar, atualize `docs/API.md`, testes de smoke/E2E e os chamadores da UI.
- Se o runtime mudar, atualize `docs/INSTALLATION.md`, `docs/WINDOWS-OPS.md`, `docs/ARCHITECTURE.md` e `env.example`.
- Se o teste ou o procedimento de instalação mudar, atualize `docs/TESTING.md`.
- Remova documentação obsoleta em vez de mantê-la como segunda fonte de verdade.
- Não reintroduza endpoints, launchers ou código de compatibilidade removidos.

### Depois de alterar

```powershell
npm run lint
npm run test:unit
npm run test:smoke
npm run test:e2e
npm audit --audit-level=high
```

Para uma máquina muito lenta, o Jest aceita uma margem maior sem mudar o produto:

```powershell
npm run test:unit -- --testTimeout=60000
```

O resultado esperado é lint com código `0`, todos os testes aprovados e auditoria sem vulnerabilidades de nível alto.

## Instalação canônica em outra máquina

```powershell
git clone https://github.com/yopastorelli/DePara.git C:\DePara
Set-Location C:\DePara
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\install.ps1 -Production -CreateShortcut -Start
npm run doctor:windows
```

O instalador valida Node/npm/Git/tar, executa `npm ci`, cria o runtime, prepara o release imutável, cria o atalho quando solicitado, inicia o processo oculto e valida o health check.

Sem instalação de produção, use `.\install.ps1 -CreateShortcut -Start`. O `install.bat` é apenas um wrapper para o mesmo instalador PowerShell.

## Operação canônica

```powershell
npm run start:windows
npm run doctor:windows
npm run stop:windows
npm run deploy:windows
npm run shortcut:windows
```

URLs padrão:

- UI: `http://127.0.0.1:3000/ui`
- Health: `http://127.0.0.1:3000/health`
- Status: `http://127.0.0.1:3000/api/status`
- Recursos: `http://127.0.0.1:3000/api/status/resources`
- Catálogo da API: `http://127.0.0.1:3000/api/docs`

## Configuração mínima

O arquivo persistente é `%USERPROFILE%\.depara\config.env`. O instalador não substitui um arquivo existente. Para reduzir o escopo de arquivos, prefira bases explícitas:

```powershell
$env:DEPARA_ALLOWED_PATHS = 'C:\Users\<usuario>\Pictures;C:\Dados'
```

A configuração funcional de slideshow fica em `%USERPROFILE%\.depara\data\depara-config.json` e pode ser alterada pela UI ou por `POST /api/config`. Não copie o runtime inteiro para outro computador sem revisar caminhos, permissões e dados pessoais.

## Gates de release

Um release só está pronto quando:

1. `git status` está limpo e a revisão está identificada.
2. `npm ci` foi executado a partir do lockfile.
3. Lint, unit, smoke, E2E e auditoria de dependências passaram.
4. `node bootstrap-runtime-release.js` aponta o runtime para o commit validado.
5. Existe exatamente uma instância do processo Windows.
6. `/health`, `/api/status` e `/api/status/resources` respondem.
7. Os atalhos da Área de Trabalho e do Menu Iniciar, se solicitados, apontam para `scripts/open-depara.ps1` e abrem a UI no navegador padrão do Windows.
8. Nenhum dado mutável, log, backup, resultado de teste ou credencial foi commitado.

## Compatibilidade removida

- Linux, macOS, Raspberry Pi, PM2, systemd e integrações `.desktop` estão fora do contrato.
- As rotas de update antigas existem somente para responder `410 Gone`; novos clientes usam exclusivamente `/api/update/auto/*`.
- Rotas antigas de listagem de imagens existem somente como compatibilidade limitada; novos clientes usam `POST /api/files/list-images` com paginação.
- Não adicione novos usos para superfícies legadas. Migrações de dados existentes são somente de leitura/cópia para o runtime canônico e devem ser removidas quando não houver consumidores.

## Saídas que nunca entram no Git

`node_modules/`, `coverage/`, `test-results/`, `playwright-report/`, `performance-results/`, `logs/`, `backups/`, `data/`, `src/data/`, `temp/`, `.env*` e o runtime `%USERPROFILE%\.depara`.
