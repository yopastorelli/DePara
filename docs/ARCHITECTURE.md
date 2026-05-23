# Arquitetura Operacional

## Contexto mínimo
- Backend Express: `src/main.js`
- UI estática: `src/public/index.html` + `src/public/app.js`
- Rotas canônicas: `src/routes/*`
- Persistência funcional: `src/utils/configStore.js`
- Auto-update: `src/services/updateOrchestrator.js`

## Fluxos críticos
- Health e status: `/health`, `/api/health`, `/api/status`
- Config persistida da UI: `/api/config`
- Operações de arquivo: `/api/files/execute`, `/api/files/schedule`, `/api/files/list-images`, `/api/files/list-folders`
- Slideshow: UI em `/ui`, imagens via `/api/files/image/*`
- Auto-update: `/api/update/auto/*`

## Superfície canônica de UX
- A aba `Operações de Arquivos` em `/ui` é a entrada principal para `move`, `copy` e `delete`.
- `Executar agora` e `Agendar` compartilham o mesmo draft interno de operação: origem, ação, destino e opções.
- O modal de agendamento não deve manter um formulário independente; ele deve herdar e estender o draft ativo de `fileops`.
- `Pastas configuradas` são atalhos persistidos. Navegação manual no filesystem continua disponível, mas não deve competir com múltiplos campos equivalentes.

## Fonte de verdade por domínio
- Versão, scripts e engines: `package.json`
- Config da aplicação: `data/depara-config.json`
- Config do auto-update: `data/update-config.json`
- Estado do auto-update: `data/update-state.json`
- Histórico de update: `data/update-history.log`

## Partes frágeis
- `src/public/app.js`: arquivo legado grande; valide parser e navegação visual após qualquer edição.
- `src/routes/fileOperations.js`: superfície extensa e heterogênea; evite refactors amplos sem smoke test real.
- `src/services/updateOrchestrator.js`: nunca teste fluxos destrutivos sem `DEPARA_DISABLE_UPDATE_SIDE_EFFECTS=true`.
- Seleção de pastas: preserve o contrato explícito de contexto (`source`, `target`, `schedule-source`, `schedule-target`, `slideshow`) e não reintroduza fallback heurístico entre IDs de input.

## Não faça isso
- Não derive versão de strings hardcoded no código.
- Não rode `git merge`, `npm install` ou restart real em testes.
- Não crie novas docs na raiz para “explicar melhor” um fluxo existente.

## Agendamento canonico
- A aba `Operacoes Agendadas` opera apenas sobre a configuracao persistida: editar, duplicar, pausar, retomar, executar agora e excluir.
- O estado `active` e parte do contrato persistido; pausar nao pode remover a operacao do store.
- O botao `Agendar` em `fileops` deve abrir o mesmo modal canonico hidratado pelo draft atual.
