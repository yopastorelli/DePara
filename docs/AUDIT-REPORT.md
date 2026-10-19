# Relatório de auditoria geral para agentes de IA

AUDIT_DATE=2026-10-19
AUDIT_PLATFORM=Windows_only
DOC_AUDIENCE=AI_development_agents
AUDIT_SCOPE=application_code_runtime_installation_documentation_memory_security
AUDIT_SCOPE_EXTENSION=file_mutation_integrity_interruption_recovery
AUDIT_STATUS=local_sync_implemented_pending_two_drive_pilot
AUDIT_VALIDATED_APPLICATION_REVISION=working-tree-after-tests

## Escopo

A auditoria cobre código do servidor e da UI, persistência, rotas, migrações, scripts de instalação e execução, runtime imutável, coexistência com o Codex, documentação, dependências, testes, segurança de filesystem e perfil de memória.

Esta rodada valida a revisão do código no checkout após as alterações de segurança. A ativação do release precisa ser conferida separadamente por `current/release.json` e `npm run doctor:windows`.

## Resultado da auditoria de produto

O produto fica reduzido a cinco superfícies explícitas e sem sobreposição:

1. `Dashboard`: saúde do runtime e acesso ao slideshow;
2. `Operações de Arquivos`: draft de operação única e modo de sincronização local com preview e jobs próprios;
3. `Operações Agendadas`: lista, busca, pausa, edição, duplicação, execução e progresso;
4. `Backup e Recuperação`: backup operacional formato 2, importação transacional, quarentena e versões de sincronização;
5. `Configurações`: configuração do runtime e do screensaver.

Workflows, templates, conversão, mapeamento, drag-and-drop e ações de operação duplicadas não fazem parte da nova jornada visível. Rotas e helpers de compatibilidade ainda existentes são limites para dados/clientes antigos; agentes não devem criar novos consumidores deles.

Critérios funcionais aplicados:

- nenhum arquivo é criado por onboarding ou configuração rápida;
- uma operação de arquivo não inicia enquanto o draft estiver incompleto;
- `copy`, `move` e `delete` usam o journal transacional, mostram progresso e permitem cancelamento cooperativo;
- `delete` e substituição permanecem em quarentena até restauração ou limpeza explicitamente auditada;
- frequência inválida é rejeitada com `400`, sem fallback para um minuto;
- importação operacional grava `prepared`/`applying`/`committed` no journal e reverte o snapshot anterior após falha ou reinício interrompido;
- a UI não solicita permissão de notificação nem carrega templates, gráficos ou catálogos no bootstrap.

## Decisões aplicadas

Auditoria de auto-update em 2026-10-19: a instalação examinada estava com `enabled=false`/`autoApply=false`, o launcher forçava bloqueio do scheduler e dos efeitos, o orquestrador não iniciava com o servidor e o reinício automático lançava erro. Corrigidos o opt-in do launcher, inicialização no boot, status real do timer, proteção de worktree/recursos, instalação exclusiva pelo lockfile e handoff transitório com encerramento autenticado somente quando ocioso. O helper valida a revisão carregada e tenta rollback de falha de startup, sem iniciar instância duplicada quando uma parada segura é recusada. Ensaios com processos reais em runtime/porta descartáveis confirmaram adiamento por ocupação, ativação e rollback de release propositalmente quebrado. Ativação no runtime real é um gate separado e exige opt-in autorizado; não inferi-la dos testes.

Evidência desta correção: regressão completa com 19 suítes/111 testes, smoke com oito testes e Playwright com 22 testes aprovados; após ajustes finais, sete suítes/33 testes focados de atualização/bootstrap também aprovados, incluindo recuperação do ponteiro `.previous`. Lint, `git diff --check` e auditoria de dependências aprovados, sem vulnerabilidades. O runtime real permaneceu em `d110b28`, saudável e com atualização automática desabilitada durante os ensaios; publicação/ativação desta correção permanece uma etapa separada.

Extensão de sincronização: contrato `LOCAL-SYNC.md`; fila compartilhada, SHA-256 streaming, destino NTFS com publicação exclusiva, atual mais 1/3/5 anteriores, recuperação por journal e comparação incremental. Jobs importados ficam pausados. O teste sintético de arquivo de 1 GiB terminou com pico de RSS de 127,2 MiB; preview de 5.000 arquivos atingiu 66,8 MiB. Esses números não certificam dois HDs físicos, latência p95 com carga real ou a máquina definitiva. Ativação e piloto permanecem gates distintos da implementação.

