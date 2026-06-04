# Operacao RP4

## Referencia de producao
- Plataforma principal: Raspberry Pi 4
- Supervisor canonico: PM2
- Runtime operacional padrao: `DEPARA_RUNTIME_ROOT=/home/<user>/.depara`
- Config operacional persistente: `~/.depara/config.env`
- Release ativo padrao: `/home/<user>/.depara/current -> /home/<user>/.depara/releases/<commit>`
- O atalho do menu chama apenas `start-depara.sh open`
- `depara.service` e legado e fica fora do fluxo principal suportado

## Checklist de go live
```bash
npm run lint
npm run test:unit
npm run test:smoke
npm run test:e2e
git status --short
node bootstrap-runtime-release.js
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
PORT="$(grep -E '^PORT=' "$HOME/.depara/config.env" | tail -n 1 | cut -d '=' -f 2-)"
PORT="${PORT:-3000}"
pm2 status
curl -s "http://127.0.0.1:${PORT}/health"
curl -s "http://127.0.0.1:${PORT}/api/update/auto/diagnostics"
```

## Leitura operacional obrigatoria
- `runtime.supervisor.supervisor` deve ser `pm2`
- `runtime.supervisor.pm2.registered` deve ser `true`
- `runtime.scheduler.stale` deve ser `false`
- `runtime.lastFailureStage` deve estar vazio em estado saudavel

## Fluxo canonico de update
1. `POST /api/update/auto/check-now`
2. `POST /api/update/auto/trigger`
3. O ciclo faz `git fetch`, prepara um novo release limpo em staging e instala dependencias no release
4. O orchestrator ativa o novo release em `current`, despacha restart via PM2 e valida `/health`
5. Em falha de validacao, o orchestrator restaura o release anterior e despacha rollback automatico

## Boot e menu
- Backend: `pm2 start ecosystem.config.js --env production`
- Persistencia de reboot: `pm2 save` + `pm2 startup`
- Janela: menu desktop executa `start-depara.sh open`
- O launcher do menu nao sobe servidor, nao executa `npm install` e nao substitui o PM2
- O launcher resolve a porta a partir de `~/.depara/config.env`

## Politica de configuracao
- Defaults de codigo so servem como fallback
- A configuracao persistente do runtime mora fora do checkout e fora do release ativo
- Overrides temporarios via `process.env` continuam ganhando de `config.env`

## Bloqueios de publicacao
- scheduler stale
- processo fora do PM2
- UI ou automacao ainda usando endpoints legados de update
- logs massivos habilitados por padrao em producao

## Politica de logs
- `LOG_TO_CONSOLE=false` e o padrao operacional em producao
- `LOG_LEVEL=warn` e o baseline esperado
- `debug` so deve ser habilitado de forma temporaria

## Nao comitar
- `.claude/`
- `backups/`
- `test-results/`
