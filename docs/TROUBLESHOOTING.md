# Troubleshooting

## 1) Rota nao encontrada para update
Sintoma:
- `POST /api/update/auto/check-now` retorna 404

Checklist:
```bash
cd ~/DePara
git branch --show-current
git rev-parse --short HEAD
grep -n "auto/check-now" src/routes/update.js
pm2 delete DePara 2>/dev/null || true
sudo fuser -k 3000/tcp || true
pm2 start /home/$USER/DePara/src/main.js --name DePara --cwd /home/$USER/DePara --env production
pm2 save
```

## 2) PM2 reiniciando em loop / porta 3000 ocupada
```bash
sudo ss -lptn 'sport = :3000'
pm2 logs DePara --lines 120
sudo fuser -k 3000/tcp
pm2 restart DePara
```

## 3) Screensaver dedicado nao abre minimizado
Validar:
```bash
curl -s http://127.0.0.1:3000/api/tray/status
```
Campos esperados:
- `graphicalSession: true`
- `wmctrlAvailable: true` (recomendado)

Se `graphicalSession=false`, configurar ambiente do PM2 com `DISPLAY`/`XAUTHORITY`.

## 4) Kernel/apt quebrado (initramfs)
Esse problema e do sistema operacional, nao da app.

Fluxo recomendado:
- estabilizar SO (dpkg/apt/initramfs)
- reboot validando kernel
- depois retomar deploy do DePara

## 5) Diagnostico rapido
```bash
curl -s http://127.0.0.1:3000/health
curl -s http://127.0.0.1:3000/api/update/auto/status
curl -s http://127.0.0.1:3000/api/update/auto/diagnostics
curl -s "http://127.0.0.1:3000/api/update/auto/history?limit=10"
```
