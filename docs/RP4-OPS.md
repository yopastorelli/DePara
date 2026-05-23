# Operação RP4

## Referência de produção
- Plataforma principal: Raspberry Pi 4
- Supervisor canônico: PM2
- Runtime operacional: `DEPARA_RUNTIME_ROOT=/home/yo/.depara`
- `systemd` não é supervisor alternativo da app; ele apenas sobe o `pm2-runtime`

## Checklist de go live
```bash
npm run lint
npm run test:unit
npm run test:smoke
npm run test:e2e
git status --short
pm2 start ecosystem.config.js --env production
pm2 save
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
3. O ciclo executa `git fetch` -> `merge --ff-only` -> `npm ci` -> `pm2 restart`
4. O health check em `/health` fecha o ciclo
5. Se falhar, o rollback deve devolver o commit anterior e registrar a etapa

## Bloqueios de publicação
- worktree com artefato não deliberado
- scheduler stale
- processo fora do PM2
- endpoint legado de update ainda em uso por UI/automação
- logs massivos habilitados por padrão em produção

## Política de logs
- `LOG_TO_CONSOLE=false` é o padrão de produção no RP4.
- `LOG_LEVEL=warn` é o baseline operacional.
- `debug` só pode ser habilitado de forma temporária e deliberada.

## Não comitar
- `.claude/`
- `backups/`
- `test-results/`
