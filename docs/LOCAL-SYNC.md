# LOCAL_SYNC_CONTRACT

DOC_AUDIENCE=AI_development_agents
PLATFORM_CONTRACT=Windows_10_or_11_x64

## Produto e armazenamento

O modo Sincronização local em Operações de Arquivos é unidirecional. `new-only` copia somente caminhos ausentes; `versioned` copia novos e atualiza alterados. Extras no destino e exclusões na origem não são propagados. Conteúdo igual com caminhos diferentes não é deduplicado fisicamente.

Padrão: manual, versionado, atual mais três anteriores; retenção configurável 1/3/5. Salvar retenção autoriza limpar versões excedentes após commit confirmado. Nada é criado automaticamente na instalação. Agendas de 1h/6h/1d exigem preview e primeira execução e só funcionam enquanto o processo estiver ativo.

- Definições: `%USERPROFILE%\.depara\data\sync-jobs.json`, envelope `{version:1,jobs:[...]}`. Leitura de array anterior é aceita; a próxima gravação normaliza o envelope.
- Resultados: `%USERPROFILE%\.depara\data\file-sync\<runId>\state.json` e `results.jsonl`.
- Destino: arquivos atuais mantêm seus nomes e caminhos.
- Área reservada: `<destino>\.depara-sync\<jobId>` contém identidade, índice por arquivo, versões, `pending.jsonl` e auditoria de retenção.

A área reservada é uma exceção explícita ao armazenamento no runtime. Não mover para o release ou Git. Arquivos `.bak`, logs e diretórios de build selecionados não são excluídos silenciosamente. Apenas infraestrutura do Windows e do DePara é ignorada. Links, junctions e entradas inacessíveis aparecem como pendências.

Identidade e filesystem são inspecionados por helper PowerShell oculto que chama APIs Win32 de leitura (GetVolumePathName/GetVolumeNameForVolumeMountPoint/GetVolumeInformation), com timeout de 30s. Não depende do módulo Storage/CIM. A tolerância contempla inicialização lenta do PowerShell; não muda os limites de memória do produto. Letras não são identidade. Pastas devem existir. Sobreposições, ciclos, UNC e raízes contendo o runtime são rejeitados. Allowlist continua usando `DEPARA_ALLOWED_PATHS`; para HDs em F: ou posteriores, configure as bases explicitamente. Nunca ampliar a allowlist automaticamente.

O destino desta versão deve ser NTFS. A publicação usa um vínculo temporário no mesmo volume com criação exclusiva, seguido da remoção do nome temporário: não sobrescreve arquivo criado por outro processo entre validação e publicação. Não é deduplicação entre arquivos do usuário. Origem pode estar em outro filesystem. exFAT/FAT como destino ficam bloqueados, pois não fornecem essa primitiva com a stack Node atual.

Referência da identificação: [Microsoft Win32 — GUID do volume por ponto de montagem](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-getvolumenameforvolumemountpointw).

## API

Base `/api/sync`. Respostas `{success,data}`; erros `{success:false,error,code}`. IDs de job e execução são UUIDs distintos.

| Método | Caminho | Contrato |
|---|---|---|
| GET/POST | `/jobs` | Listar/criar; name/sourcePath/targetPath/mode/retention |
| PUT/DELETE | `/jobs/:id` | Nome, retenção, frequência e active; remover preserva arquivos |
| POST | `/jobs/:id/preview` | Somente leitura no destino; 202, execução em data.id |
| POST | `/jobs/:id/run` | Revalida e executa incrementalmente; 202 |
| POST | `/jobs/:id/verify` | Hash completo dos arquivos encontrados e versões; 202 |
| POST | `/jobs/:id/review` | Revisa sourcePath/targetPath importados; identidade diferente exige confirmIdentityChange=true |
| POST | `/jobs/:id/resolve` | relative/sourceHash/targetHash/choice (`source` ou `target`); 202 |
| GET | `/jobs/:id/history?relative=...` | Lista anteriores do arquivo |
| POST | `/jobs/:id/restore` | relative/versionId/targetPath; ou replace=true/confirm=true; 202 |
| GET | `/runs/:id` | Estado e contagens |
| GET | `/runs/:id/results?offset=0` | Página de 100 resultados e nextOffset |
| POST | `/runs/:id/cancel` | Cancela preparação ou para depois da transação crítica; 202 |

