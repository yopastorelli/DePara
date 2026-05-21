# Operação RP4

## Referência de produção
- Ambiente alvo principal: Raspberry Pi 4
- Supervisor preferencial: PM2
- Fallback de restart: `systemd`

## Checklist operacional
```bash
git fetch origin
git checkout main
git pull --ff-only origin main
npm ci --omit=dev
pm2 restart DePara
curl -s http://127.0.0.1:3000/health
curl -s http://127.0.0.1:3000/api/update/auto/status
```

## Invariantes
- Worktree limpa antes de auto-update real
- `PM2_APP_NAME=DePara` se o nome padrão não estiver em uso
- Serviço `depara.service` disponível se PM2 não for o supervisor final

## Não faça isso
- Não rode `POST /api/update/auto/trigger` em produção sem health local funcional.
- Não deixe docs paralelas de RP4 fora deste arquivo.
