# Instalacao

## Requisitos
- Node.js >= 18
- npm >= 9
- Git
- (RP4 recomendado) PM2

## Local/Linux
```bash
git clone https://github.com/yopastorelli/DePara.git
cd DePara
npm ci --omit=dev || npm install --production
npm start
```

## RP4 com PM2
```bash
cd ~/DePara
git fetch origin
git checkout main
git pull --ff-only origin main
npm ci --omit=dev || npm install --production
sudo npm i -g pm2
pm2 start src/main.js --name DePara --env production
pm2 save
```

## Validacao pos-instalacao
```bash
curl -s http://127.0.0.1:3000/health
curl -s http://127.0.0.1:3000/api/update/auto/status
curl -s http://127.0.0.1:3000/api/tray/status
```

## Atualizacao segura (RP4)
```bash
cd ~/DePara
git fetch origin
git checkout main
git pull --ff-only origin main
npm ci --omit=dev || npm install --production
pm2 restart DePara
```
