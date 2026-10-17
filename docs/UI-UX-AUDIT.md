# Auditoria de UI e UX — slideshow e responsividade

AUDIT_DATE=2026-10-17
AUDIT_BASE_COMMIT=19e8356
AUDIT_PLATFORM=Windows_Chromium

## Falhas reproduzidas

- Em uma janela de `1366 × 768`, uma foto de `3096 × 4128` ocupava `1326 × 1768` no DOM, começando em `y=103` e terminando em `y=1871`. O `object-fit: contain` não resolvia o problema porque o contêiner flex não tinha altura útil limitada e mantinha o tamanho mínimo intrínseco da imagem.
- Havia definições concorrentes de slideshow em CSS externo, estilos inline e regras antigas de fullscreen. Passar o mouse também mudava a escala de botões.
- Pausar pelo teclado lançava `TypeError` ao tentar atualizar um `.material-icons` inexistente no botão. O estado de reprodução e o timer podiam ficar divergentes.
- O início do slideshow tinha um handler inline e outro registrado por JavaScript. A carga também podia iniciar o visualizador novamente.
- A captura de teclado era compartilhada com o dashboard, sem um contrato de foco para o visualizador.
- O timer de inatividade continuava armado durante um slideshow manual. A entrada posterior em `screensaver-mode` podia esconder o cursor.
- Em telas baixas, o cabeçalho fixo interceptava cliques no cartão do slideshow. Em telas estreitas, botões longos, ícones sem fonte e notificações provocavam rolagem horizontal.
- A UI dependia de fontes externas. Sem elas, os nomes dos ícones podiam aparecer como texto e aumentar os controles.
- A inicialização aguardava uma segunda atualização do dashboard, apesar de o scheduler já ter iniciado essa tarefa. Monitoramento lento não deve bloquear a utilização da interface.
- Uma solicitação de fullscreen ainda pendente podia disputar com outra entrada/saída, deixando o navegador novamente em tela cheia após o usuário pedir para sair.

## Contrato implementado

- O visualizador ocupa a área disponível da janela, com cabeçalho e rodapé fora da área da foto. O centro tem `min-height: 0`, `min-width: 0` e dimensões limitadas; a imagem usa `object-fit: contain`, sem recorte ou distorção. Barras vazias são esperadas quando a proporção da foto difere da tela.
- Um único conjunto de regras CSS controla o layout, inclusive quando o fullscreen nativo é recusado. O fullscreen nativo tem como alvo somente `#slideshow-viewer`, não o documento inteiro.
- Transições de fullscreen são serializadas. O botão aguarda a transição terminar; fechar o visualizador durante uma entrada pendente também provoca a saída quando a entrada termina.
- Navegação visível por botões de pelo menos `44 × 44` pixels; controles sem mudança de posição ou escala no hover. Nome de arquivo longo é truncado visualmente e preservado em `title`.
- `←` e `→` navegam, `Espaço` pausa/retoma, `F11` alterna fullscreen e `Esc` fecha. Não são interceptados campos editáveis, composição de texto ou combinações com Ctrl/Alt/Meta.
- O visualizador recebe foco ao abrir, contém a navegação por Tab e devolve foco ao cartão de origem ao fechar. O botão anterior fica desabilitado na primeira imagem; o avanço ao final reinicia o ciclo.
- O início possui um único handler, proteção contra reentrada e feedback de carregamento. O caminho deve ser absoluto do Windows ou UNC, e a opção de incluir subpastas é respeitada.
- Slideshow manual suspende o timer de inatividade e mantém o cursor. Fechar libera a imagem, timers e catálogo, restaurando o comportamento normal do protetor de tela.
- Cabeçalho deixa de ser fixo em telas estreitas ou baixas; formulários, notificações e configuração do slideshow respeitam a largura disponível.
- Gráficos se ajustam ao cartão, legendas quebram linha, e listas preenchidas de pastas, agendamentos e backups acomodam caminhos longos e seus botões. A busca deixa de impor largura mínima maior que a janela.
- Material Icons é um ativo local versionado com licença e hash em `src/public/fonts/README.md`. Texto usa fonte do Windows/sistema; não há dependência de Google Fonts para a UI funcionar.
- Monitoramento inicial continua pelo scheduler existente, sem uma segunda atualização bloqueante durante o splash.

## Regressões obrigatórias

Execute `node node_modules/@playwright/test/cli.js test tests/e2e/slideshow.ux.spec.js`.

O teste usa três PNGs sintéticos grandes, com faixas contrastantes no topo e na base: retrato `1200 × 1800`, paisagem `2400 × 1200` e panorâmica `3200 × 600`. Fotos pessoais e configurações do runtime real não são usadas.

Matriz de viewport: `1366 × 768`, `1024 × 600`, `800 × 600`, `640 × 360`, `360 × 640` e `320 × 480`.

As asserções verificam limites da foto e dos controles, ausência de overflow no visualizador e nas cinco abas principais, teclado, foco, hover, pausa, fechamento, cursor, suspensão do screensaver, fonte local, ausência de requisições externas e inicialização com monitoramento pendente. O fullscreen nativo e o fallback CSS são exercitados separadamente.

Capturas sintéticas ficam em `test-results/`, fora do Git, e devem ser inspecionadas visualmente. Testes verdes não substituem recarregar a UI e validar o release ativo na porta de produção.

## Evidência de validação — 2026-10-17

- Lint: PASS.
- Jest: 14 suítes e 64 testes aprovados; smoke separado com 8 testes aprovados.
- Playwright: 18 testes aprovados com um worker, incluindo os 13 cenários deste relatório e os cinco fluxos existentes da aplicação. A última execução levou aproximadamente 2,4 minutos.
- `npm audit --audit-level=high`: nenhuma vulnerabilidade reportada.
- Parser PowerShell: scripts de instalação e operação aprovados.
- Capturas de slideshow em desktop e janela estreita inspecionadas; as duas faixas nas bordas da imagem de teste permanecem visíveis, sem recorte.

Este registro comprova a validação local do código. A ativação do release e a publicação no remoto são verificações separadas, conforme `docs/WINDOWS-OPS.md`.

## Limites da evidência

A matriz valida Chromium automatizado, não todos os monitores, níveis de zoom, drivers gráficos ou tecnologias assistivas. Alterações futuras de fullscreen, foco ou CSS devem repetir estes cenários.

As correções não habilitam preload nem carregam a coleção inteira em memória. A imagem original ainda precisa ser decodificada pelo navegador: `3096 × 4128 × 4` equivale a aproximadamente `48,8 MiB` somente em pixels RGBA, antes de outras cópias e buffers. O limite de heap do servidor Node não limita a memória do navegador. Em uma máquina muito limitada, medir o conjunto navegador + DePara + Codex com fotos reais; não prometer consumo constante para qualquer resolução.
