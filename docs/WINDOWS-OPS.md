# Contrato operacional Windows

DOC_AUDIENCE=AI_development_agents
PLATFORM_CONTRACT=Windows_only

## Processo e limites

Sincronização local: seguir `LOCAL-SYNC.md`. Histórico fica no HD de destino; nunca removê-lo em limpeza do runtime. Jobs não são criados automaticamente nem ativados por importação.

- Plataforma: Windows 10/11 x64.
- Processo oficial: `scripts/start-windows-coexistence.ps1`.
- Host padrão: `127.0.0.1`.
- Porta padrão: `3000`.
- Runtime: `%USERPROFILE%\.depara` ou `DEPARA_RUNTIME_ROOT`.
- O launcher usa processo separado, prioridade `BelowNormal`, heap Node limitada, concorrência `1` e logs silenciosos.
- O launcher não usa PM2, systemd, WSL, Raspberry Pi ou supervisor Linux.

## Comandos oficiais

```powershell
npm run start:windows
npm run stop:windows
npm run doctor:windows
npm run shortcut:windows
```

O início é idempotente. O encerramento procura somente processos Node cujo comando aponta para o runtime ou para o `src/main.js` deste checkout; não encerra outros processos Node. Antes do último recurso forçado, `stop-windows-coexistence.ps1` envia um pedido autenticado ao endpoint local de encerramento.

Não use `Ctrl+C` como procedimento principal: o launcher roda oculto e separado do terminal. Use `npm run stop:windows` ou `scripts/stop-windows-coexistence.ps1`.

## Health e diagnóstico

```powershell
Invoke-RestMethod http://127.0.0.1:3000/health
Invoke-RestMethod http://127.0.0.1:3000/api/status
Invoke-RestMethod http://127.0.0.1:3000/api/status/resources
npm run doctor:windows
```

O diagnóstico exige:

- configuração persistente existente;
- release ativo existente;
- no máximo uma instância do processo;
- health `OK` quando `-RequireRunning` está ativo.

## Release e atualização

```powershell
npm run deploy:windows
npm run stop:windows
npm run start:windows
npm run doctor:windows
```

`bootstrap-runtime-release.js` grava releases imutáveis por commit em `%USERPROFILE%\.depara\releases` e aponta `%USERPROFILE%\.depara\current` para o release ativo. O processo em execução não deve ser considerado atualizado sem conferir `current/release.json` e `/health`.

O auto-update é opt-in e o scheduler fica desativado por padrão. O Windows não deve chamar PM2, systemd ou comandos Linux. Rotas antigas de update respondem `410 Gone`.

### Atualização automática autorizada

Após autorização do usuário, definir em `%USERPROFILE%\.depara\config.env`:

```dotenv
DEPARA_ENABLE_UPDATE_SCHEDULER=true
DEPARA_DISABLE_UPDATE_SCHEDULER=false
DEPARA_DISABLE_UPDATE_SIDE_EFFECTS=false
DEPARA_UPDATE_SOURCE_ROOT=C:\DePara
```

Reiniciar pelo launcher canônico e configurar:

```powershell
$body = @{ enabled = $true; autoApply = $true; checkIntervalMinutes = 60 } | ConvertTo-Json
Invoke-RestMethod http://127.0.0.1:3000/api/update/auto/config -Method Put -ContentType application/json -Body $body
Invoke-RestMethod http://127.0.0.1:3000/api/update/auto/trigger -Method Post
Invoke-RestMethod http://127.0.0.1:3000/api/update/auto/status
```

Confirmar `config.enabled`, `config.autoApply`, `runtime.scheduler.running` e `environmentEnabled`. O timer só existe enquanto o DePara estiver aberto; não liga a máquina nem funciona com o aplicativo encerrado. A primeira consulta ocorre no intervalo configurado; o trigger acima antecipa a validação. Requer rede, Git/npm/tar e acesso a `origin/main`, sem prompts interativos. Não criar tarefa agendada do Windows ou mudar credenciais automaticamente.

O checkout não é atualizado nem mesclado; commits remotos são exportados em releases separados. Alterações rastreadas locais bloqueiam aplicação. Falha de `npm ci` preserva o release ativo, sem fallback que altere o lockfile. Com operações de arquivos ativas, a troca é adiada para outro ciclo. O helper transitório usa encerramento autenticado sem parada forçada, espera o PID antigo sair, troca o release, inicia pelo launcher e valida `/health.releaseCommit`. Se a inicialização falhar, tenta restaurar o release anterior; se um processo não puder parar seguramente, registra bloqueio em vez de iniciar outra instância. Histórico em `data/update-history.log`, handoff em `data/update-handoff.json` e lock próprio em `data/update-handoff.lock`; não remover um lock cujo PID ainda esteja vivo.

Uma revisão rejeitada por rollback não é repetida automaticamente; publicar uma correção com novo commit ou investigar antes de limpar `state.rejectedCommit`. Durante testes, usar runtime/porta temporários e manter efeitos desativados fora do ensaio isolado. O consumo do helper e de npm/PowerShell é transitório e não está incluído no RSS do servidor.

## Recursos e coexistência com o Codex

| Estado | Comportamento |
|---|---|
| `normal` | usa a página normal configurada |
| `warning` | reduz a página para `DEPARA_LOW_MEMORY_PAGE_SIZE` e mantém preload desligado |
| `critical` | recusa novas indexações com `503`; não apaga o catálogo já aberto |

O endpoint `/api/status/resources` é a fonte de verdade para pressão de memória. O limite de `DEPARA_MAX_RSS_MB` é um guard para iniciar novas indexações, não uma garantia de RSS máximo absoluto.

Em máquina compartilhada com Codex, preserve `MAX_CONCURRENT_OPERATIONS=1`, `DEPARA_MAX_CATALOGS=2`, `DEPARA_SLIDESHOW_PRELOAD=false`, `LOG_LEVEL=warn` e `DEPARA_HTTP_LOGGING=false`.

## Backup e reversibilidade

- Dados mutáveis: `%USERPROFILE%\.depara\data`.
- Backups: `%USERPROFILE%\.depara\backups`.
- Journal: `%USERPROFILE%\.depara\data\file-operations\<operationId>`.
- Journal de importação operacional: `%USERPROFILE%\.depara\data\config-import-journal.json`.
- Quarentena: `%USERPROFILE%\.depara\quarantine\<operationId>`.
- Releases anteriores: `%USERPROFILE%\.depara\releases`.
- Antes de alterar limites, exporte a configuração operacional e copie o runtime.
- Não use `git clean`, `git reset --hard` ou exclusões recursivas para resolver falhas.

## Operações interrompidas e recuperação

O encerramento gracioso primeiro impede novas operações e aguarda até 30 segundos as operações ativas. Se houver uma interrupção abrupta, o próximo início reconcilia os journals, reverte uma importação operacional em estado `prepared` ou `applying` e retoma operações elegíveis; não remova os arquivos de `data\file-operations`, `data\config-import-journal.json` nem de `quarantine`.

```powershell
Invoke-RestMethod http://127.0.0.1:3000/api/files/recovery
Invoke-RestMethod http://127.0.0.1:3000/api/files/operations/<operationId>
```

Restaure somente uma entrada identificada e confirme que o caminho original está livre:

```powershell
Invoke-RestMethod http://127.0.0.1:3000/api/files/recovery/<entryId>/restore -Method Post
```

Destinos existentes não são substituídos por padrão. Para uma substituição intencional, o chamador deve informar `options.overwrite=true`; o destino anterior fica na quarentena até ser restaurado ou tratado por uma política de retenção revisada.
