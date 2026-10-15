# WINDOWS_OPERATIONS_CONTRACT

## Runtime

- Plataforma suportada: Windows.
- Processo: `node src/main.js`, iniciado por `npm run start:windows`.
- Host padrão: `127.0.0.1`.
- Porta padrão: `3000`.
- Runtime persistente: `%USERPROFILE%\.depara`.
- O processo permanece visível em primeiro plano; não há supervisor PM2 ou systemd no contrato.

## Inicialização e parada

```powershell
Set-Location C:\DePara
$env:NODE_ENV = 'production'
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
| `MAX_CONCURRENT_OPERATIONS` | `1` ou `2` | limita cópias/movimentações simultâneas |
| `MAX_RECURSION_DEPTH` | `10` a `20` | impede varreduras profundas acidentais |
| `DEPARA_MAX_IMAGE_RESULTS` | `1000` a `5000` | limita imagens mantidas em cada resposta |
| `LOG_LEVEL` | `warn` | reduz formatação e escrita de logs |
| `LOG_TO_CONSOLE` | `false` | evita saída contínua no terminal |
| `DEPARA_HTTP_LOGGING` | `false` | evita uma linha de log por requisição |

## Backup e rollback

- Dados mutáveis ficam em `%USERPROFILE%\.depara\data`.
- Backups ficam em `%USERPROFILE%\.depara\backups`.
- Antes de alterar limites ou ativar recursos opcionais, copie o diretório de runtime.
- Não use `git clean`, `git reset --hard` ou exclusões recursivas para resolver problemas operacionais.
