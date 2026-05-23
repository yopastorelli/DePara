# Contrato de API

## Endpoints canônicos

### Health e status
- `GET /health`
- `GET /api/health`
- `GET /api/health/detailed`
- `GET /api/health/connectivity`
- `GET /api/status`
- `GET /api/status/resources`

### Config
- `GET /api/config`
- `POST /api/config`

### Arquivos
- `POST /api/files/execute`
- `POST /api/files/schedule`
- `GET /api/files/scheduled`
- `POST /api/files/list-images`
- `POST /api/files/list-folders`
- `GET /api/files/image/:imagePath(*)`

### Update
- `GET /api/update/auto/status`
- `POST /api/update/auto/check-now`
- `PUT /api/update/auto/config`
- `POST /api/update/auto/trigger`
- `GET /api/update/auto/history`
- `GET /api/update/auto/diagnostics`

### Tray
- `GET /api/tray/status`

## Diagnóstico de update
- `status` e `diagnostics` devem expor:
  - `runtime.supervisor.supervisor`
  - `runtime.supervisor.pm2.available`
  - `runtime.supervisor.pm2.registered`
  - `runtime.scheduler.lastCycleAt`
  - `runtime.scheduler.stale`
  - `runtime.lock`
  - `runtime.lastFailureStage`

## Endpoints removidos
- `GET /api/update/check`
- `POST /api/update/apply`
- `POST /api/update/restart`
- `GET /api/update/status`

Novas UIs, testes e automações devem usar exclusivamente `/api/update/auto/*`.

## Política operacional
- Produção RP4 assume `PM2` como único supervisor suportado.
- Logging em `console` não faz parte do contrato operacional padrão em `production` ou `test`.
