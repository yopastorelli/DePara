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

## Payloads mínimos

`POST /api/config`
```json
{
  "config": {
    "slideshowSelectedPath": "C:/Fotos",
    "slideshowConfig": {
      "interval": 3,
      "extensions": [".jpg", ".png"],
      "recursive": true
    }
  }
}
```

`POST /api/files/execute`
```json
{
  "action": "copy",
  "sourcePath": "C:/origem/arquivo.txt",
  "targetPath": "C:/destino/arquivo.txt"
}
```

## Endpoints legados
- Superfícies `GET /api/update/check`, `POST /api/update/apply`, `POST /api/update/restart` e `GET /api/update/status` permanecem por compatibilidade.
- Não use endpoints legados em novos testes ou novos fluxos de IA.
