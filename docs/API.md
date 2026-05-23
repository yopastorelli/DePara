# Contrato de API

## Convenções
- Base path da API: `/api`
- A UI pública é servida em `/ui`
- Respostas novas de update devem usar apenas `/api/update/auto/*`
- Endpoints legados de update continuam públicos apenas para retornar `410 Gone`

## Descoberta
- `GET /api`
- `GET /api/docs`

## Health
- `GET /health`
- `GET /api/health`
- `GET /api/health/detailed`
- `GET /api/health/connectivity`

## Status
- `GET /api/status`
- `GET /api/status/system`
- `GET /api/status/resources`
- `GET /api/status/connectivity`
- `GET /api/status/performance`
- `GET /api/status/logs`

## Config
- `GET /api/config`
- `POST /api/config`
- `GET /api/config/export`
- `POST /api/config/import`

### Backup operacional
- `GET /api/config/export` retorna um JSON versionado com:
  - `version`
  - `exportedAt`
  - `sourceRuntime`
  - `config`
  - `scheduledOperations`
  - `folders`
- `POST /api/config/import` substitui integralmente o estado operacional coberto pelo backup.
- O import valida a versao e o shape minimo antes de regravar os arquivos canonicos em `~/.depara/data`.

## Arquivos

### Pastas configuradas
- `GET /api/files/folders`
- `POST /api/files/folders`
- `PUT /api/files/folders/:id`
- `DELETE /api/files/folders/:id`

### Workflows
- `GET /api/files/workflows`
- `POST /api/files/workflows`
- `PUT /api/files/workflows/:id`
- `DELETE /api/files/workflows/:id`

### Execução e agendamento
- `POST /api/files/execute`
- `POST /api/files/schedule`
- `GET /api/files/scheduled`
- `GET /api/files/schedule/:operationId`
- `PUT /api/files/schedule/:operationId`
- `DELETE /api/files/schedule/:operationId`
- `POST /api/files/schedule/:operationId/execute`

### Contrato atual de agendamento
- `POST /api/files/schedule` exige `name`, `frequency`, `action` e `sourcePath`
- `targetPath` continua obrigatório para `move` e `copy`
- `PUT /api/files/schedule/:operationId` aceita atualização parcial
- `active=false` pausa sem excluir
- `active=true` reativa a operação persistida

### Operação, inspeção e utilitários
- `GET /api/files/actions`
- `GET /api/files/stats`
- `GET /api/files/backups`
- `GET /api/files/backup-config`
- `PUT /api/files/backup-config`
- `GET /api/files/progress`
- `GET /api/files/progress/:operationId`
- `POST /api/files/batch`

### Templates e padrões
- `GET /api/files/templates`
- `GET /api/files/templates/categories`
- `GET /api/files/templates/:category/:name`
- `POST /api/files/templates/:category/:name/apply`
- `GET /api/files/ignored-patterns`
- `POST /api/files/check-ignore`

### Slideshow e navegação de arquivos
- `POST /api/files/list-images`
- `POST /api/files/list-folders`
- `GET /api/files/images/:folderPath(*)`
- `GET /api/files/image/:imagePath(*)`

## Update
- `GET /api/update/auto/status`
- `POST /api/update/auto/check-now`
- `PUT /api/update/auto/config`
- `POST /api/update/auto/trigger`
- `GET /api/update/auto/history`
- `GET /api/update/auto/diagnostics`

### Endpoints legados mantidos só para bloqueio explícito
- `GET /api/update/check`
- `POST /api/update/apply`
- `POST /api/update/restart`
- `GET /api/update/status`

Todos os endpoints acima devem responder `410` com instrução para migrar para `/api/update/auto/*`.

## Tray e janelas dedicadas
- `GET /api/tray/status`
- `POST /api/tray/minimize`
- `POST /api/tray/restore`
- `POST /api/tray/maximize`
- `POST /api/tray/open-dedicated`
- `POST /api/tray/screensaver/open`
- `POST /api/tray/screensaver/arm`
- `POST /api/tray/screensaver/disarm`
- `POST /api/tray/screensaver/close`

## Desktop
- `POST /api/desktop/create`
- `GET /api/desktop/status`
- `PUT /api/desktop/update`
- `DELETE /api/desktop/remove`

## Logs do frontend
- `POST /api/logs`

## Diagnóstico de update
Os payloads de `status` e `diagnostics` do auto-update devem expor, no mínimo:
- `runtime.supervisor.supervisor`
- `runtime.supervisor.pm2.available`
- `runtime.supervisor.pm2.registered`
- `runtime.scheduler.lastCycleAt`
- `runtime.scheduler.stale`
- `runtime.lock`
- `runtime.lastFailureStage`
- `runtime.release.current`
- `runtime.release.target`
- `runtime.release.previous`
- `runtime.release.staging`
- `runtime.release.activationState`
- `runtime.persistence.configMigrated`
- `runtime.persistence.scheduledOperationsMigrated`
- `runtime.persistence.foldersMigrated`
- `runtime.persistence.sources`

## Política operacional
- Produção RP4 assume PM2 como único supervisor suportado.
- O estado preservado entre releases fica em `~/.depara/data`.
- O backup operacional versionado cobre `depara-config.json`, `scheduled-operations.json` e `folders.json`.
- `runtime.worktree` pode continuar aparecendo em diagnósticos, mas não é mais gate primário do auto-update no RP4.
- Logging em `console` não faz parte do contrato operacional padrão em `production` ou `test`.
