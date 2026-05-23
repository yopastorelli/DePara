# DePara

Superfície operacional canônica para automação de arquivos, slideshow e operação RP4.

## Release Gate
```bash
npm run lint
npm run test:unit
npm run test:smoke
npm run test:e2e
```

## Acesso local
- UI: `http://127.0.0.1:3000/ui`
- Health: `http://127.0.0.1:3000/health`
- API health: `http://127.0.0.1:3000/api/health`
- Docs de API: `http://127.0.0.1:3000/api/docs`

## Fonte de verdade
- Entrada HTTP: `src/main.js`
- Rotas públicas: `src/routes/*`
- Versão, scripts e engines: `package.json`
- Runtime PM2: `ecosystem.config.js`
- Launcher RP4: `start-depara.sh`
- Dados persistidos: `DEPARA_DATA_DIR` ou `~/.depara/data`
- Runtime operacional: `DEPARA_RUNTIME_ROOT` ou `~/.depara`
- Releases ativos: `~/.depara/releases/<commit>` com wrapper estável em `~/.depara/current`
- Docs canônicas: [docs/README.md](docs/README.md)

## Invariantes operacionais
- PM2 é o supervisor suportado em produção RP4.
- `systemd` pode existir só para bootstrap do estado salvo do PM2.
- O launcher `start-depara.sh` apenas valida `/health` e abre a UI; ele não sobe o backend.
- O PM2 deve iniciar `~/.depara/current/src/main.js`, nunca um checkout mutável do repositório.
- Fluxos novos de update devem usar apenas `/api/update/auto/*`.
- Endpoints legados de update continuam expostos apenas para retornar `410 Gone`.
- O auto-update publica um novo release imutável, troca o release ativo e preserva apenas o estado operacional em `~/.depara/data`.
- Testes não devem depender de side effects em `backups/`, `logs/` ou `test-results/` do repositório.
- Logging em `console` fica desligado por padrão em `production` e `test`.
- `Operações Agendadas` gerencia operações persistidas; não é uma segunda superfície de modelagem.

## Ordem de leitura
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- [docs/INSTALLATION.md](docs/INSTALLATION.md)
- [docs/API.md](docs/API.md)
- [docs/TESTING.md](docs/TESTING.md)
- [docs/RP4-OPS.md](docs/RP4-OPS.md)
- [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)
