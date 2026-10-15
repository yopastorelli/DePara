# WINDOWS_OPERATIONS_CONTRACT

## Runtime

- Plataforma suportada: Windows.
- Processo: launcher PowerShell independente, iniciado por `npm run start:windows`.
- Host padrão: `127.0.0.1`.
- Porta padrão: `3000`.
- Runtime persistente: `%USERPROFILE%\.depara`.
- O launcher cria um processo separado do Codex, oculto e com prioridade `BelowNormal`; não há supervisor PM2 ou systemd no contrato.

## Inicialização e parada

```powershell
Set-Location C:\DePara
npm run start:windows
```

Para parar, use `Ctrl+C` no terminal do processo. O encerramento limpa watchers, timers e o servidor HTTP.

## Verificação operacional

```powershell
Invoke-RestMethod http://127.0.0.1:3000/health
Invoke-RestMethod http://127.0.0.1:3000/api/status
Invoke-RestMethod http://127.0.0.1:3000/api/status/resources
```

O retorno de `/api/status` deve informar `platformTarget=windows` e `supervisor.supervisor=windows-process`.

## Atualizações

- `DEPARA_ENABLE_UPDATE_SCHEDULER` fica desligado por padrão.
- A inicialização do servidor não carrega o orquestrador de atualização; ele é inicializado somente quando uma rota de update é usada.
- O Windows não tenta chamar PM2, systemd ou comandos Linux.
- Quando um fluxo exigir reinício, o processo retorna `windows_restart_required`; revise o estado e reinicie manualmente.
- Não ative o scheduler em uma máquina lenta sem antes executar a auditoria de performance.

## Limites para máquina lenta

| Variável | Recomendação inicial | Efeito |
|---|---:|---|
| `MAX_CONCURRENT_OPERATIONS` | `1` | limita cópias/movimentações simultâneas |
| `MAX_RECURSION_DEPTH` | `10` | impede varreduras profundas acidentais |
| `DEPARA_IMAGE_PAGE_SIZE` | `250` | tamanho máximo normal de uma página do catálogo |
| `DEPARA_LOW_MEMORY_PAGE_SIZE` | `100` | reduz a página sob pressão de memória |
| `DEPARA_MEMORY_WARN_MB` | `1024` | entra em modo de contenção abaixo deste nível |
| `DEPARA_MEMORY_CRITICAL_MB` | `512` | recusa novas indexações abaixo deste nível |
| `DEPARA_MAX_RSS_MB` | `192` | recusa novas indexações se o RSS do DePara exceder o limite |
| `DEPARA_MAX_CATALOGS` | `2` | limita catálogos temporários simultâneos |
| `DEPARA_SLIDESHOW_PRELOAD` | `false` | não mantém imagem adicional em memória por padrão |
| `DEPARA_MAX_IMAGE_RESULTS` | `1000` | limita somente rotas legadas sem paginação |
| `LOG_LEVEL` | `warn` | reduz formatação e escrita de logs |
| `LOG_TO_CONSOLE` | `false` | evita saída contínua no terminal |
| `DEPARA_HTTP_LOGGING` | `false` | evita uma linha de log por requisição |

O slideshow usa catálogo temporário em disco e páginas sob demanda. O navegador mantém
somente a página corrente, e o catálogo é removido ao fechar o viewer ou após o TTL.
O endpoint `/api/status/resources` informa o estado `normal`, `warning` ou `critical`,
além dos limites efetivos.

## Convivência com o Codex

- O DePara não deve ser iniciado como processo filho persistente do terminal do Codex; use o launcher oficial.
- O launcher aplica `BelowNormal`, `--max-old-space-size=128`, uma operação simultânea e logs silenciosos.
- Em estado `warning`, novas páginas usam 100 itens e o pré-carregamento permanece desativado.
- Em estado `critical`, novas indexações retornam `503`; o slideshow já aberto continua com a página atual.
- O limite de 192 MB é um guard operacional para novas indexações, não uma garantia de consumo máximo do processo.

## Backup e rollback

- Dados mutáveis ficam em `%USERPROFILE%\.depara\data`.
- Backups ficam em `%USERPROFILE%\.depara\backups`.
- Antes de alterar limites ou ativar recursos opcionais, copie o diretório de runtime.
- Não use `git clean`, `git reset --hard` ou exclusões recursivas para resolver problemas operacionais.
