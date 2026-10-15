# INSTALLATION_CONTRACT

## Requisitos

| Requisito | Contrato |
|---|---|
| Windows | Windows 10/11 x64 como alvo operacional |
| Node.js | `>=18.15.0` |
| npm | `>=9.0.0` |
| Git | necessário somente para os fluxos de atualização |
| Chromium | necessário para os testes E2E |

PM2, systemd, shells Linux e Raspberry Pi não são requisitos nem caminhos suportados.

## Instalação local

Execute no PowerShell, na raiz do projeto:

```powershell
.\install.ps1 -Production
```

Para instalar também as dependências de desenvolvimento e executar a validação completa:

```powershell
.\install.ps1
npm run lint
npm run test:unit
npm run test:smoke
npm run test:e2e
npm run start:windows
```

URLs padrão:

- UI: `http://127.0.0.1:3000/ui`
- Health: `http://127.0.0.1:3000/health`
- Documentação da API: `http://127.0.0.1:3000/api/docs`

O processo é local e em primeiro plano. Para uma máquina lenta, prefira `NODE_ENV=production`, `LOG_LEVEL=warn`, `LOG_TO_CONSOLE=false` e `MAX_CONCURRENT_OPERATIONS=2`.

## Scripts

| Script | Contrato |
|---|---|
| `npm run start:windows` | inicia `src/main.js` no processo Windows local |
| `npm run start` | alias de inicialização local |
| `npm run dev` | inicia com `node --watch` para desenvolvimento |
| `npm run perf:audit` | executa auditoria com carga pequena e grava JSON em `performance-results/` |
| `npm run perf:audit:medium` | executa auditoria com carga média |
| `.\install.ps1 -Production` | instala o runtime Windows sem dependências de desenvolvimento |
| `install.bat` | equivalente interativo para instalação pelo Prompt de Comando |
| `npm run setup` | instala dependências npm |

## Persistência e configuração

Use `env.example` como modelo. Sem sobrescrita, o runtime fica em `%USERPROFILE%\.depara`:

| Variável | Padrão | Uso |
|---|---|---|
| `HOST` | `127.0.0.1` | endereço local de escuta |
| `PORT` | `3000` | porta HTTP |
| `NODE_ENV` | `production` no arquivo de runtime | modo de execução |
| `MAX_PAYLOAD` | `25mb` no código | limite de corpo HTTP; aumente somente se backups maiores forem necessários |
| `DEPARA_RUNTIME_ROOT` | `%USERPROFILE%\.depara` | raiz operacional |
| `DEPARA_DATA_DIR` | `<runtime>\data` | dados mutáveis |
| `DEPARA_LOG_DIR` | `<runtime>\logs` | logs |
| `DEPARA_BACKUP_DIR` | `<runtime>\backups` | backups |
| `DEPARA_TEMP_DIR` | `<runtime>\temp` | temporários |
| `DEPARA_ALLOWED_PATHS` | bases Windows padrão | substitui as bases permitidas |
| `MAX_CONCURRENT_OPERATIONS` | `2` | operações paralelas em lote |
| `MAX_RECURSION_DEPTH` | `20` | profundidade máxima de varredura |
| `DEPARA_MAX_IMAGE_RESULTS` | ilimitado | limite opcional de imagens mantidas na resposta |
| `DEPARA_HTTP_LOGGING` | ligado fora de produção | habilita logs HTTP combinados |
| `DEPARA_REQUEST_METADATA_LOGGING` | `false` | habilita metadados detalhados por requisição |
| `DEPARA_ENABLE_UPDATE_SCHEDULER` | `false` no Windows | habilita explicitamente o agendador de atualização |

Para limitar o escopo de filesystem, use `DEPARA_ALLOWED_PATHS` separado por `;`, por exemplo:

```powershell
$env:DEPARA_ALLOWED_PATHS = "C:\Users\Nicole\Documents;D:\Dados"
```

## Atualização

O módulo de atualização é opcional, desativado por padrão e não reinicia o processo automaticamente no Windows. Quando uma atualização exigir reinício, o endpoint retorna `windows_restart_required`; encerre e inicie novamente com `npm run start:windows` após revisar o estado.

## Pós-inicialização

```powershell
Invoke-RestMethod http://127.0.0.1:3000/health
Invoke-RestMethod http://127.0.0.1:3000/api/status
Invoke-RestMethod http://127.0.0.1:3000/api/status/resources
Invoke-RestMethod http://127.0.0.1:3000/api/update/auto/status
Invoke-RestMethod http://127.0.0.1:3000/api/update/auto/diagnostics
```

## Máquina lenta

1. Execute `npm run perf:audit -- --profile=small` antes de alterar limites.
2. Compare `durationMs`, `memoryDelta.rss` e `memoryDelta.heapUsed` no JSON gerado.
3. Mantenha `MAX_CONCURRENT_OPERATIONS=1` ou `2` se o disco ficar saturado.
4. Defina `DEPARA_MAX_IMAGE_RESULTS` quando o slideshow não precisar carregar a pasta inteira.
5. Deixe logs HTTP e metadados detalhados desligados durante o uso normal.
