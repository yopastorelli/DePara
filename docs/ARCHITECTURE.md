# Arquitetura Operacional

## Componentes principais
- Backend Express: `src/main.js`
- UI estatica: `src/public/index.html`, `src/public/app.js`, `src/public/styles.css`
- Modulos de UI de runtime/update: `src/public/modules/*`
- Rotas publicas: `src/routes/*`
- Persistencia funcional: `src/utils/configStore.js`
- Auto-update: `src/services/updateOrchestrator.js`
- Runtime PM2: `ecosystem.config.js`
- Config operacional: `src/utils/runtimeConfig.js`

## Fluxos criticos
- Health e status:
  - `/health`
  - `/api/health/*`
  - `/api/status/*`
- Config persistida:
  - `/api/config`
- Operacoes de arquivo:
  - `/api/files/execute`
  - `/api/files/schedule*`
  - `/api/files/folders*`
  - `/api/files/workflows*`
  - `/api/files/templates*`
  - `/api/files/progress*`
  - `/api/files/list-images`
  - `/api/files/list-folders`
  - `/api/files/image/*`
- UI e janelas dedicadas:
  - `/ui`
  - `/api/tray/*`
  - `/api/desktop/*`
- Update:
  - `/api/update/auto/*`
  - `/api/update/check|apply|restart|status` apenas para retorno `410`
- Logs do frontend:
  - `POST /api/logs`

## Fonte de verdade por dominio
- Config operacional de runtime: `~/.depara/config.env`
- Versao, scripts e engines: `package.json`
- Config da aplicacao: `~/.depara/data/depara-config.json`
- Operacoes agendadas: `~/.depara/data/scheduled-operations.json`
- Pastas configuradas: `~/.depara/data/folders.json`
- Config do auto-update: `~/.depara/data/update-config.json`
- Estado do auto-update: `~/.depara/data/update-state.json`
- Historico de update: `~/.depara/data/update-history.log`

## Contratos operacionais
- A UI principal em `/ui` concentra slideshow, operacoes manuais, operacoes agendadas e leitura de status.
- O backend carrega configuracao com precedencia `process.env` > `~/.depara/config.env` > defaults.
- O backend cria diretorios de runtime a partir de `DEPARA_RUNTIME_ROOT` e derivados de log, backup, temp e uploads.
- O wrapper de `~/.depara/current/src/main.js` carrega `config.env`, resolve o release ativo e chama `startServer()` explicitamente.
- Na primeira inicializacao do runtime, `depara-config.json`, `scheduled-operations.json` e `folders.json` podem ser recuperados de `data/` ou `src/data/` do checkout legado.
- A exportacao/importacao operacional usa um JSON versionado unico e substitui integralmente `depara-config.json`, `scheduled-operations.json` e `folders.json`.
- O scheduler de update e inicializado pelo backend, mas a prontidao operacional depende do diagnostico de supervisor do orchestrator.
- No RP4, o launcher do menu depende de um backend ja saudavel em PM2.

## Partes frageis
- `src/public/app.js`: arquivo legado grande; qualquer correcao textual deve preservar parse e comportamento.
- `src/routes/fileOperations.js`: superficie extensa e heterogenea; validar smoke tests ao tocar mensagens ou contratos.
- `src/services/updateOrchestrator.js`: nao validar fluxos destrutivos sem `DEPARA_DISABLE_UPDATE_SIDE_EFFECTS=true`.
