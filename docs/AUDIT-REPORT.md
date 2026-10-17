# Relatório de auditoria geral

AUDIT_DATE=2026-10-14
AUDIT_PLATFORM=Windows_only
AUDIT_SCOPE=application_code_runtime_installation_documentation_memory_security
AUDIT_STATUS=historical_baseline_with_ui_followup

## Escopo

A auditoria cobriu o código do servidor e da UI, persistência, rotas, migrações, scripts de instalação/execução, runtime imutável, coexistência com o Codex, documentação, dependências, testes e perfil de memória.

A revisão inicial foi feita no checkout `C:\DePara`, a partir do commit `19e8356`. As evidências numéricas abaixo são o snapshot de 2026-10-14, não uma medição permanente do estado atual. A revisão de UI e UX de 2026-10-17 está em `docs/UI-UX-AUDIT.md`.

## Decisões aplicadas

- A plataforma suportada foi fixada em Windows 10/11 x64; instruções de Linux, Raspberry Pi, PM2, systemd, Docker e Python foram removidas do contrato do produto.
- O arquivo raiz obsoleto `Plano DePara` foi excluído.
- O instalador canônico passou a ser `install.ps1`; `install.bat` apenas delega para ele.
- A instalação usa `npm ci`, cria configuração sem sobrescrever dados existentes, prepara release imutável, cria atalho opcional e valida o health check.
- O launcher Windows é idempotente e não cria uma segunda instância do DePara; `stop`, `doctor` e `shortcut` têm scripts próprios.
- Métodos de UI duplicados e executores legados sem referências foram removidos. A persistência do quick setup foi corrigida para chamar `saveFolderToServer`.
- Os separadores de linha inválidos que existiam no `src/public/app.js` foram normalizados para que diffs, linters e agentes leiam o arquivo de forma determinística.
- Migrações de dados antigas que ainda possuem chamadas foram preservadas somente para promover dados ao runtime canônico; não foram reintroduzidos consumidores legados.
- O perfil `codex-coexistence` mantém concorrência unitária, preload desligado, paginação adaptativa, catálogo em disco e contenção por memória.

## Evidências executadas

| Gate | Resultado | Evidência |
|---|---|---|
| Sintaxe | PASS | parser PowerShell e `node --check` para UI, servidor e bootstrap |
| Lint | PASS | `npm run lint` |
| Unitários | PASS | 14 suites, 64 testes; `npm run test:unit -- --testTimeout=60000` |
| Smoke | PASS | 1 suite, 8 testes; `npm run test:smoke -- --testTimeout=60000` |
| E2E | PASS | 5 testes Playwright; `npm run test:e2e` |
| Agregado | PASS | `npm run test:all` |
| Dependências | PASS | `npm audit --audit-level=high`: 0 vulnerabilidades |
| Performance small | PASS | health 314,5 ms; status concorrente x5 77,52 ms; RSS final 67,6 MiB |
| Runtime local | PASS | `doctor-windows.ps1`: processo único, PID 14252, health `OK`, release ativo presente |
| Launcher | PASS | segunda chamada não duplicou o processo |
| Atalho | PASS | `C:\Users\Nicole\Desktop\DePara.lnk` criado/atualizado |

## Snapshot de coexistência

No momento da auditoria, o host `DESKTOP-PAKO2GF` tinha aproximadamente `1.241 MB` livres de `8.078 MB` visíveis. O DePara estava no PID `14252`, com RSS de `57,5 MB`, prioridade `BelowNormal`, escutando na porta `3000`; os processos observados do Codex somavam aproximadamente `515,8 MB` de RSS. Essa fotografia confirma coexistência funcional neste instante, não uma garantia para qualquer carga futura ou outra máquina.

## Avaliação de memória

O perfil atual é adequado para uma máquina lenta, mas não autoriza uma garantia abstrata de que qualquer máquina ficará confortável. A medição local mostrou o processo do DePara na faixa de aproximadamente 54–68 MiB de RSS durante os cenários auditados; o runtime aplica heap máximo de 128 MiB no launcher e rejeita novas indexações sob pressão.

A evidência é específica desta máquina. Em outra máquina, repetir pelo menos `npm run perf:audit -- --profile=small`, `npm run perf:audit:medium` e um catálogo real acima de 5.000 imagens antes de elevar concorrência, página ou preload.

## Critérios de publicação

- Não transformar um working tree em release imutável: primeiro validar e identificar o commit, e depois conferir publicação e runtime separadamente.
- Depois de um commit validado, executar `node bootstrap-runtime-release.js`, reiniciar com `npm run stop:windows` e `npm run start:windows`, e fechar com `npm run doctor:windows`. Recarregar a UI para não manter JavaScript/CSS antigos no navegador.
- A certificação da outra máquina exige medir memória livre, processo do Codex, DePara, health, processo único e comportamento do slideshow no mesmo host.

## Regra para agentes

Um agente só pode declarar a instalação pronta quando o checkout estiver limpo, a revisão estiver identificada, os gates passarem, o release ativo apontar para essa revisão, existir uma única instância e `/health`, `/api/status` e `/api/status/resources` responderem. Teste verde no checkout não substitui diagnóstico do runtime.
