# Operação RP4

## Referência de produção
- Plataforma principal: Raspberry Pi 4
- Supervisor canônico: PM2
- Runtime operacional padrão: `DEPARA_RUNTIME_ROOT=/home/yo/.depara`
- Release ativo padrão: `/home/yo/.depara/current -> /home/yo/.depara/releases/<commit>`
- `systemd` só pode existir como bootstrap do PM2 salvo
- O atalho do menu chama apenas `start-depara.sh open`

## Checklist de go live
```bash
npm run lint
npm run test:unit
npm run test:smoke
npm run test:e2e
git status --short
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
pm2 status
curl -s http://127.0.0.1:3000/health
curl -s http://127.0.0.1:3000/api/update/auto/diagnostics
```

## Leitura operacional obrigatória
- `runtime.supervisor.supervisor` deve ser `pm2`
- `runtime.supervisor.pm2.registered` deve ser `true`
- `runtime.scheduler.stale` deve ser `false`
- `runtime.lastFailureStage` deve estar vazio em estado saudável

## Fluxo canônico de update
1. `POST /api/update/auto/check-now`
2. `POST /api/update/auto/trigger`
3. O ciclo faz `git fetch`, prepara um novo release limpo em staging e instala dependências no release
4. O orchestrator ativa o novo release em `current`, despacha restart via PM2 e valida `/health`
5. Em falha de validação, o orchestrator restaura o release anterior e despacha rollback automático

## Boot e menu
- Backend: `pm2 start ecosystem.config.js --env production`
- Persistência de reboot: `pm2 save` + `pm2 startup`
- Janela: menu desktop executa `start-depara.sh open`
- O launcher do menu não sobe servidor, não executa `npm install` e não substitui o PM2

## Bloqueios de publicação
- scheduler stale
- processo fora do PM2
- UI ou automação ainda usando endpoints legados de update
- logs massivos habilitados por padrão em produção

## Política de logs
- `LOG_TO_CONSOLE=false` é o padrão operacional em produção
- `LOG_LEVEL=warn` é o baseline esperado
- `debug` só deve ser habilitado de forma temporária

## Não comitar
- `.claude/`
- `backups/`
- `test-results/`
