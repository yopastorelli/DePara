# Estratégia de Testes

## Gates canônicos
```bash
npm run lint
npm run test:unit
npm run test:smoke
npm run test:e2e
```

## Cobertura esperada
- `lint`: parser e regressão estrutural rápida
- `test:unit`: backend, config, update e status isolados
- `test:smoke`: fluxos reais de API, operações de arquivo e side effects controlados
- `test:e2e`: UI real em navegador com runtime isolado

## Regras de isolamento
- Sempre usar diretórios temporários para `data`, `logs`, `backups` e `temp`
- Sempre usar `DEPARA_DISABLE_UPDATE_SIDE_EFFECTS=true` quando o teste tocar update
- Nenhum teste pode depender do repositório local estar limpo ou populado
- Nenhum teste pode escrever em `backups/` do repositório
- Em `test`, `LOG_TO_CONSOLE` deve permanecer desligado por padrão

## Cenários mínimos de release
- UI carrega sem erro de parser
- status/resources responde sem degradação óbvia em chamadas repetidas
- config persiste e reidrata
- copy/move/delete funcionam em diretórios temporários
- slideshow lista imagens e navega com fixtures válidas
- fileops usa o draft canônico para executar e agendar
- update diagnostics expõe readiness operacional coerente
