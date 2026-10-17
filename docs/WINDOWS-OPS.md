# Contrato operacional Windows

## Processo e limites

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

O início é idempotente. O encerramento procura somente processos Node cujo comando aponta para o runtime ou para o `src/main.js` deste checkout; não encerra outros processos Node.

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
- Releases anteriores: `%USERPROFILE%\.depara\releases`.
- Antes de alterar limites, exporte a configuração operacional e copie o runtime.
- Não use `git clean`, `git reset --hard` ou exclusões recursivas para resolver falhas.
