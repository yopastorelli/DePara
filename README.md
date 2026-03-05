# DePara

Aplicacao web para operacoes de arquivos, agendamentos, slideshow e atualizacao automatica no Raspberry Pi.

## Estado atual
- Versao da app: `2.0.0`
- Entrada principal: `src/main.js`
- UI: `http://127.0.0.1:3000/ui`
- Health: `http://127.0.0.1:3000/health`

## Funcionalidades
- Operacoes de arquivos: mover, copiar, apagar (imediatas e agendadas)
- Slideshow com acoes por foto: apagar, ocultar, ajustar e favoritar
- Screensaver por inatividade (saida somente com `ESC`)
- Screensaver dedicado fullscreen quando a app estiver minimizada
- Auto-update com check manual e ciclo automatico

## Instalacao rapida
```bash
git clone https://github.com/yopastorelli/DePara.git
cd DePara
npm ci --omit=dev || npm install --production
npm start
```

## Execucao com PM2 (recomendado no RP4)
```bash
pm2 start src/main.js --name DePara --env production
pm2 save
```

## Atualizar no RP4
```bash
cd ~/DePara
git fetch origin
git checkout main
git pull --ff-only origin main
npm ci --omit=dev || npm install --production
pm2 restart DePara
```

## Endpoints principais
- `GET /health`
- `GET /api/health`
- `POST /api/files/execute`
- `POST /api/files/schedule`
- `GET /api/files/scheduled`
- `POST /api/update/auto/check-now`
- `GET /api/update/auto/status`
- `GET /api/tray/status`
- `POST /api/tray/screensaver/open`
- `POST /api/tray/screensaver/close`

## Documentacao
- [Indice de docs](docs/README.md)
- [Instalacao](docs/INSTALLATION.md)
- [Configuracao](docs/CONFIGURATION.md)
- [API](docs/API.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)
- [Auditoria auto-update](docs/AUDIT_AUTO_UPDATE.md)
