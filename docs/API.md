# Documentação da API DePara

## Visão Geral

A API DePara é uma interface RESTful simplificada focada em operações automatizadas de arquivos e slideshow de imagens. Permite mover, copiar e apagar arquivos com agendamento flexível, backup automático e controle sobre a estrutura de pastas.

## Base URL

```
http://localhost:3000/api
```

## Formato de Resposta

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
    "timestamp": "2024-01-01T00:00:00.000Z"
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
  }
}
```

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
  }
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

#### GET /api/files/scheduled
Lista todas as operações agendadas.

**Resposta:**
```json
{
  "success": true,
  "data": [
    {
      "id": "backup_diario",
      "name": "Backup Diário",
      "frequency": "1d",
      "action": "copy",
      "sourcePath": "/dados",
      "targetPath": "/backup",
      "active": true,
      "nextRun": "2024-01-02T00:00:00.000Z"
    }
  ]
}
```

#### PUT /api/files/schedule/:operationId
Edita uma operação agendada existente.

**Parâmetros:**
```json
{
  "frequency": "6h",
  "targetPath": "/backup/novo_local"
}
```

#### DELETE /api/files/schedule/:operationId
Cancela uma operação agendada.

### 3. Slideshow de Imagens

#### POST /api/files/list-images
Lista imagens para slideshow com filtros.

**Parâmetros:**
```json
{
  "folderPath": "/caminho/imagens",
  "extensions": ["jpg", "png", "gif"],
  "recursive": true,
  "maxDepth": 5
}
```

**Resposta:**
```json
{
  "success": true,
  "data": {
    "images": [
      {
        "path": "/caminho/imagens/foto1.jpg",
        "name": "foto1.jpg",
        "size": 1024000,
        "modified": "2024-01-01T00:00:00.000Z",
        "extension": ".jpg"
      }
    ],
    "totalCount": 1,
    "folderPath": "/caminho/imagens"
  }
}
```

#### GET /api/files/image/:imagePath
Serve uma imagem específica para o slideshow.

**Parâmetros URL:**
- `imagePath` (string): Caminho codificado da imagem

**Resposta:** Arquivo de imagem (Content-Type: image/jpeg, image/png, etc.)

### 4. Status do Sistema

#### GET /api/status/resources
Status detalhado de recursos do sistema.

#### GET /api/status/performance
Métricas de performance do sistema.

## Códigos de Status HTTP

- `200 OK`: Requisição bem-sucedida
- `400 Bad Request`: Parâmetros inválidos ou ausentes
- `404 Not Found`: Endpoint não encontrado
- `500 Internal Server Error`: Erro interno do servidor

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

### Listar Imagens para Slideshow
```bash
curl -X POST http://localhost:3000/api/files/list-images \
  -H "Content-Type: application/json" \
  -d '{
    "folderPath": "/caminho/imagens",
    "extensions": ["jpg", "png", "gif"],
    "recursive": true
  }'
```

### Verificar Status
```bash
curl http://localhost:3000/api/health
```

## Limites e Restrições

- **Tamanho de dados**: Máximo de 10MB por requisição
- **Timeout**: 30 segundos por operação
- **Formato de dados**: Apenas JSON para entrada e saída
- **Rate limiting**: Implementado para prevenir abuso

## Tratamento de Erros

A API implementa tratamento robusto de erros com:

- Validação de parâmetros de entrada
- Mensagens de erro descritivas
- Logs estruturados para debugging
- Códigos de status HTTP apropriados

---

**Versão da API:** 1.0.0  
**Última atualização:** Janeiro 2024