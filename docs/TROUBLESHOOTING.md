# TROUBLESHOOTING_CONTRACT

DOC_AUDIENCE=AI_development_agents
PLATFORM_CONTRACT=Windows_only

## Porta e processo

- `3000` é a porta padrão.
- O processo correto é iniciado por `npm run start:windows`.
- PM2, systemd e launchers Linux não são caminhos de diagnóstico.

Verifique o processo no PowerShell:

```powershell
Get-Process node -ErrorAction SilentlyContinue
Invoke-RestMethod http://127.0.0.1:3000/health
Invoke-RestMethod http://127.0.0.1:3000/api/status
npm run doctor:windows
```

Para iniciar, use `npm run start:windows`. Para encerrar a instância oculta, use `npm run stop:windows`; `Ctrl+C` não é o procedimento correto para esse launcher.

## Instalação ou release ausente

```powershell
git --version
tar --version
node --version
npm --version
.\install.ps1 -Production -CreateShortcut -Start
npm run doctor:windows
```

O instalador precisa de Git for Windows e `tar` porque o release imutável é criado por `git archive` e extraído antes da inicialização.

Se `doctor-windows.ps1` indicar release ausente, execute:

```powershell
npm run deploy:windows
npm run stop:windows
npm run start:windows
```

## Instâncias duplicadas ou porta ocupada

```powershell
npm run doctor:windows
npm run stop:windows
npm run start:windows
Invoke-RestMethod http://127.0.0.1:3000/health
```

O launcher oficial é idempotente e procura somente comandos Node do DePara. Não encerre processos Node do Codex, Playwright ou outras aplicações.

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

Consulte primeiro:

```powershell
Invoke-RestMethod http://127.0.0.1:3000/api/status/resources
```

Em `warning`, a paginação é reduzida. Em `critical`, novas indexações retornam `503` para proteger a máquina; isso não significa que o processo tenha falhado.

## Configuração não persiste

```powershell
Invoke-RestMethod http://127.0.0.1:3000/api/config
Get-ChildItem "$env:USERPROFILE\.depara\data"
```

Confirme `DEPARA_DATA_DIR`, `DEPARA_CONFIG_FILE`, permissões de escrita e se o processo usa o runtime esperado.

## Operação de arquivo interrompida ou parcial

```powershell
Invoke-RestMethod http://127.0.0.1:3000/api/files/recovery
Invoke-RestMethod http://127.0.0.1:3000/api/files/operations/<operationId>
```

- `conflict`: o destino já existia; confirme o arquivo original e decida entre manter, restaurar ou repetir com `options.overwrite=true`.
- `partial`: pelo menos um item falhou; não repita cegamente o lote. Leia `counts` e o journal para identificar os itens.
- `interrupted`: o processo foi encerrado durante a operação; aguarde a reconciliação automática após o próximo início.
- `cancelled`: o cancelamento é cooperativo; confirme o estado final antes de mover ou remover manualmente qualquer arquivo.
- Não apague `data\file-operations` nem `quarantine` para “destravar” a aplicação. Esses diretórios são a evidência e a possibilidade de recuperação.

Para restaurar um item de exclusão ou overwrite, use somente a rota autenticada pelo contrato local e confirme previamente que o caminho original não foi recriado:

```powershell
Invoke-RestMethod http://127.0.0.1:3000/api/files/recovery/<entryId>/restore -Method Post
```

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

## Foto cortada, cursor oculto ou teclado sem resposta

- Confira o release ativo e recarregue a página depois de atualizar; uma aba aberta anteriormente pode continuar executando JavaScript e CSS antigos.
- No visualizador, use `←`/`→`, `Espaço`, `F11` e `Esc`. A primeira foto não tem anterior, e o botão correspondente fica desabilitado. Campos de texto e combinações com Ctrl/Alt/Meta não devem ser capturados pelo slideshow.
- A foto deve aparecer inteira, com barras vazias quando necessário. Não troque `object-fit: contain` por `cover` nem remova os limites de altura do centro do visualizador.
- O cursor não deve ser ocultado durante slideshow manual. O timer de inatividade fica suspenso até fechar o visualizador.
- O botão de fullscreen fica temporariamente desabilitado durante uma transição. Se o navegador recusar fullscreen nativo, o slideshow continua preenchendo a janela sem recortar a foto.
- Reproduza os testes de `docs/UI-UX-AUDIT.md` antes de adicionar novas regras ou estilos inline para contornar um problema visual.

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
