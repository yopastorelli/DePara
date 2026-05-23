# Troubleshooting

## UI quebra no carregamento
```bash
npm run lint
npm run test:e2e
```
- Suspeita principal: regressão em `src/public/app.js`, `index.html` ou módulos carregados pela UI
- Verifique também se textos user-facing ficaram com mojibake após a última alteração

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
- Confirme que a operação não está saindo da política de segurança esperada

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

## Menu do RP4 não abre a aplicação
```bash
pm2 status
curl -s http://127.0.0.1:3000/health
$HOME/DePara/start-depara.sh status
cat ~/.local/share/applications/depara.desktop
```
- O backend precisa estar saudável antes do menu abrir a UI
- O `Exec=` do `.desktop` deve apontar para `start-depara.sh open`
- Se o launcher falhar, corrija primeiro o PM2

## Texto com acentos quebrados
```bash
rg -n "Ã|â€™|â€œ|â€|�" README.md docs src/public src/routes
```
- Se o problema aparecer só no terminal, confirme o conteúdo real do arquivo em UTF-8
- Se o problema aparecer na UI ou no JSON, trate como mojibake real do arquivo fonte

## Legado que não deve voltar para fluxos novos
- Endpoints legados de update
- Restart direto pela UI fora do PM2
- Escrita de backup/logs no repositório por padrão
