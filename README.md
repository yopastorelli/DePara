# DePara

Superficie operacional canonica para automacao de arquivos, slideshow e operacao RP4.

## Release Gate
```bash
npm run lint
npm run test:unit
npm run test:smoke
npm run test:e2e
```

## Acesso local
- A porta operacional persistente fica em `~/.depara/config.env` com fallback `3000`
- UI: `http://127.0.0.1:<PORT>/ui`
- Health: `http://127.0.0.1:<PORT>/health`
- API health: `http://127.0.0.1:<PORT>/api/health`
- Docs de API: `http://127.0.0.1:<PORT>/api/docs`

## Fonte de verdade
- Entrada HTTP: `src/main.js`
- Rotas publicas: `src/routes/*`
- Versao, scripts e engines: `package.json`
- Runtime PM2: `ecosystem.config.js`
- Launcher RP4: `start-depara.sh`
- Config operacional persistente: `~/.depara/config.env`
- Dados persistidos: `DEPARA_DATA_DIR` ou `~/.depara/data`
- Runtime operacional: `DEPARA_RUNTIME_ROOT` ou `~/.depara`
- Releases ativos: `~/.depara/releases/<commit>` com wrapper estavel em `~/.depara/current`
- Docs canonicas: [docs/README.md](docs/README.md)

## Invariantes operacionais
- PM2 e o supervisor suportado em producao RP4.
- `systemd` pode existir apenas para bootstrap do estado salvo do PM2.
- O launcher `start-depara.sh` apenas valida `/health` e abre a UI; ele nao sobe o backend.
- O PM2 deve iniciar `~/.depara/current/src/main.js`, nunca um checkout mutavel do repositorio.
- O wrapper do runtime carrega `~/.depara/config.env` e chama `startServer()` explicitamente.
- Fluxos novos de update devem usar apenas `/api/update/auto/*`.
- Endpoints legados de update continuam expostos apenas para retornar `410 Gone`.
- O auto-update publica um novo release imutavel, troca o release ativo e preserva apenas o estado operacional em `~/.depara/data`.
- Testes nao devem depender de side effects em `backups/`, `logs/` ou `test-results/` do repositorio.
- Logging em `console` fica desligado por padrao em `production` e `test`.
- `Operacoes Agendadas` gerencia operacoes persistidas; nao e uma segunda superficie de modelagem.

## Ordem de leitura
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- [docs/INSTALLATION.md](docs/INSTALLATION.md)
- [docs/API.md](docs/API.md)
- [docs/TESTING.md](docs/TESTING.md)
- [docs/RP4-OPS.md](docs/RP4-OPS.md)
- [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)
