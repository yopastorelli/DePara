# DePara

Superfície operacional canônica para IA desenvolvedora.

## Começo rápido
```bash
npm ci
npm run lint
npm run test:unit
npm run test:smoke
npm run start
```

UI local:
- `http://127.0.0.1:3000/ui`

Health:
- `http://127.0.0.1:3000/health`
- `http://127.0.0.1:3000/api/health`

## Fonte de verdade
- Código de entrada: `src/main.js`
- Versão e engines: `package.json`
- Config persistida: `data/depara-config.json`
- Estado de update: `data/update-*.json`, `data/update-history.log`
- Docs canônicas: [docs/README.md](docs/README.md)

## Invariantes para IA
- Use `package.json` como única fonte de versão e requisitos.
- Não reintroduza documentação paralela na raiz.
- Não execute fluxos destrutivos de update em testes; use `DEPARA_DISABLE_UPDATE_SIDE_EFFECTS=true`.
- Valide mudanças com `lint`, `test:unit`, `test:smoke` e, quando disponível, `test:e2e`.

## Vibe Coding
- Comece por [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
- Use [docs/TESTING.md](docs/TESTING.md) para subir a stack de verificação.
- Use [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) quando um fluxo quebrar.
