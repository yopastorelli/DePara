# Instalação e Execução

## Requisitos canônicos
- Node.js `>=18`
- npm `>=9`
- Git
- PM2 somente para operação RP4/produção

## Setup local
```bash
npm ci
npm run lint
npm run test:unit
npm run test:smoke
npm run start
```

## Variáveis úteis
- `PORT`: porta HTTP
- `LOG_FILE`: caminho do log
- `DEPARA_DATA_DIR`: diretório de dados
- `DEPARA_CONFIG_FILE`: caminho do config principal
- `DEPARA_LOG_DIR`, `DEPARA_BACKUP_DIR`, `DEPARA_TEMP_DIR`: diretórios isoláveis para teste
- `DEPARA_DISABLE_UPDATE_SIDE_EFFECTS=true`: desliga restart/update destrutivo
- `DEPARA_DISABLE_UPDATE_SCHEDULER=true`: desliga scheduler do auto-update

## Execução RP4 com PM2
```bash
git fetch origin
git checkout main
git pull --ff-only origin main
npm ci --omit=dev
pm2 start src/main.js --name DePara --env production
pm2 save
```

## Validação mínima pós-start
```bash
curl -s http://127.0.0.1:3000/health
curl -s http://127.0.0.1:3000/api/status
curl -s http://127.0.0.1:3000/api/update/auto/status
```
