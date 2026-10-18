# PERFORMANCE_AUDIT_CONTRACT

AUDIT_DATE=2026-10-18
VALIDATED_APPLICATION_COMMIT=working-tree-after-product-audit
AUDIT_PLATFORM=Windows_x64
DOC_AUDIENCE=AI_development_agents

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

## Baseline histórico

O snapshot de 2026-10-14, mantido apenas para comparação histórica, registrou em uma máquina Windows com Intel i5-3317U, 4 threads lógicas e aproximadamente 8 GB de RAM:

- RSS ocioso entre `54` e `60 MB`;
- prioridade de processo `BelowNormal`;
- uma única instância do servidor;
- consultas concorrentes de status concluídas em aproximadamente `327 ms` para 20 requisições;
- catálogo de imagens em disco, com preload desligado.

Esse baseline é evidência local, não uma garantia para outra máquina. Registre host, commit, perfil, pressão de memória e configuração junto de cada nova medição.

## Medição atual registrada

Em 2026-10-18, no checkout `C:\DePara`, com Node.js `v24.19.0`, o auditor foi executado contra o working tree após a auditoria de produto, usando dados sintéticos e o perfil de coexistência:

| Perfil | Health | Recursos | Concorrente x5 | Listagem | RSS final |
|---|---:|---:|---:|---:|---:|
| `small` (100 arquivos, 50 imagens) | 210,22 ms | 23,01 ms | 69,51 ms | 100,48 ms | 75,4 MiB |
| `medium` (1.000 arquivos, 250 imagens) | 94,92 ms | 24,34 ms | 75,20 ms | 204,18 ms | 78,8 MiB |

Os dois perfis terminaram com `pageStatus=ready`, sem continuidade (`hasMore=false`), e sem carregar imagens inteiras do catálogo em memória. Os resultados são evidência do host desta execução, não uma promessa para outra máquina.

Antes de alterar concorrência, paginação ou preload em uma máquina nova, execute pelo menos os dois perfis, repita cada um três vezes e registre a memória livre e a carga simultânea do Codex.
