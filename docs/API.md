# Documentação da API DePara

## Visão Geral

A API DePara é uma interface RESTful que oferece funcionalidades de conversão e mapeamento de dados entre diferentes formatos. A API foi projetada para ser simples de usar, bem documentada e com tratamento robusto de erros.

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

### 2. Conversão de Dados

#### POST /api/convert
Converte dados entre diferentes formatos.

**Parâmetros:**
```json
{
  "sourceFormat": "csv",
  "targetFormat": "json",
  "data": "nome,idade\nJoão,25\nMaria,30",
  "options": {
    "delimiter": ",",
    "encoding": "utf-8"
  }
}
```

**Resposta:**
```json
{
  "success": true,
  "data": [
    {"nome": "João", "idade": "25"},
    {"nome": "Maria", "idade": "30"}
  ],
  "conversion": {
    "sourceFormat": "csv",
    "targetFormat": "json",
    "sourceDataLength": 35,
    "targetDataLength": 67,
    "conversionTime": 15,
    "options": {...}
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

#### GET /api/convert/formats
Lista os formatos suportados para conversão.

**Formatos Suportados:**
- CSV (Comma Separated Values)
- JSON (JavaScript Object Notation)
- XML (eXtensible Markup Language)
- YAML (YAML Ain't Markup Language)

### 3. Mapeamento de Dados

#### POST /api/map
Aplica mapeamento de campos em dados estruturados.

**Parâmetros:**
```json
{
  "sourceFields": ["nome", "idade", "email"],
  "targetFields": ["name", "age", "email"],
  "mapping": {
    "nome": "name",
    "idade": "age",
    "email": "email"
  },
  "data": [
    {"nome": "João", "idade": 25, "email": "joao@email.com"},
    {"nome": "Maria", "idade": 30, "email": "maria@email.com"}
  ],
  "options": {
    "strict": false,
    "fillUnmapped": true,
    "defaultValue": null
  }
}
```

**Resposta:**
```json
{
  "success": true,
  "data": [
    {"name": "João", "age": 25, "email": "joao@email.com"},
    {"name": "Maria", "age": 30, "email": "maria@email.com"}
  ],
  "mapping": {
    "sourceFieldsCount": 3,
    "targetFieldsCount": 3,
    "mappingRules": 3,
    "processingTime": 8,
    "options": {...}
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

#### POST /api/map/auto
Gera mapeamento automático entre campos.

**Parâmetros:**
```json
{
  "sourceFields": ["nome", "idade", "email"],
  "targetFields": ["name", "age", "email"],
  "strategy": "similarity"
}
```

**Estratégias Disponíveis:**
- `similarity`: Baseado em similaridade de nomes
- `position`: Baseado na posição dos campos

#### POST /api/map/validate
Valida um esquema de mapeamento.

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

### Conversão CSV para JSON
```bash
curl -X POST http://localhost:3000/api/convert \
  -H "Content-Type: application/json" \
  -d '{
    "sourceFormat": "csv",
    "targetFormat": "json",
    "data": "nome,idade\nJoão,25\nMaria,30"
  }'
```

### Mapeamento de Campos
```bash
curl -X POST http://localhost:3000/api/map \
  -H "Content-Type: application/json" \
  -d '{
    "sourceFields": ["nome", "idade"],
    "targetFields": ["name", "age"],
    "mapping": {"nome": "name", "idade": "age"},
    "data": [{"nome": "João", "idade": 25}]
  }'
```

### Verificação de Saúde
```bash
curl http://localhost:3000/api/health
```

## Suporte e Contato

Para suporte técnico ou dúvidas sobre a API:

1. Consulte os logs da aplicação
2. Verifique o endpoint `/api/docs` para documentação interativa
3. Abra uma issue no repositório GitHub
4. Entre em contato com a equipe de desenvolvimento

---

**Versão da API:** 1.0.0  
**Última atualização:** Janeiro 2024
