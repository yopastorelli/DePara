# Instalacao e Execucao

## Requisitos
- Node.js `>=18`
- npm `>=9`
- Git
- PM2 para producao RP4

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

## Configuracao operacional
- Arquivo persistente suportado em producao: `~/.depara/config.env`
- Precedencia: `process.env` > `~/.depara/config.env` > defaults de codigo
- Variaveis minimas suportadas:
  - `PORT`
  - `NODE_ENV`
  - `LOG_LEVEL`
  - `LOG_TO_CONSOLE`
  - `DEPARA_RUNTIME_ROOT`

Exemplo inicial:
```env
PORT=3000
NODE_ENV=production
LOG_LEVEL=warn
LOG_TO_CONSOLE=false
DEPARA_RUNTIME_ROOT=/home/<user>/.depara
```

## Variaveis operacionais
- `PORT`: porta HTTP, default `3000`
- `DEPARA_RUNTIME_ROOT`: raiz operacional do runtime, default `~/.depara`
- `DEPARA_CONFIG_ENV_PATH`: override opcional para o caminho de `config.env`
- `DEPARA_DATA_DIR`: diretorio de dados persistidos
- `DEPARA_RELEASES_DIR`: diretorio de releases imutaveis
- `DEPARA_CURRENT_DIR`: wrapper estavel apontando para o release ativo
- `DEPARA_CONFIG_FILE`: arquivo principal de config funcional
- `DEPARA_LOG_DIR` e `LOG_FILE`: logs
- `DEPARA_BACKUP_DIR`: backups operacionais
- `DEPARA_TEMP_DIR`: temporarios de runtime
- `DEPARA_RUNTIME_PUBLIC_DIR`: base de uploads/downloads de runtime
- `DEPARA_DISABLE_UPDATE_SIDE_EFFECTS=true`: bloqueia update destrutivo
- `DEPARA_DISABLE_UPDATE_SCHEDULER=true`: bloqueia scheduler automatico
- `PM2_APP_NAME`: nome esperado do processo no diagnostico operacional

## Producao RP4 com PM2
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

- O bootstrap publica o release inicial em `~/.depara/releases/<commit>`, grava o wrapper canonico em `~/.depara/current` e cria `~/.depara/config.env` se ele nao existir.
- O wrapper carrega `config.env` e chama `startServer()` explicitamente.
- Depois da instalacao, o runtime ativo nao roda mais em cima do checkout Git.
- `depara.service` e legado e nao faz parte do fluxo principal suportado.

## Launcher e menu RP4
```bash
cp depara.desktop ~/.local/share/applications/depara.desktop
sed -i "s|__DEPARA_DIR__|$HOME/DePara|g" ~/.local/share/applications/depara.desktop
update-desktop-database ~/.local/share/applications || true
```

- O atalho do menu chama `start-depara.sh open`.
- O launcher le a porta de `~/.depara/config.env`, valida `/health` e abre a UI.
- O launcher nao sobe, reinicia nem substitui o backend do PM2.

## Validacao pos-start
```bash
PORT="$(grep -E '^PORT=' "$HOME/.depara/config.env" | tail -n 1 | cut -d '=' -f 2-)"
PORT="${PORT:-3000}"
pm2 status
curl -s "http://127.0.0.1:${PORT}/health"
curl -s "http://127.0.0.1:${PORT}/api/status"
curl -s "http://127.0.0.1:${PORT}/api/update/auto/status"
curl -s "http://127.0.0.1:${PORT}/api/update/auto/diagnostics"
```
