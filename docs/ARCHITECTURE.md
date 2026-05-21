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

## Não faça isso
- Não derive versão de strings hardcoded no código.
- Não rode `git merge`, `npm install` ou restart real em testes.
- Não crie novas docs na raiz para “explicar melhor” um fluxo existente.
