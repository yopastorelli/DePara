# TROUBLESHOOTING_CONTRACT

## Porta e processo

- `3000` é a porta padrão.
- O processo correto é iniciado por `npm run start:windows`.
- PM2, systemd e launchers Linux não são caminhos de diagnóstico.

Verifique o processo no PowerShell:

```powershell
Get-Process node -ErrorAction SilentlyContinue
Invoke-RestMethod http://127.0.0.1:3000/health
Invoke-RestMethod http://127.0.0.1:3000/api/status
```

## UI não carrega

```powershell
npm run lint
npm run test:e2e
Invoke-RestMethod http://127.0.0.1:3000/health
Invoke-RestMethod http://127.0.0.1:3000/api/status
```

Principais suspeitos:

- erro de parser em `src/public/app.js`;
- regressão de rota estática em `src/main.js`;
- API falhando antes da hidratação da UI;
- limite de requisições baixo durante o bootstrap;
- `HOST` ou `PORT` divergente do navegador.

## API offline na UI, mas health está OK

```powershell
Invoke-WebRequest http://127.0.0.1:3000/api/status -UseBasicParsing
Invoke-WebRequest http://127.0.0.1:3000/api/config -UseBasicParsing
```

Verifique `429` do rate limiter, rota antiga no frontend, CSP e se o navegador acessa o mesmo loopback do processo.

## Operação de arquivo retorna acesso negado

```powershell
$env:DEPARA_ALLOWED_PATHS
npm run test:smoke
```

Confirme que o caminho está em uma base permitida, não contém `../` ou `..\`, não escapa por symlink e que o pai do destino existe. No Windows, separe bases com `;`.

## Slideshow não lista imagens

```powershell
$body = @{ folderPath = 'C:\Dados\Imagens'; extensions = @('.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'); recursive = $true } | ConvertTo-Json
Invoke-RestMethod http://127.0.0.1:3000/api/files/list-images -Method Post -ContentType 'application/json' -Body $body
```

Verifique `validateSafePath`, extensões com ponto, regras de arquivos ignorados e `DEPARA_MAX_IMAGE_RESULTS`.

## Memória ou lentidão

```powershell
npm run perf:audit -- --profile=small
npm run perf:audit:medium
```

Compare `durationMs`, `memoryDelta.rss` e `memoryDelta.heapUsed` entre execuções do mesmo perfil. Reduza `MAX_CONCURRENT_OPERATIONS`, defina `DEPARA_MAX_IMAGE_RESULTS` e mantenha logs HTTP desligados antes de investigar otimizações mais profundas.

## Configuração não persiste

```powershell
Invoke-RestMethod http://127.0.0.1:3000/api/config
Get-ChildItem "$env:USERPROFILE\.depara\data"
```

Confirme `DEPARA_DATA_DIR`, `DEPARA_CONFIG_FILE`, permissões de escrita e se o processo usa o runtime esperado.

## Atualização travada ou insegura

```powershell
Invoke-RestMethod http://127.0.0.1:3000/api/update/auto/status
Invoke-RestMethod http://127.0.0.1:3000/api/update/auto/diagnostics
```

No Windows, `runtime.supervisor.supervisor` deve ser `windows-process`. `runtime.scheduler.stale=true` exige verificar a configuração do scheduler. `runtime.lastFailureStage` indica o primeiro estágio a investigar. Reinícios são manuais e não devem chamar PM2 ou systemd.

## Playwright não inicia

```powershell
npx playwright install chromium
npm run test:e2e
```

## Auditoria de dependências falha

```powershell
npm audit --audit-level=high
npm ls js-yaml picomatch --all
```

Preserve os overrides de `package.json` até que uma nova instalação e toda a suíte confirmem a remoção segura.

## Codificação parece quebrada

```powershell
rg -n "Ã[ƒ‚]|â[€™€œ€]|\x{00D2}|\x{FFFD}" README.md docs src/public src/routes
```

Se o problema estiver no source, corrija UTF-8; se estiver somente no terminal, não regrave os arquivos.
