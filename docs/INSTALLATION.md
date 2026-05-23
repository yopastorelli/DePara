# Instalação e Execução

## Requisitos canônicos
- Node.js `>=18`
- npm `>=9`
- Git
- PM2 para produção RP4

## Setup local
```bash
npm ci
npm run lint
npm run test:unit
npm run test:smoke
npm run start
```

## Variáveis operacionais
- `DEPARA_RUNTIME_ROOT`: raiz operacional do runtime. Default: `~/.depara`
- `DEPARA_DATA_DIR`: diretório de dados persistidos
- `DEPARA_CONFIG_FILE`: arquivo principal de config
- `DEPARA_LOG_DIR` e `LOG_FILE`: logs
- `DEPARA_BACKUP_DIR`: backups operacionais
- `DEPARA_TEMP_DIR`: temporários de runtime
- `DEPARA_DISABLE_UPDATE_SIDE_EFFECTS=true`: bloqueia update destrutivo
- `DEPARA_DISABLE_UPDATE_SCHEDULER=true`: bloqueia scheduler automático

## Produção RP4 com PM2
```bash
git fetch origin
git checkout main
git pull --ff-only origin main
npm install -g pm2
npm ci --omit=dev
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
```

## Atalho do menu RP4
```bash
cp depara.desktop ~/.local/share/applications/depara.desktop
sed -i "s|__DEPARA_DIR__|$HOME/DePara|g" ~/.local/share/applications/depara.desktop
update-desktop-database ~/.local/share/applications || true
```
- O atalho do menu chama apenas `start-depara.sh open`.
- O launcher valida `/health` antes de abrir a janela.
- O launcher não deve iniciar o backend fora do PM2.

## Validação mínima pós-start
```bash
pm2 status
curl -s http://127.0.0.1:3000/health
curl -s http://127.0.0.1:3000/api/status
curl -s http://127.0.0.1:3000/api/update/auto/status
curl -s http://127.0.0.1:3000/api/update/auto/diagnostics
```