Validação da extensão: regressão Jest completa com 16 suítes/100 testes aprovados; revisão focada de segurança/configuração/smoke com 47 testes; rodada final de sincronização com 22 testes. Playwright completo: 22 aprovados; os seis fluxos afetados foram repetidos isoladamente e passaram. Lint e auditoria de dependências passaram, sem vulnerabilidades. Houve timeouts de validadores quando executados junto do benchmark de 50.000 arquivos; as repetições isoladas passaram, sem alterar limites do produto. Preview de 50.000 entradas teve pico de 79,1 MiB. O ciclo sintético com helper Win32 real também passou. Somente C: está disponível como volume NTFS gravável no host inspecionado; não montar, formatar ou modificar outros discos para fabricar um piloto. Commit, publicação e ativação do release não fazem parte desta evidência.

- A plataforma suportada é Windows 10/11 x64. Linux, macOS, Raspberry Pi, PM2, systemd, Docker, Python e integrações `.desktop` estão fora do contrato.
- `AGENTS.md` é a entrada normativa para agentes de desenvolvimento com IA; `docs/README.md` é o índice detalhado. Não existe tutorial operacional humano como segunda fonte de verdade.
- `install.ps1` é o único instalador documentado. Ele executa `npm ci` ou `npm ci --omit=dev`, preserva configuração existente, prepara o release imutável, cria os atalhos da Área de Trabalho e do Menu Iniciar quando solicitado e pode iniciar o processo oculto.
- O launcher Windows é idempotente e não cria uma segunda instância do DePara; `stop`, `doctor`, `shortcut` e `deploy` têm comandos próprios.
- O servidor permanece em `127.0.0.1`, com concorrência unitária, preload desligado, paginação adaptativa, catálogo em disco, logs HTTP desligados e contenção por pressão de memória.
- A superfície visível da UI não usa métodos duplicados de workflow/template/conversão; helpers de compatibilidade permanecem isolados para não quebrar dados antigos. O onboarding não cria pastas, templates ou arquivos.
- Migrações antigas só promovem dados para o runtime canônico; código novo não grava em locais legados.
- `copy`, `move` e `delete` usam journal durável, publicação atômica, limite de concorrência unitária e reconciliação no próximo início.
- Destinos não são sobrescritos sem `options.overwrite=true`; exclusões e destinos substituídos entram em quarentena restaurável.
- Lotes devolvem conflito/parcial explicitamente; falhas por item não são convertidas em sucesso HTTP.
- O encerramento Windows tenta drenar operações por até 30 segundos antes de usar encerramento forçado como último recurso.
- Ações do slideshow normalizam separadores Windows antes de montar destinos de favoritar, ocultar, ajustar e excluir.
- Rotas `410` e endpoints de compatibilidade existentes são guardas para clientes antigos, não caminhos novos de instalação, desenvolvimento ou integração.

## Evidências executadas

| Gate | Resultado | Evidência |
|---|---|---|
| Sintaxe | PASS | `node --check` para UI, servidor e bootstrap; parser PowerShell para scripts de instalação e operação |
| Lint | PASS | `npm run lint` |
| Unitários/backend | PASS | 16 suítes, 100 testes; `npm run test:unit -- --testTimeout=60000`; rodadas focadas finais também aprovadas |
| Segurança de arquivos | PASS | 9 cenários em `tests/fileSafety.test.js`: atomicidade, conflito, overwrite protegido, restauração, diretório, lote parcial, `recursive=false`, concorrência e retomada |
| Smoke | PASS | 1 suíte, 8 testes; `npm run test:smoke -- --testTimeout=60000` |
| E2E | PASS | 22 testes Playwright com um worker; seis fluxos afetados repetidos isoladamente com sucesso |
| Encerramento | PASS | startup isolado, token local e shutdown gracioso autenticado; sem tocar no processo produtivo |
| Agregado | PASS | `npm run test:all` |
| Dependências | PASS | `npm audit --audit-level=high`: 0 vulnerabilidades |
| Performance small | PASS | health 210,22 ms; recursos 23,01 ms; concorrente x5 69,51 ms; RSS final 75,4 MiB |
| Performance medium | PASS | health 94,92 ms; recursos 24,34 ms; concorrente x5 75,20 ms; RSS final 78,8 MiB |
| Runtime local | GATE SEPARADO | o release local não foi ativado nesta auditoria; conferir `current/release.json` e `npm run doctor:windows` após deploy |
| Launcher | GATE SEPARADO | não reiniciado nesta rodada para preservar o processo DePara existente |
| Atalhos | GATE SEPARADO | não reescritos nesta rodada; validar após publicação do release |
| Dependências de navegador | PASS | Chromium instalado para a suíte E2E; não é requisito do runtime de produção |

