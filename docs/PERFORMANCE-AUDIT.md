# PERFORMANCE_AUDIT_CONTRACT

## Objetivo

Medir o custo de inicialização, consultas de status e varredura de imagens no mesmo Windows que executará o DePara. O auditor cria uma base temporária, não usa os dados reais e remove o conjunto ao terminar.

## Execução

```powershell
npm run perf:audit -- --profile=small
npm run perf:audit:medium
node scripts/performance-audit.js --profile=large --output=C:\Temp\depara-audit.json
node scripts/performance-audit.js --files=1000 --images=5005 --depth=7
```

Perfis incluídos:

| Perfil | Arquivos | Imagens | Profundidade |
|---|---:|---:|---:|
| `small` | 100 | 50 | 3 |
| `medium` | 1.000 | 250 | 5 |
| `large` | 10.000 | 1.000 | 7 |

Também é possível informar `--files`, `--images` e `--depth` individualmente.

## Métricas

O JSON gravado em `performance-results/` contém, por cenário:

- `durationMs`: latência da chamada;
- `memoryBefore` e `memoryAfter`: RSS, heap, memória externa e ArrayBuffers;
- `memoryDelta`: variação durante o cenário;
- `list-images`: quantidade retornada, página e indicação de continuidade;
- `status-resources-concurrent-x5`: comportamento de cinco consultas simultâneas.

## Ordem recomendada

1. Execute o perfil `small` para confirmar que o ambiente está funcional.
2. Execute o perfil `medium` na máquina lenta, sem outras cargas relevantes.
3. Compare somente execuções do mesmo perfil e mesma configuração.
4. Valide também um catálogo com mais de 5.000 imagens, coletando páginas até o fim e conferindo ausência de duplicatas.
5. Ajuste primeiro `MAX_CONCURRENT_OPERATIONS`, o tamanho de página e o perfil de memória.
6. Só depois altere a implementação; repita o mesmo perfil para confirmar ganho.

## Critérios de decisão

- Ganho válido precisa reduzir latência ou memória sem aumentar erros.
- RSS alto com heap estável aponta para buffers, respostas ou recursos nativos; heap alto aponta para objetos JavaScript retidos.
- Uma medição isolada não certifica a máquina-alvo. Registre pelo menos três execuções por configuração e use mediana.
- O auditor atual mede o ambiente local; não substitui validação na máquina lenta definitiva.
