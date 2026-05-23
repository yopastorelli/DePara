# Estratégia de Testes

## Gates canônicos
```bash
npm run lint
npm run test:unit
npm run test:smoke
npm run test:e2e
```

## Scripts de teste atuais
- `npm test`: alias de `test:unit`
- `npm run test:unit`: Jest para backend e contratos isolados
- `npm run test:smoke`: Jest para fluxos reais de API e operações controladas
- `npm run test:e2e`: Playwright para UI real
- `npm run test:coverage`: cobertura Jest

## Regras de isolamento
- Use diretórios temporários para `data`, `logs`, `backups` e `temp`
- Use `DEPARA_DISABLE_UPDATE_SIDE_EFFECTS=true` quando o teste tocar update
- Nenhum teste deve depender do repositório local estar limpo ou populado
- Nenhum teste deve escrever em `backups/` do repositório
- Em `test`, `LOG_TO_CONSOLE` deve permanecer desligado por padrão

## Cenários mínimos de release
- UI carrega sem erro de parser
- `/api/docs` reflete a superfície pública atual
- `/api/status/resources` responde de forma estável
- Config persiste e reidrata
- `copy`, `move` e `delete` funcionam em diretórios temporários
- Slideshow lista imagens e navega com fixtures válidas
- File ops usa o draft canônico para executar e agendar
- Update diagnostics expõe readiness operacional coerente

## Cobertura de agendamento
- create, edit, duplicate, pause, resume e execute-now
- persistência de `active`
- reidratação após reinício

## Verificação textual
- Strings user-facing da UI e da API não podem conter sequências típicas de mojibake
- Título da página, toasts e mensagens de update devem aparecer em português legível
