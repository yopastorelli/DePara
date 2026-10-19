# Contrato de instalação Windows para agentes de IA

DOC_AUDIENCE=AI_development_agents
CANONICAL_INSTALLER=install.ps1

## Pré-requisitos

Sincronização local não exige dependências adicionais. Após instalar, configurar manualmente pastas existentes e revisar as bases em `DEPARA_ALLOWED_PATHS`. Não copiar jobs ativos de outra máquina; importar pausados e seguir `LOCAL-SYNC.md`.

| Requisito | Mínimo | Motivo |
|---|---:|---|
| Windows | 10/11 x64 | plataforma suportada |
| Node.js | `18.15.0` | runtime do servidor |
| npm | `9.0.0` | instalação determinística pelo lockfile |
| Git for Windows | versão compatível | clone e release imutável |
| `tar` | disponível no `PATH` | extração do release criado por `git archive` |
| Chromium | somente para E2E | validação automatizada da UI |

Não instale Python, Docker, PM2, systemd ou componentes Raspberry Pi para este projeto.

## Instalação reproduzível

No PowerShell:

```powershell
git clone https://github.com/yopastorelli/DePara.git C:\DePara
Set-Location C:\DePara
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\install.ps1 -Production -CreateShortcut -Start
npm run doctor:windows
```

O instalador executa, nesta ordem:

1. valida Node.js, npm, Git e `tar`;
2. cria os diretórios operacionais em `%USERPROFILE%\.depara`;
3. executa `npm ci` ou `npm ci --omit=dev` com `-Production`;
4. cria `%USERPROFILE%\.depara\config.env` somente se ele não existir;
5. executa `bootstrap-runtime-release.js` para criar o release imutável do commit atual;
6. cria atalhos na Área de Trabalho e no Menu Iniciar quando `-CreateShortcut` é informado;
7. inicia e diagnostica o processo quando `-Start` é informado.

O script não sobrescreve configuração, dados, backups ou releases já existentes.

Não há um segundo procedimento de instalação documentado. Use o PowerShell e `install.ps1` para manter a execução determinística entre máquinas.

## Modos de instalação

| Comando | Uso |
|---|---|
| `.\install.ps1 -Production -CreateShortcut -Start` | produção local: instala, publica, cria atalhos e inicia |
| `.\install.ps1 -Production` | somente runtime de produção |
| `.\install.ps1 -CreateShortcut -Start` | desenvolvimento com dependências de desenvolvimento |
| `npm ci` | reinstalação determinística no checkout |
| `npm run deploy:windows` | prepara o release do commit atual |
| `npm run shortcut:windows` | cria ou atualiza `DePara.lnk` na Área de Trabalho e no Menu Iniciar |
| `npm run doctor:windows` | valida processo, release e health |

## Primeiro acesso e configuração

A execução de `DePara.lnk` na Área de Trabalho ou no Menu Iniciar chama o launcher, inicia o processo local se necessário e abre a UI com `Start-Process`, respeitando o navegador padrão registrado no Windows de destino. O tutorial não assume Edge, Chrome ou outro navegador específico. A fixação adicional na barra de tarefas depende do Shell do Windows e não é automatizada pelo instalador para esse launcher local; quando a opção for oferecida pela edição do Windows, use o menu contextual do atalho.

URLs padrão:

- UI: `http://127.0.0.1:3000/ui`
- Health: `http://127.0.0.1:3000/health`
- Status: `http://127.0.0.1:3000/api/status`
- Recursos: `http://127.0.0.1:3000/api/status/resources`
- API: `http://127.0.0.1:3000/api/docs`

O processo local é iniciado com prioridade `BelowNormal`, `NODE_OPTIONS=--max-old-space-size=128`, `MAX_CONCURRENT_OPERATIONS=1`, logs silenciosos e pré-carregamento do slideshow desligado.

O arquivo `%USERPROFILE%\.depara\config.env` é a configuração de ambiente. O arquivo `%USERPROFILE%\.depara\data\depara-config.json` guarda a configuração funcional da UI. Para limitar o filesystem ao necessário, defina antes de iniciar:

```powershell
$env:DEPARA_ALLOWED_PATHS = 'C:\Users\<usuario>\Pictures;C:\Dados'
```

Bases são separadas por `;` no Windows. Não use `DEPARA_DISABLE_RATE_LIMITS=true` fora de testes controlados.

Exemplo de configuração funcional do slideshow sem enviar arquivos para fora da máquina:

```powershell
$body = @{
    config = @{
        slideshowSelectedPath = 'C:\Users\<usuario>\Pictures'
        slideshowConfig = @{
            interval = 10
            preload = $false
            recursive = $true
        }
    }
} | ConvertTo-Json -Depth 5
Invoke-RestMethod http://127.0.0.1:3000/api/config -Method Post -ContentType 'application/json' -Body $body
```

## Operação

```powershell
npm run start:windows
npm run stop:windows
npm run doctor:windows
```

O launcher é idempotente: se o processo do DePara já estiver ativo, ele não cria uma segunda instância. Para abrir a UI reutilizando o processo existente, execute `.\scripts\open-depara.ps1`.

## Atualização do checkout e do runtime

```powershell
git pull --ff-only
npm ci
npm run lint
npm run test:unit
npm run test:smoke
npm run test:e2e
npm audit --audit-level=high
npm run deploy:windows
npm run stop:windows
npm run start:windows
npm run doctor:windows
```

O scheduler de atualização permanece desativado. Rotas de update preexistentes respondem `410 Gone`; não use fluxos antigos.

## Máquina com poucos recursos

O perfil `codex-coexistence` já aplica:

- uma operação de arquivo por vez;
- catálogo de imagens em JSONL no disco;
- paginação normal de `250` e paginação de contenção de `100`;
- contenção quando há menos de `1024 MB` livres e bloqueio de nova indexação abaixo de `512 MB`;
- RSS máximo operacional de `192 MB` para novas indexações;
- no máximo dois catálogos temporários;
- pré-carregamento desligado;
- logs HTTP desligados.

Não aumente concorrência, página ou preload para compensar lentidão antes de medir `npm run perf:audit -- --profile=small`.

## Persistência e reinstalação

| Dado | Caminho padrão |
|---|---|
| Ambiente | `%USERPROFILE%\.depara\config.env` |
| Configuração funcional | `%USERPROFILE%\.depara\data\depara-config.json` |
| Pastas e agendamentos; workflows de compatibilidade | `%USERPROFILE%\.depara\data` |
| Journals de operações | `%USERPROFILE%\.depara\data\file-operations` |
| Journal de importação operacional | `%USERPROFILE%\.depara\data\config-import-journal.json` |
| Quarentena restaurável | `%USERPROFILE%\.depara\quarantine` |
| Logs | `%USERPROFILE%\.depara\logs` |
| Backups | `%USERPROFILE%\.depara\backups` |
| Releases | `%USERPROFILE%\.depara\releases` |
| Release ativo | `%USERPROFILE%\.depara\current` |

Para migrar para outra máquina, exporte a configuração operacional pela UI ou por `GET /api/config/export`, revise os caminhos e importe depois da instalação. Não copie tokens, logs ou dados pessoais sem necessidade.

Exclusões e substituições intencionais não removem imediatamente o conteúdo: o DePara move os arquivos para a quarentena e registra a operação no journal. Antes de limpar esse estado, liste `GET /api/files/recovery` e confirme que nenhuma restauração é necessária.