## Instalação reproduzível

O fluxo que outro agente deve repetir em uma máquina Windows nova é:

```powershell
git clone https://github.com/yopastorelli/DePara.git C:\DePara
Set-Location C:\DePara
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\install.ps1 -Production -CreateShortcut -Start
npm run doctor:windows
```

Os pré-requisitos são Node.js `>=18.15.0`, npm `>=9.0.0`, Git for Windows e `tar` no `PATH`. Os checks mínimos são `node --version`, `npm --version`, `git --version` e `tar --version`. O agente deve confirmar também `/health`, `/api/status`, `/api/status/resources`, `%USERPROFILE%\.depara\current\release.json` e os dois atalhos.

## Avaliação de memória e coexistência

O perfil `codex-coexistence` é adequado para a máquina auditada: o processo usa heap Node limitada a 128 MiB, prioridade `BelowNormal`, uma operação por vez, preload desligado, páginas menores sob pressão e bloqueio de novas indexações em estado crítico. Na medição atual, o RSS final foi 75,4 MiB no perfil `small` e 78,8 MiB no perfil `medium`.

RSS do processo Node não inclui a memória do navegador, nem buffers gráficos ou a memória dos processos do Codex. A imagem original também pode exigir aproximadamente `48,8 MiB` somente em pixels RGBA para uma foto de `3096 × 4128`. Portanto, esses números comprovam o comportamento do servidor nesta máquina, mas não garantem conforto em qualquer hardware.

Na máquina nova, repita os perfis `small` e `medium`, valide um catálogo real acima de 5.000 imagens e registre memória livre, DePara, Codex, navegador, processo único e resposta dos endpoints. Não aumente concorrência, página ou preload sem evidência.

As medições de RSS não certificam integridade de mutações. Para essa parte, a evidência mínima é a suíte de segurança e a inspeção de `%USERPROFILE%\.depara\data\file-operations` e `%USERPROFILE%\.depara\quarantine` depois de uma interrupção controlada.

## UI, responsividade e slideshow

O contrato visual validado em `docs/UI-UX-AUDIT.md` usa uma barra superior única, foto limitada pela área disponível com `object-fit: contain`, foco e teclado previsíveis, fullscreen serializado e intervalo configurável de 1 a 300 segundos. A suíte cobre seis viewports, incluindo telas estreitas e baixas, e verifica ausência de overflow e recorte.

O intervalo padrão é 10 segundos; os presets chegam a 300 segundos e valores existentes não são sobrescritos automaticamente. Cache legado do navegador não pode substituir uma configuração já persistida no servidor.

## Critérios de publicação

Um agente só pode declarar uma instalação pronta quando:

1. a revisão do checkout estiver identificada e o working tree estiver limpo;
2. `npm ci`, lint, unit, smoke, E2E e auditoria de dependências passarem;
3. `current/release.json` apontar para a revisão validada;
4. existir no máximo uma instância do processo Windows;
5. `/health`, `/api/status` e `/api/status/resources` responderem;
6. os atalhos solicitados apontarem para `scripts/open-depara.ps1` e abrirem a UI no navegador padrão;
7. nenhuma operação concluída deixar arquivo `.depara-partial-*` ou transformar conflito em sucesso;
8. nenhum dado mutável, log, backup, resultado de teste, credencial ou foto pessoal estiver no Git.

Teste verde no checkout não substitui diagnóstico do runtime. A ativação do release e a validação na máquina de destino são gates separados; um push remoto não certifica o runtime local.
