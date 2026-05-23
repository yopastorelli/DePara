# Arquitetura Operacional

## Componentes principais
- Backend Express: `src/main.js`
- UI estática: `src/public/index.html`, `src/public/app.js`, `src/public/styles.css`
- Módulos de UI de runtime/update: `src/public/modules/*`
- Rotas públicas: `src/routes/*`
- Persistência funcional: `src/utils/configStore.js`
- Auto-update: `src/services/updateOrchestrator.js`
- Runtime PM2: `ecosystem.config.js`

## Fluxos críticos
- Health e status:
  - `/health`
  - `/api/health/*`
  - `/api/status/*`
- Config persistida:
  - `/api/config`
- Operações de arquivo:
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

## Fonte de verdade por domínio
- Versão, scripts e engines: `package.json`
- Config da aplicação: `data/depara-config.json`
- Config do auto-update: `data/update-config.json`
- Estado do auto-update: `data/update-state.json`
- Histórico de update: `data/update-history.log`

## Contratos operacionais
- A UI principal em `/ui` concentra slideshow, operações manuais, operações agendadas e leitura de status.
- O backend cria diretórios de runtime a partir de `DEPARA_RUNTIME_ROOT` e derivados de log, backup, temp e uploads.
- O scheduler de update é inicializado pelo backend, mas a prontidão operacional depende do diagnóstico de supervisor do orchestrator.
- No RP4, o launcher do menu depende de um backend já saudável em PM2.

## Partes frágeis
- `src/public/app.js`: arquivo legado grande; qualquer correção textual deve preservar parse e comportamento.
- `src/routes/fileOperations.js`: superfície extensa e heterogênea; validar smoke tests ao tocar mensagens ou contratos.
- `src/services/updateOrchestrator.js`: não validar fluxos destrutivos sem `DEPARA_DISABLE_UPDATE_SIDE_EFFECTS=true`.
