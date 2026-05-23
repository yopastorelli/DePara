# DePara

Superfície operacional canônica para IA desenvolvedora e operação RP4.

## Release Gate
```bash
npm run lint
npm run test:unit
npm run test:smoke
npm run test:e2e
```

UI local:
- `http://127.0.0.1:3000/ui`

Health:
- `http://127.0.0.1:3000/health`
- `http://127.0.0.1:3000/api/health`

## Fonte de verdade
- Entrada HTTP: `src/main.js`
- Versão e engines: `package.json`
- Dados persistidos: `DEPARA_DATA_DIR` ou `data/`
- Runtime operacional RP4: `DEPARA_RUNTIME_ROOT` ou `~/.depara`
- Docs canônicas: [docs/README.md](docs/README.md)

## Invariantes de go live
- PM2 é o supervisor obrigatório da aplicação no RP4.
- `systemd` existe só para bootstrap do runtime PM2.
- Novos fluxos devem usar apenas `/api/update/auto/*`.
- Testes não podem depender de side effects em `backups/`, `logs/` ou `test-results/` do repositório.
- Não incluir em commit: `.claude/`, `backups/`, `test-results/`.
- Logging em `console` fica desligado por padrão em `production` e `test`; debug só por flag explícita.
- `fileops` continua sendo a superfície canônica para `move`, `copy`, `delete` e agendamento derivado do mesmo draft.

## Ordem de leitura para IA
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- [docs/INSTALLATION.md](docs/INSTALLATION.md)
- [docs/RP4-OPS.md](docs/RP4-OPS.md)
- [docs/TESTING.md](docs/TESTING.md)
- [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)
