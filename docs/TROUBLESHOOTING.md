# Troubleshooting

## UI quebra no carregamento
```bash
npm run lint
npm run test:e2e
```
- Suspeita principal: regressão em `src/public/app.js` ou módulos carregados por `index.html`

## Config não persiste
```bash
curl -s http://127.0.0.1:3000/api/config
```
- Verifique `DEPARA_DATA_DIR`
- Verifique `DEPARA_CONFIG_FILE`
- Verifique permissão de escrita do runtime

## Operações de arquivo falham
```bash
npm run test:smoke
```
- Valide `sourcePath`, `targetPath` e permissões do diretório real
- Verifique `DEPARA_BACKUP_DIR` e `DEPARA_TEMP_DIR`
- Confirme que a operação não está usando caminho fora da política de segurança

## Update em estado estranho
```bash
pm2 status
pm2 logs DePara --lines 100
curl -s http://127.0.0.1:3000/api/update/auto/status
curl -s http://127.0.0.1:3000/api/update/auto/diagnostics
```
- Se `runtime.supervisor.pm2.registered=false`, o auto-update não pode rodar
- Se `runtime.scheduler.stale=true`, trate como processo sem persistência ou scheduler morto
- Se `runtime.lastFailureStage` estiver preenchido, trate essa etapa como causa raiz

## Legado interno que não deve voltar para fluxos novos
- Endpoints legados de update
- Restart direto pela UI fora do PM2
- Escrita de backup/logs no repositório por default
