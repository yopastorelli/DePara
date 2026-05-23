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

## Menu do RP4 não abre a aplicação
```bash
pm2 status
curl -s http://127.0.0.1:3000/health
$HOME/DePara/start-depara.sh status
cat ~/.local/share/applications/depara.desktop
```
- O backend precisa estar saudável antes do menu abrir a UI
- O `Exec=` do `.desktop` deve apontar para `start-depara.sh open`
- Se o launcher falhar, corrija primeiro o PM2; o menu não deve iniciar servidor por fora

## Worktree sujo bloqueando auto-update
```bash
git status --short
git diff --summary
```
- O runtime normal não deve alterar permissões de `start-depara.sh`
- Se o bloqueio vier só de modo de arquivo, normalize e valide qual script ainda está fazendo `chmod` em arquivo rastreado

## Legado interno que não deve voltar para fluxos novos
- Endpoints legados de update
- Restart direto pela UI fora do PM2
- Escrita de backup/logs no repositório por default
