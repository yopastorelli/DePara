# Auditoria Técnica: Auto-Update DePara

## Escopo
- Backend `UpdateOrchestrator` (`src/services/updateOrchestrator.js`)
- Rotas públicas de update (`src/routes/update.js`)
- Painel de atualização no frontend (`src/public/app.js`, `src/public/index.html`)

## Fluxo Atual (após hardening)
1. Scheduler interno dispara `startUpdateCycle`.
2. Lock em disco (`src/data/update.lock`) evita concorrência.
3. Checagem remota: `git fetch origin main --prune` e comparação `HEAD` vs `origin/main`.
4. Havendo update e `autoApply=true`:
  - `git merge --ff-only <targetCommit>`
  - `npm ci --omit=dev` (fallback `npm install --production`)
  - restart (`pm2 restart $PM2_APP_NAME`, default `DePara`)
5. Pós-restart: validação via health (`healthPath`, default `/health`).
6. Falha de health:
  - rollback imediato para `previousCommit`
  - reinstall
  - restart
7. Falha após rollback: estado `critical` (sem loop infinito).

## Endpoints de Operação
- `GET /api/update/auto/status`
- `POST /api/update/auto/check-now` (força checagem remota)
- `PUT /api/update/auto/config`
- `POST /api/update/auto/trigger`
- `GET /api/update/auto/history`

Compatibilidade legada preservada:
- `/api/update/check`
- `/api/update/apply`
- `/api/update/restart`
- `/api/update/status`

## Riscos Encontrados e Correções
1. **Status “parado” no painel**
- Causa: frontend consultava apenas status passivo.
- Correção: novo endpoint `check-now` e botão “Atualizar Status” com checagem remota.

2. **Lock frágil**
- Causa: lock simples sem metadados.
- Correção: lock com `runId/pid/startedAt`, limpeza de lock órfão/stale.

3. **Superfície de ataque de config**
- Causa: payload podia injetar comandos de instalação.
- Correção: whitelist estrita no `updateConfig`; comandos fixos internamente.

4. **Loop potencial de rollback**
- Causa: health falho após rollback poderia reentrar em rollback.
- Correção: com `rollbackPerformed=true`, falha vira `critical`.

5. **Acoplamento fixo ao PM2 app name**
- Correção: `PM2_APP_NAME` via env, fallback `DePara`.

6. **Observabilidade limitada**
- Correção: `lastRunId`, `lastEvent`, histórico de transições e métricas de health check.

## Pré-condições Operacionais (RP4)
- Worktree git limpa ou estratégia explícita para mudanças locais.
- Usuário com permissão de `git fetch/merge` e `npm`.
- PM2 instalado e processo com nome compatível (`PM2_APP_NAME` se customizado).
- Porta/health local acessível (`127.0.0.1:$PORT`).

## Riscos Residuais
- Falhas de sistema operacional (`apt/dpkg/initramfs`, kernel) são externas ao app.
- Falhas de rede/credenciais no `git fetch` impedem update.
- Se supervisor externo não existir fora do PM2, fallback `process.exit(0)` pode não subir processo.

## Recomendações
- Em produção, usar canal `origin/main`.
- Monitorar `update-history.log` e estado `critical`.
- Executar checagem manual pós-deploy:
  - `POST /api/update/auto/check-now`
  - `GET /api/update/auto/status`
  - `GET /api/update/auto/history?limit=10`
