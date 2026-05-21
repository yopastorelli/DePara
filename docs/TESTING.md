# Estratégia de Testes

## Comandos canônicos
```bash
npm run lint
npm run test:unit
npm run test:smoke
npm run test:e2e
```

## O que cada camada cobre
- `lint`: parser/sintaxe e regressões estruturais rápidas
- `test:unit`: rotas/config/update backend já isolados
- `test:smoke`: fluxos reais de API e operações de arquivo com fixtures temporárias
- `test:e2e`: UI real em navegador com Playwright e runtime temporário isolado

## Regras de teste
- Sempre use diretórios temporários em smoke/E2E.
- Sempre rode com `DEPARA_DISABLE_UPDATE_SIDE_EFFECTS=true` quando o teste tocar update.
- Não dependa do estado do repositório local para passar em smoke/E2E.

## Cenários obrigatórios
- UI carrega sem erro de parser.
- Health/status respondem com versão consistente.
- Config persiste e reidrata.
- Copy/move/delete funcionam em arquivos temporários.
- Slideshow lista imagens e navega com fixtures válidas.
