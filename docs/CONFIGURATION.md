# Guia de Configuração - DePara

## 📋 Visão Geral

O DePara oferece configurações flexíveis para adaptar-se a diferentes ambientes e necessidades. Este guia cobre todas as opções de configuração disponíveis.

## 🔧 Configuração Básica

### Arquivo de Ambiente (.env)

Crie um arquivo `.env` na raiz do projeto baseado no `env.example`:

```bash
# Copiar arquivo de exemplo
cp env.example .env

# Editar configurações
nano .env
```

### Variáveis de Ambiente

```bash
# Porta da aplicação
PORT=3000

# Ambiente de execução
NODE_ENV=production

# Nível de log
LOG_LEVEL=info

# Configurações de backup
BACKUP_RETENTION_DAYS=30
BACKUP_FOLDER=./backups

# Configurações de slideshow
SLIDESHOW_DEFAULT_INTERVAL=40000
SLIDESHOW_DEFAULT_EXTENSIONS=jpg,jpeg,png,gif,bmp

# Configurações de API
API_RATE_LIMIT=100
API_TIMEOUT=30000
```

## 🗂️ Configuração de Operações de Arquivo

### Estrutura de Pastas

```bash
# Pastas padrão criadas automaticamente
backups/          # Backups automáticos
logs/             # Logs da aplicação
temp/             # Arquivos temporários
```

### Configurações de Backup

```javascript
// Configurações padrão de backup
const backupConfig = {
  enabled: true,
  retentionDays: 30,
  folder: './backups',
  prefix: 'backup_',
  compress: false
};
```

### Configurações de Operações

```javascript
// Configurações padrão para operações
const operationConfig = {
  preserveStructure: true,
  backupBeforeMove: true,
  overwrite: false,
  createDirectories: true
};
```

## 🖼️ Configuração do Slideshow

### Configurações Padrão

```javascript
// Configurações do slideshow
const slideshowConfig = {
  interval: 40000,           // 40 segundos
  random: true,              // Ordem aleatória
  preload: true,             // Pré-carregar imagens
  extensions: ['.jpg', '.jpeg', '.png', '.gif', '.bmp'],
  recursive: true,           // Busca recursiva
  maxDepth: 10               // Profundidade máxima
};
```

### Personalização via Interface

1. Acesse `http://localhost:3000/ui`
2. Clique em **"Slideshow de Imagens"**
3. Configure as opções desejadas:
   - **Intervalo**: Tempo entre imagens (em milissegundos)
   - **Ordem**: Aleatória ou sequencial
   - **Extensões**: Tipos de arquivo aceitos
   - **Busca Recursiva**: Incluir subpastas
   - **Profundidade**: Nível máximo de subpastas

### Configuração de Pastas

```javascript
// Pastas para operações do slideshow
const slideshowFolders = {
  hidden: '/caminho/para/ocultas',    // Pasta para imagens ocultas
  deleted: '/caminho/para/excluidas'  // Pasta para imagens apagadas
};
```

## 🍓 Configuração para Raspberry Pi

### Detecção Automática

O DePara detecta automaticamente se está rodando em Raspberry Pi e aplica otimizações:

```javascript
// Detecção automática de Raspberry Pi
const isRaspberryPi = process.platform === 'linux' && 
                     (process.arch === 'arm' || process.arch === 'arm64');

if (isRaspberryPi) {
  // Aplicar otimizações específicas
  console.log('🍓 Raspberry Pi detectado - aplicando otimizações');
}
```

### Configurações Específicas

```bash
# Configurações recomendadas para Raspberry Pi
NODE_ENV=production
LOG_LEVEL=warn
SLIDESHOW_DEFAULT_INTERVAL=60000
API_RATE_LIMIT=50
```

### Configuração como Serviço

```bash
# Arquivo de serviço systemd
sudo nano /etc/systemd/system/depara.service
```

