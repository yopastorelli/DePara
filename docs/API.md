# Documentação da API DePara - Gerenciador de Arquivos

## Visão Geral

A API DePara é uma interface RESTful simplificada focada em operações automatizadas de arquivos. Permite mover, copiar e apagar arquivos com agendamento flexível, backup automático e controle sobre a estrutura de pastas. A API foi projetada para ser simples de usar, bem documentada e com tratamento robusto de erros.

## Base URL

```
http://localhost:3000/api
```

## Autenticação

Atualmente, a API não requer autenticação. Todas as rotas são públicas.

## Formato de Resposta

Todas as respostas da API seguem um formato padrão:

### Resposta de Sucesso
```json
{
  "success": true,
  "data": {...},
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Resposta de Erro
```json
{
  "error": {
    "message": "Descrição do erro",
    "details": "Detalhes adicionais",
    "statusCode": 400,
    "timestamp": "2024-01-01T00:00:00.000Z",
    "path": "/api/endpoint",
    "method": "POST"
  }
}
```

## Endpoints

### 1. Health Check

#### GET /api/health
Verifica o status básico da aplicação.

**Resposta:**
```json
{
  "status": "OK",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 123.45,
  "environment": "development",
  "version": "1.0.0",
  "memory": {
    "used": 25,
    "total": 128,
    "external": 5
  },
  "system": {
    "platform": "win32",
    "arch": "x64",
    "nodeVersion": "v18.0.0",
    "cpuCount": 8,
    "loadAverage": [0.5, 0.3, 0.2]
  }
}
```

#### GET /api/health/detailed
Verifica o status detalhado da aplicação.

#### GET /api/health/connectivity
Verifica a conectividade e serviços do sistema.

### 2. Operações de Arquivos

#### POST /api/files/execute
Executa operações imediatas de arquivo (mover, copiar, apagar).

**Parâmetros:**
```json
{
  "action": "move|copy|delete",
  "sourcePath": "/caminho/arquivo.txt",
  "targetPath": "/caminho/destino.txt",
  "options": {
    "backupBeforeMove": true,
    "overwrite": false,
    "preserveStructure": true
  }
}
```

**Resposta:**
```json
{
  "success": true,
  "data": {
    "action": "move",
    "sourcePath": "/caminho/arquivo.txt",
    "targetPath": "/caminho/destino.txt",
    "backupCreated": "/backups/arquivo.txt.backup",
    "timestamp": "2024-01-01T00:00:00.000Z"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

#### POST /api/files/schedule
Agenda operações periódicas de arquivo.

**Parâmetros:**
```json
{
  "frequency": "5m|1h|1d",
  "action": "move|copy|delete",
  "sourcePath": "/caminho/origem",
  "targetPath": "/caminho/destino",
  "options": {
    "batch": true,
    "filters": {
      "extensions": ["txt", "csv"]
    },
    "preserveStructure": true
  }
}
```

#### PUT /api/files/schedule/:operationId
Edita uma operação agendada existente.

**Parâmetros URL:**
- `operationId` (string): ID da operação agendada

**Parâmetros:**
```json
{
  "frequency": "5m|1h|1d",           // Opcional: nova frequência
  "action": "move|copy|delete",       // Opcional: nova ação
  "sourcePath": "/caminho/origem",    // Opcional: novo caminho origem
  "targetPath": "/caminho/destino",   // Opcional: novo caminho destino
  "options": {                       // Opcional: novas opções
    "batch": true,
    "backupBeforeMove": true
  }
}
```

**Resposta de Sucesso:**
```json
{
  "success": true,
  "data": {
    "operationId": "backup_diario",
    "config": {
      "frequency": "6h",
      "action": "copy",
      "sourcePath": "/dados",
      "targetPath": "/backup",
      "options": { "batch": true }
    },
    "status": "edited"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**Nota:** Você pode fornecer apenas os campos que deseja alterar. Os outros campos manterão seus valores atuais.

#### GET /api/files/scheduled
Lista todas as operações agendadas.

#### GET /api/files/templates
Lista templates pré-configurados para operações comuns.

### 4. Status do Sistema

#### GET /api/status
Status geral do sistema.

#### GET /api/status/resources
Status detalhado de recursos do sistema.

#### GET /api/status/connectivity
Status de conectividade e serviços.

#### GET /api/status/performance
Métricas de performance do sistema.

#### GET /api/status/logs
Status do sistema de logs.

### 6. Operações de Arquivos

#### POST /api/files/execute
Executa operação imediata em arquivo (mover, copiar, apagar).

**Parâmetros:**
```json
{
  "action": "move|copy|delete",
  "sourcePath": "/caminho/arquivo.txt",
  "targetPath": "/caminho/destino.txt",
  "options": {
    "backupBeforeMove": true,
    "overwrite": false,
    "preserveStructure": true
  }
}
```

**Opções Importantes:**
- `preserveStructure`: Mantém a estrutura de subpastas (true) ou achata tudo na raiz (false)

#### POST /api/files/schedule
Agenda operação periódica.

**Parâmetros:**
```json
{
  "frequency": "5m|1h|1d",
  "action": "move|copy|delete",
  "sourcePath": "/caminho/origem",
  "targetPath": "/caminho/destino",
  "options": {
    "batch": true,
    "filters": {
      "extensions": ["txt", "csv"]
    },
    "preserveStructure": true
  }
}
```

**Opções Importantes:**
- `preserveStructure`: Mantém a estrutura de subpastas (true) ou achata tudo na raiz (false)

#### GET /api/files/scheduled
Lista operações agendadas.

#### POST /api/files/batch
Executa operação em lote em todos os arquivos de uma pasta.

#### GET /api/files/templates
Lista templates pré-configurados.

#### POST /api/files/templates/:category/:name/apply
Aplica template com customizações.

#### GET /api/files/ignored-patterns
Lista todos os padrões de arquivos automaticamente ignorados.

#### POST /api/files/check-ignore
Verifica se um arquivo específico seria ignorado pelas regras automáticas.

**Parâmetros:**
```json
{
  "filePath": "/caminho/completo/arquivo.ext",
  "filename": "arquivo.ext"
}
```

## 🛡️ Sistema de Arquivos Ignorados

A aplicação possui um sistema inteligente de proteção que **automaticamente ignora** arquivos críticos para:

### 🔄 Resilio Sync (BitTorrent Sync)
- `.sync` - Diretório de configuração da sincronização
- `.!sync` - Arquivos temporários de sincronização
- `.rsls` - Arquivos de lista de sincronização
- `.syncignore` - Arquivo de configuração de ignore
- `.bts` - Arquivos BitTorrent Sync (versão antiga)
- `*.!sync` - Arquivos temporários com extensão
- `*.sync` - Arquivos de configuração
- `*.rsls` - Arquivos de lista
- `*.bts` - Arquivos BitTorrent

### 💻 Arquivos de Sistema
- `Thumbs.db` - Miniaturas do Windows
- `.DS_Store` - Arquivos do macOS
- `desktop.ini` - Configurações do Windows
- Arquivos de lixeira e temporários do sistema

### ⏰ Arquivos Temporários
- `*.tmp`, `*.temp` - Arquivos temporários
- `*.bak`, `*.backup` - Arquivos de backup
- `*.log` - Arquivos de log
- `__pycache__` - Cache Python
- `node_modules/` - Dependências Node.js

### ✅ Benefícios da Proteção Automática

1. **🔄 Preserva Sincronização** - Não interrompe o Resilio Sync
2. **🛡️ Evita Problemas** - Não move arquivos críticos do sistema
3. **⚡ Performance** - Não processa arquivos desnecessários
4. **🔧 Compatibilidade** - Funciona em Windows, Linux e macOS

## Códigos de Status HTTP

- `200 OK`: Requisição bem-sucedida
- `400 Bad Request`: Parâmetros inválidos ou ausentes
- `404 Not Found`: Endpoint não encontrado
- `500 Internal Server Error`: Erro interno do servidor

## Tratamento de Erros

A API implementa tratamento robusto de erros com:

- Validação de parâmetros de entrada
- Mensagens de erro descritivas
- Logs estruturados para debugging
- Códigos de status HTTP apropriados

## Limites e Restrições

- **Tamanho de dados**: Máximo de 10MB por requisição
- **Rate limiting**: Implementado para prevenir abuso
- **Timeout**: 30 segundos por operação
- **Formato de dados**: Apenas JSON para entrada e saída

## Exemplos de Uso

### Mover Arquivo com Backup
```bash
curl -X POST http://localhost:3000/api/files/execute \
  -H "Content-Type: application/json" \
  -d '{
    "action": "move",
    "sourcePath": "/origem/arquivo.txt",
    "targetPath": "/destino/arquivo.txt",
    "options": {
      "backupBeforeMove": true,
      "preserveStructure": true
    }
  }'
```

### Agendar Backup Diário
```bash
curl -X POST http://localhost:3000/api/files/schedule \
  -H "Content-Type: application/json" \
  -d '{
    "operationId": "backup_diario",
    "frequency": "1d",
    "action": "copy",
    "sourcePath": "/dados",
    "targetPath": "/backup/diario",
    "options": {
      "batch": true,
      "preserveStructure": true
    }
  }'