Estados: queued/running/completed/partial/paused/failed/cancelled/interrupted. `partial` inclui conflito, bloqueio ou divergência de integridade. HTTP 202 não significa cópia concluída. Em conflito, `source` preserva destino e publica origem; `target` mantém destino naquela execução, sem autorizar futuras sobrescritas.

Histórico e restauração dependem somente do destino validado e funcionam sem o HD de origem. Para recuperação em outra máquina, `/review` aceita destinationOnly=true e targetPath; divergência de identidade exige confirmIdentityChange=true e repositório com o id esperado. Isso não autoriza sincronização nem agenda. A UI oferece Revisar destino para recuperação na aba Backup e Recuperação.

## Integridade e recuperação

Comparação rápida usa tamanho/data e índice por arquivo. Não detecta alteração que preserve exatamente esses metadados: usar verificação completa manual. SHA-256 é streaming. A cópia temporária é relida antes de preservar o destino anterior. Data de modificação é conservada; ACL, proprietário, ADS e snapshots de aplicações abertas não são cobertos.

Journal: copying/staged/preserved/published/committed. Registrar intenção antes de mover destino ao histórico. Confirmar publicação antes da retenção. Arquivos em alteração não são publicados. Espaço é verificado antes de cada cópia, reservando 256 MiB; preview calcula bytes candidatos. Nunca apagar histórico para liberar espaço durante cópia.

Após falha/reinício, a execução anterior aparece interrupted. Executar o mesmo job reconcilia `pending.jsonl`, remove parcial registrado ou termina/reverte publicação antes de varrer de novo. O log registra intenção de cópia, staging, commit e conclusão; as etapas físicas intermediárias são reconciliadas por existência e hash. Somente final truncado é descartável; corrupção intermediária bloqueia recuperação. Ao terminar sem pendências, o log é compactado atomicamente. Arquivos já confirmados e iguais são ignorados. Sem disco ou com identidade divergente, pausa. Não apague journal, versões ou metadados para resolver erro. Nunca tratar disco ausente como origem vazia.

Versão corrompida bloqueia limpeza. Remoção de excedentes tem intenção/conclusão em retention.jsonl. Proteção contra falha de processo não garante recuperação de defeito físico, filesystem corrompido ou flush não persistido pelo hardware.

## Performance e isolamento

Sem dependências novas, workers ou watchers. Mesma fila de mutações, um arquivo ativo, buffers de 256 KiB, fs.opendir e índices distribuídos por arquivo. Resultados JSONL paginados, sem catálogo global em RAM. Metadados críticos são duráveis; resultados de preview não exigem fsync por arquivo.

GUID de volume é revalidado no início de cada execução e periodicamente (cache de cinco minutos), evitando consultas PowerShell por arquivo. Dispositivo, raízes e repositório continuam conferidos entre arquivos. Pressão crítica pausa e reavalia em 30s. Não aumentar limite de 192 MiB de RSS, heap, concorrência ou preload para acomodar este recurso. Polling somente com tela visível.

Identificador de dispositivo e presença do repositório também são conferidos entre arquivos. Configuração de jobs inválida desabilita somente a sincronização com CONFIG_CORRUPT; não sobrescrever o arquivo defeituoso nem impedir a abertura do slideshow e das operações existentes. Restaurar a definição e reiniciar pelo launcher oficial.

Importação operacional ocupa a fila compartilhada e bloqueia novos jobs/edições durante a transação, evitando configuração parcialmente substituída enquanto uma sincronização começa. Importar durante uma execução ativa é rejeitado.

Backup operacional formato 2 inclui syncJobs; formato 1 continua aceito. Importação pausa jobs e exige revisão/preview. Rollback restaura estado anterior. Reimportar configuração com o mesmo id reutiliza o índice do destino após reinstalação. Sem definição exportada, repository.json conserva a definição inicial do job para reconstrução pelo agente; revisar caminhos e identidade, nunca ativar automaticamente. Revisão de disco com identidade diferente exige confirmação explícita e repositório com o id esperado.

Validar com `tests/localSync.test.js`, regressão completa e piloto em dois HDs com dados descartáveis. Nunca usar fotos pessoais, porta 3000 ou runtime de produção nos testes.
