# Relatório de auditoria geral para agentes de IA

AUDIT_DATE=2026-10-18
AUDIT_PLATFORM=Windows_only
DOC_AUDIENCE=AI_development_agents
AUDIT_SCOPE=application_code_runtime_installation_documentation_memory_security
AUDIT_SCOPE_EXTENSION=file_mutation_integrity_interruption_recovery
AUDIT_STATUS=working_tree_validation
AUDIT_VALIDATED_APPLICATION_REVISION=working-tree-after-tests

## Escopo

A auditoria cobre código do servidor e da UI, persistência, rotas, migrações, scripts de instalação e execução, runtime imutável, coexistência com o Codex, documentação, dependências, testes, segurança de filesystem e perfil de memória.

Esta rodada valida o working tree após as alterações de segurança; ainda não há commit novo. O release ativo precisa ser conferido separadamente por `current/release.json` e `npm run doctor:windows`.

## Decisões aplicadas

- A plataforma suportada é Windows 10/11 x64. Linux, macOS, Raspberry Pi, PM2, systemd, Docker, Python e integrações `.desktop` estão fora do contrato.
- `AGENTS.md` é a entrada normativa para agentes de desenvolvimento com IA; `docs/README.md` é o índice detalhado. Não existe tutorial operacional humano como segunda fonte de verdade.
- `install.ps1` é o único instalador documentado. Ele executa `npm ci` ou `npm ci --omit=dev`, preserva configuração existente, prepara o release imutável, cria os atalhos da Área de Trabalho e do Menu Iniciar quando solicitado e pode iniciar o processo oculto.
- O launcher Windows é idempotente e não cria uma segunda instância do DePara; `stop`, `doctor`, `shortcut` e `deploy` têm comandos próprios.
- O servidor permanece em `127.0.0.1`, com concorrência unitária, preload desligado, paginação adaptativa, catálogo em disco, logs HTTP desligados e contenção por pressão de memória.
- Métodos de UI duplicados e executores sem referências foram removidos. A persistência do quick setup chama `saveFolderToServer`.
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
| Unitários | PASS | 15 suítes, 75 testes; `npm run test:unit` |
| Segurança de arquivos | PASS | 9 cenários em `tests/fileSafety.test.js`: atomicidade, conflito, overwrite protegido, restauração, diretório, lote parcial, `recursive=false`, concorrência e retomada |
| Smoke | PASS | 1 suíte, 8 testes; `npm run test:smoke -- --testTimeout=60000` |
| E2E | PASS | 21 testes Playwright com um worker; `npm run test:e2e` |
| Encerramento | PASS | startup isolado, token local e shutdown gracioso autenticado; sem tocar no processo produtivo |
| Agregado | PASS | `npm run test:all` |
| Dependências | PASS | `npm audit --audit-level=high`: 0 vulnerabilidades |
| Performance small | PASS | health 223,52 ms; recursos 21,56 ms; concorrente x5 71,45 ms; RSS final 76,2 MiB |
| Performance medium | PASS | health 94,36 ms; recursos 24,12 ms; concorrente x5 70,87 ms; RSS final 78,7 MiB |
| Runtime local | GATE SEPARADO | o working tree não foi publicado; conferir `current/release.json` e `npm run doctor:windows` após deploy |
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

O perfil `codex-coexistence` é adequado para a máquina auditada: o processo usa heap Node limitada a 128 MiB, prioridade `BelowNormal`, uma operação por vez, preload desligado, páginas menores sob pressão e bloqueio de novas indexações em estado crítico. Na medição atual, o RSS final foi 76,2 MiB no perfil `small` e 78,7 MiB no perfil `medium`.

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

Teste verde no checkout não substitui diagnóstico do runtime. Publicação no remoto, ativação do release e validação na máquina de destino são gates separados.
