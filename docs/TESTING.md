# Contrato de testes

DOC_AUDIENCE=AI_development_agents
PLATFORM_CONTRACT=Windows_only

## Gates canônicos

Execute na raiz do repositório, em PowerShell:

```powershell
npm ci
npm run lint
npm run test:unit
npm run test:smoke
npm run test:e2e
npm audit --audit-level=high
```

Resultado obrigatório: lint com código `0`, todas as suítes aprovadas e `npm audit --audit-level=high` sem vulnerabilidades reportadas.

Em hardware muito lento, use somente para validação local:

```powershell
npm run test:unit -- --testTimeout=60000
```

O timeout padrão do Jest é `30s` para tolerar I/O lento sem esconder travamentos. O timeout do Playwright é `60s` por teste e `120s` para iniciar o servidor E2E.

## Scripts

| Script | Escopo |
|---|---|
| `npm test` | alias de `test:unit` |
| `npm run test:unit` | contratos unitários e de backend |
| `npm run test:smoke` | rotas e operações controladas |
| `npm run test:e2e` | UI/API real em navegador Playwright |
| `npm run test:all` | lint + unit + smoke + E2E |
| `npm run test:coverage` | cobertura Jest |
| `npm run test:watch` | desenvolvimento interativo |

Para preparar o ambiente E2E, o agente instala o navegador uma vez por máquina:

```powershell
npx playwright install chromium
```

## Isolamento obrigatório

Testes devem usar diretórios temporários próprios para:

- `DEPARA_RUNTIME_ROOT`;
- `DEPARA_DATA_DIR`;
- `DEPARA_CONFIG_FILE`;
- `DEPARA_BACKUP_DIR`;
- `DEPARA_TEMP_DIR`;
- `LOG_FILE`.

Testes de update devem definir `DEPARA_DISABLE_UPDATE_SIDE_EFFECTS=true` e `DEPARA_DISABLE_UPDATE_SCHEDULER=true`. Testes que verificam paginação ou pressão de recursos devem controlar a memória simulada em vez de depender da memória livre do computador.

Nenhum teste pode usar `%USERPROFILE%\.depara`, pastas reais do usuário, porta de produção `3000` ou o banco de dados de outra execução.

## Cobertura mínima

O conjunto deve cobrir:

- health, status, recursos e conectividade;
- persistência e import/export de configuração;
- copy, move, delete e proteção de caminhos;
- journal transacional, destino sem overwrite, arquivo parcial, cancelamento, retomada e restauração de quarentena;
- pastas, workflows e agendamentos;
- paginação de imagens, catálogo temporário e `countOnly`;
- proteção contra traversal e symlink;
- update sem side effects destrutivos;
- UI, hidratação, slideshow e serving de imagens;
- bootstrap do release imutável;
- ausência de duplicação e perda em catálogos grandes.

## UI, slideshow e responsividade

`tests/e2e/slideshow.ux.spec.js` usa PNGs grandes em retrato, paisagem e panorama, não apenas imagens de um pixel. Cobre seis viewports de `320 × 480` a `1366 × 768`, teclado, foco, hover estável, pausa, cursor, ausência de overflow nas abas principais, fullscreen nativo e fallback.

A UI deve funcionar sem requisições externas e sem aguardar o monitoramento de recursos. A fonte de ícones local deve carregar com sucesso. O teste mantém uma requisição de monitoramento pendente para garantir que ela não prenda a inicialização.

`tests/fileSafety.test.js` é a regressão mínima de segurança de mutações. Ela deve permanecer isolada em um runtime temporário e provar, no mínimo, que uma falha de destino não apaga a origem, que exclusão de diretório não tenta tratar a pasta como arquivo, que cópias não deixam `.depara-partial-*` e que uma exclusão concluída ainda oferece restauração.

O Playwright usa um único worker: as suítes compartilham a API isolada de testes e não podem disputar sua configuração. Isso também contém o consumo de RAM durante a validação.

A barra única do slideshow deve ter até 52 pixels em janelas com largura de pelo menos 800 pixels e preservar atalhos e botões em janelas pequenas, adaptando a altura. Testes de intervalo cobrem a persistência até 300 segundos, presets, valor personalizado e avanço somente ao completar cinco minutos com relógio controlado. Não substitua essa verificação por uma espera real de cinco minutos.

Mantenha também a regressão que inicia um navegador com cache legado de 3 segundos e servidor já configurado em 10 segundos. Abrir ou recarregar a página não pode promover esse cache por cima da configuração canônica.

Ao mexer no CSS, inspecione também as capturas sintéticas em `test-results/`. O procedimento e as causas corrigidas estão em `docs/UI-UX-AUDIT.md`.

## Auditoria de dependências

```powershell
npm audit --audit-level=high
npm ls js-yaml picomatch --all
```

Os overrides de `package.json` são intencionais:

- `@istanbuljs/load-nyc-config -> js-yaml@5.4.3`;
- `anymatch -> picomatch@2.3.2`.

Não remova overrides sem reproduzir a instalação pelo lockfile, executar toda a suíte e confirmar a auditoria.

## Artefatos

Não versione `node_modules/`, `coverage/`, `test-results/`, `playwright-report/`, `performance-results/`, logs, backups, dados persistentes ou arquivos `.env*`.

## Codificação

```powershell
rg -n "Ã[ƒ‚]|â[€™€œ€]|\x{00D2}|\x{FFFD}" README.md docs src/public src/routes
```

Corrija mojibake no source; não esconda o problema com monkey patches de DOM.
