# PERFORMANCE_AUDIT_CONTRACT

AUDIT_DATE=2026-10-18
VALIDATED_APPLICATION_COMMIT=working-tree-after-product-audit
AUDIT_PLATFORM=Windows_x64
DOC_AUDIENCE=AI_development_agents

## Objetivo

Para sincronização, medir separadamente preview, primeira cópia, execução sem alterações, alteração de 1% e verificação completa, com 5.000/50.000 arquivos e arquivo de 1 GiB. Usar três repetições, mediana, pico de RSS e latência de saúde com Codex/slideshow. Baselines abaixo ainda não certificam esse recurso nem um par físico de HDs.

Auditor isolado: `node scripts/sync-performance-audit.js --files=5000 --scan-only`, `--files=50000 --scan-only` e `--files=1 --large-bytes=1073741824`. Cria e limpa somente fixtures temporárias; os modos scan-only não medem cópia integral do catálogo. Não executar em paralelo com Jest/Playwright em HD lento. A identificação de volume é simulada nesse auditor; testar o helper Windows separadamente.

`--files=1 --real-volume` habilita o helper Win32 real. Nesta máquina, o ciclo completo terminou sem falhas: três previews em 1.929/1.821/1.867 ms; cópia inicial 2.511 ms; ciclos sem alterações 2.155/2.145/1.988 ms, sempre com zero cópias; pico de RSS do Node até 61,7 MiB. Isso valida integração com a identificação real do volume, mas os dois diretórios temporários ficam no mesmo disco. RSS do Node não inclui os processos PowerShell transitórios, navegador ou Codex.

Medições sintéticas iniciais desta implementação: preview de 5.000 arquivos em 28.687/21.346/39.379 ms (mediana 28.687 ms), pico de RSS até 66,8 MiB. Arquivo de 1 GiB: cópia inicial 63.281 ms e verificação completa 40.856 ms, pico até 127,2 MiB. Depois da cópia, três ciclos sem alterações levaram 634/509/576 ms (mediana 576 ms) e copiaram zero arquivos. Carga simultânea de validações variou; não inferir ganho percentual nem certificação de latência HTTP a partir dessas amostras.

Preview de 50.000 arquivos: 143.896/270.606/275.999 ms (mediana 270.606 ms, cerca de 4min31s); picos de RSS 77,9/79,1/77,1 MiB, com 50.000 entradas e zero cópias em cada execução. Maior intervalo observado no timer do auditor: 171 ms. Houve concorrência com outros validadores durante parte da medição; o timer não equivale a p95 HTTP. A criação/remoção das 50.000 fixtures não está incluída no tempo de preview. A cópia integral de 50.000 arquivos e o piloto entre HDs físicos permanecem sem certificação.

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