```

### Editar Operação Agendada
```bash
# Editar frequência de backup diário para a cada 6 horas
curl -X PUT http://localhost:3000/api/files/schedule/backup_diario \
  -H "Content-Type: application/json" \
  -d '{
    "frequency": "6h",
    "targetPath": "/backup/novo_local"
  }'
```

### Cancelar Operação Agendada
```bash
curl -X DELETE http://localhost:3000/api/files/schedule/backup_diario
```

### Verificação de Saúde
```bash
curl http://localhost:3000/api/health
```

## 📁 Operações de Arquivos

A API inclui poderosas funcionalidades para operações de arquivos com agendamento automático:

### Ações Suportadas
- **Mover**: Move arquivos entre pastas com backup automático
- **Copiar**: Copia arquivos preservando o original
- **Apagar**: Remove arquivos com backup automático

### Frequências Disponíveis
- `30s` - A cada 30 segundos
- `1m` - A cada 1 minuto
- `5m` - A cada 5 minutos
- `15m` - A cada 15 minutos
- `30m` - A cada 30 minutos
- `1h` - A cada 1 hora
- `6h` - A cada 6 horas
- `12h` - A cada 12 horas
- `1d` - A cada 1 dia

### Templates Pré-configurados
- **Backup**: Backup diário, por hora
- **Limpeza**: Limpeza de temporários, logs antigos
- **Organização**: Por tipo, por data
- **Sincronização**: Espelhamento, backup incremental
- **Processamento**: Importação de dados, arquivamento

## Suporte e Contato

Para suporte técnico ou dúvidas sobre a API:

1. Consulte os logs da aplicação
2. Verifique o endpoint `/api/docs` para documentação interativa
3. Abra uma issue no repositório GitHub
4. Entre em contato com a equipe de desenvolvimento

---

**Versão da API:** 1.0.0  
**Última atualização:** Janeiro 2024
