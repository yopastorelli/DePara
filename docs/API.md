# API DePara (vigente)

Base URL:
- `http://127.0.0.1:3000/api`

Health global:
- `GET /health`

## Resposta padrao
Sucesso:
```json
{ "success": true, "data": {}, "timestamp": "2026-03-05T00:00:00.000Z" }
```
Erro:
```json
{ "error": { "message": "...", "details": "..." } }
```

## Health e status
- `GET /api/health`
- `GET /api/status`
- `GET /api/status/resources`

## Operacoes de arquivos
- `POST /api/files/execute`
- `POST /api/files/schedule`
- `GET /api/files/scheduled`
- `PUT /api/files/schedule/:operationId`
- `DELETE /api/files/schedule/:operationId`
- `POST /api/files/schedule/:operationId/execute`

## Slideshow
- `POST /api/files/list-images`
- `GET /api/files/image/:encodedPath`

## Tray e screensaver dedicado
- `POST /api/tray/minimize`
- `POST /api/tray/restore`
- `POST /api/tray/open-dedicated`
- `POST /api/tray/screensaver/open`
- `POST /api/tray/screensaver/arm`
- `POST /api/tray/screensaver/disarm`
- `POST /api/tray/screensaver/close`
- `GET /api/tray/status`

`GET /api/tray/status` retorna:
- `wmctrlAvailable`
- `graphicalSession`
- `trayMinimized`
- `screensaverDedicatedActive`
- `screensaverSessionId`
- `screensaverArmed`
- `screensaverArmDueAt`

## Auto-update
- `GET /api/update/auto/status`
- `PUT /api/update/auto/config`
- `POST /api/update/auto/check-now`
- `POST /api/update/auto/trigger`
- `GET /api/update/auto/history?limit=10`
- `GET /api/update/auto/diagnostics`

## Logs frontend
- `POST /api/logs`
