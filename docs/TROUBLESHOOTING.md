# Troubleshooting

## UI não abre ou quebra no carregamento
```bash
npm run lint
npm run test:unit
```
- Suspeita principal: parser quebrado em `src/public/app.js`.

## Config não persiste
```bash
curl -s http://127.0.0.1:3000/api/config
```
- Verifique `DEPARA_DATA_DIR` e `DEPARA_CONFIG_FILE`.
- Verifique escrita em `data/depara-config.json`.

## Operações de arquivo falham
```bash
npm run test:smoke
```
- Valide `sourcePath`, `targetPath` e permissões do diretório real.
- Valide as restrições de `validateSafePath`.

## Update em estado estranho
```bash
curl -s http://127.0.0.1:3000/api/update/auto/status
curl -s http://127.0.0.1:3000/api/update/auto/diagnostics
```
- Em teste, confirme `DEPARA_DISABLE_UPDATE_SIDE_EFFECTS=true`.
- Em RP4 real, confirme PM2 ou systemd configurados.

## Navegação rápida para IA
- Arquitetura: [ARCHITECTURE.md](ARCHITECTURE.md)
- Testes: [TESTING.md](TESTING.md)
- Operação RP4: [RP4-OPS.md](RP4-OPS.md)