```ini
[Unit]
Description=DePara File Manager
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/DePara
ExecStart=/usr/bin/node src/main.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

## 🔒 Configurações de Segurança

### Rate Limiting

```javascript
// Configurações de rate limiting
const rateLimitConfig = {
  read: {
    windowMs: 15 * 60 * 1000,  // 15 minutos
    max: 100                    // 100 requisições por IP
  },
  normal: {
    windowMs: 15 * 60 * 1000,
    max: 50
  },
  strict: {
    windowMs: 15 * 60 * 1000,
    max: 10
  }
};
```

### CORS

```javascript
// Configurações de CORS
const corsConfig = {
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://seudominio.com'] 
    : true,
  credentials: true,
  optionsSuccessStatus: 200
};
```

### Headers de Segurança

```javascript
// Configurações do Helmet
const helmetConfig = {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "blob:"]
    }
  }
};
```

## 📊 Configurações de Monitoramento

### Logs

```javascript
// Configurações de log
const logConfig = {
  level: process.env.LOG_LEVEL || 'info',
  format: 'combined',
  file: './logs/app.log',
  maxSize: '10m',
  maxFiles: 5
};
```

### Métricas

```javascript
// Configurações de métricas
const metricsConfig = {
  enabled: true,
  interval: 60000,  // 1 minuto
  memory: true,
  cpu: true,
  disk: true
};
```

## 🔄 Configurações de Agendamento

### Frequências Disponíveis

```javascript
const frequencies = {
  '30s': 30 * 1000,      // 30 segundos
  '1m': 60 * 1000,       // 1 minuto
  '5m': 5 * 60 * 1000,   // 5 minutos
  '15m': 15 * 60 * 1000, // 15 minutos
  '30m': 30 * 60 * 1000, // 30 minutos
  '1h': 60 * 60 * 1000,  // 1 hora
  '6h': 6 * 60 * 60 * 1000, // 6 horas
  '12h': 12 * 60 * 60 * 1000, // 12 horas
  '1d': 24 * 60 * 60 * 1000  // 1 dia
};
```

### Configuração de Tarefas

```javascript
// Exemplo de configuração de tarefa
const taskConfig = {
  name: 'Backup Diário',
  frequency: '1d',
  action: 'copy',
  sourcePath: '/dados',
  targetPath: '/backup/diario',
  options: {
    batch: true,
    preserveStructure: true,
    backupBeforeMove: false
  }
};
```

## 🛡️ Configurações de Proteção

### Arquivos Ignorados

```javascript
// Padrões de arquivos automaticamente ignorados
const ignoredPatterns = [
  // Resilio Sync
  '.sync',
  '.!sync',
  '.rsls',
  '.syncignore',
  '.bts',
  '*.!sync',
  '*.sync',
  '*.rsls',
  '*.bts',
  
  // Sistema
  'Thumbs.db',
  '.DS_Store',
  'desktop.ini',
  
  // Temporários
  '*.tmp',
  '*.temp',
  '*.bak',
  '*.backup',
  '*.log',
  '__pycache__',
  'node_modules'
];
```

### Validação de Caminhos

```javascript
// Configurações de validação
const pathValidation = {
  allowedPaths: ['/home', '/mnt', '/media'],
  blockedPaths: ['/etc', '/sys', '/proc', '/dev'],
  maxDepth: 10,
  checkPermissions: true
};
```

## 🔧 Configurações Avançadas

### Cache

```javascript
// Configurações de cache
const cacheConfig = {
  enabled: true,
  ttl: 300000,  // 5 minutos
  maxSize: 100,
  strategy: 'lru'
};
```

### Timeouts

```javascript
// Configurações de timeout
const timeoutConfig = {
  api: 30000,      // 30 segundos
  fileOperation: 60000,  // 1 minuto
  slideshow: 10000  // 10 segundos
};
```

### Retry

```javascript
// Configurações de retry
const retryConfig = {
  maxAttempts: 3,
  delay: 1000,     // 1 segundo
  backoff: 2,      // Multiplicador exponencial
  maxDelay: 10000  // 10 segundos máximo
};
```

## 📝 Exemplos de Configuração

### Configuração Mínima

```bash
# .env mínimo
PORT=3000
NODE_ENV=production
LOG_LEVEL=info
```

### Configuração Completa

```bash
# .env completo
PORT=3000
NODE_ENV=production
LOG_LEVEL=info

# Backup
BACKUP_RETENTION_DAYS=30
BACKUP_FOLDER=./backups

# Slideshow
SLIDESHOW_DEFAULT_INTERVAL=40000
SLIDESHOW_DEFAULT_EXTENSIONS=jpg,jpeg,png,gif,bmp

# API
API_RATE_LIMIT=100
API_TIMEOUT=30000

# Segurança
CORS_ORIGIN=https://seudominio.com
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=100
```

### Configuração para Desenvolvimento

```bash
# .env para desenvolvimento
PORT=3000
NODE_ENV=development
LOG_LEVEL=debug

# Desabilitar algumas verificações
DISABLE_RATE_LIMIT=true
DISABLE_CORS=true
```

## 🔄 Aplicando Configurações

### Reiniciar Aplicação

```bash
# Reiniciar com PM2
npm run restart:bg

# Reiniciar serviço (Raspberry Pi)
sudo systemctl restart depara
```

### Verificar Configurações

```bash
# Verificar configurações ativas
curl http://localhost:3000/api/health

# Verificar logs
tail -f logs/app.log
```

## 🆘 Solução de Problemas

### Problema: Configuração não aplicada
```bash
# Verificar se arquivo .env existe
ls -la .env

# Verificar sintaxe
cat .env

# Reiniciar aplicação
npm run restart:bg
```

### Problema: Erro de permissão
```bash
# Verificar permissões do arquivo .env
ls -la .env

# Corrigir permissões
chmod 600 .env
```

### Problema: Variável não reconhecida
```bash
# Verificar se variável está definida
echo $NODE_ENV

# Verificar logs da aplicação
grep "NODE_ENV" logs/app.log
```

---

**DePara** - Configuração flexível e poderosa! 🚀
