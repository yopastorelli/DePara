# Instalação e Execução

## Requisitos
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

## Scripts principais
- `npm run start`: inicia o backend
- `npm run dev`: inicia com `nodemon`
- `npm run start:bg`: sobe `src/main.js` em PM2
- `npm run start:bg:prod`: sobe em PM2 com `--env production`
- `npm run stop:bg`: para o processo PM2 `DePara`
- `npm run restart:bg`: reinicia o processo PM2 `DePara`
- `npm run status`: mostra estado no PM2
- `npm run logs`: mostra logs do PM2

## Variáveis operacionais
- `PORT`: porta HTTP, default `3000`
- `DEPARA_RUNTIME_ROOT`: raiz operacional do runtime, default `~/.depara`
- `DEPARA_DATA_DIR`: diretório de dados persistidos
- `DEPARA_RELEASES_DIR`: diretório de releases imutáveis
- `DEPARA_CURRENT_DIR`: wrapper estável apontando para o release ativo
- `DEPARA_CONFIG_FILE`: arquivo principal de config
- `DEPARA_LOG_DIR` e `LOG_FILE`: logs
- `DEPARA_BACKUP_DIR`: backups operacionais
- `DEPARA_TEMP_DIR`: temporários de runtime
- `DEPARA_RUNTIME_PUBLIC_DIR`: base de uploads/downloads de runtime
- `DEPARA_DISABLE_UPDATE_SIDE_EFFECTS=true`: bloqueia update destrutivo
- `DEPARA_DISABLE_UPDATE_SCHEDULER=true`: bloqueia scheduler automático
- `PM2_APP_NAME`: nome esperado do processo no diagnóstico operacional
- `DEPARA_ALLOW_SYSTEMD_FALLBACK=false`: mantém PM2 como baseline operacional

## Produção RP4 com PM2
```bash
git fetch origin
git checkout main
git pull --ff-only origin main
npm ci --omit=dev
node bootstrap-runtime-release.js
npm install -g pm2
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
```

- O bootstrap publica o release inicial em `~/.depara/releases/<commit>` e grava o wrapper canônico em `~/.depara/current`.
- Depois da instalação, o runtime ativo não roda mais em cima do checkout Git.

## Launcher e menu RP4
```bash
cp depara.desktop ~/.local/share/applications/depara.desktop
sed -i "s|__DEPARA_DIR__|$HOME/DePara|g" ~/.local/share/applications/depara.desktop
update-desktop-database ~/.local/share/applications || true
```
- O atalho do menu chama `start-depara.sh open`.
- O launcher valida `/health` antes de abrir a UI.
- O launcher não sobe, reinicia nem substitui o backend do PM2.

## Validação pós-start
```bash
pm2 status
curl -s http://127.0.0.1:3000/health
curl -s http://127.0.0.1:3000/api/status
curl -s http://127.0.0.1:3000/api/update/auto/status
curl -s http://127.0.0.1:3000/api/update/auto/diagnostics
```
