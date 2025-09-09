# Exemplos Práticos - DePara

## 🚀 Exemplos de Uso da API

### 1. Operações Básicas de Arquivo

#### Mover Arquivo com Backup
```bash
curl -X POST http://localhost:3000/api/files/execute \
  -H "Content-Type: application/json" \
  -d '{
    "action": "move",
    "sourcePath": "/home/usuario/documentos/arquivo.txt",
    "targetPath": "/home/usuario/backup/arquivo.txt",
    "options": {
      "backupBeforeMove": true,
      "preserveStructure": true
    }
  }'
```

#### Copiar Arquivo
```bash
curl -X POST http://localhost:3000/api/files/execute \
  -H "Content-Type: application/json" \
  -d '{
    "action": "copy",
    "sourcePath": "/home/usuario/fotos/vacacao.jpg",
    "targetPath": "/home/usuario/backup/vacacao.jpg",
    "options": {
      "overwrite": false
    }
  }'
```

#### Apagar Arquivo
```bash
curl -X POST http://localhost:3000/api/files/execute \
  -H "Content-Type: application/json" \
  -d '{
    "action": "delete",
    "sourcePath": "/home/usuario/temp/arquivo_temporario.txt"
  }'
```

### 2. Operações em Lote

#### Mover Todos os Arquivos de uma Pasta
```bash
curl -X POST http://localhost:3000/api/files/execute \
  -H "Content-Type: application/json" \
  -d '{
    "action": "move",
    "sourcePath": "/home/usuario/downloads",
    "targetPath": "/home/usuario/organizados",
    "options": {
      "batch": true,
      "preserveStructure": true,
      "filters": {
        "extensions": ["jpg", "png", "pdf"]
      }
    }
  }'
```

### 3. Agendamento de Tarefas

#### Backup Diário
```bash
curl -X POST http://localhost:3000/api/files/schedule \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Backup Diário",
    "frequency": "1d",
    "action": "copy",
    "sourcePath": "/home/usuario/dados",
    "targetPath": "/home/usuario/backup/diario",
    "options": {
      "batch": true,
      "preserveStructure": true,
      "backupBeforeMove": false
    }
  }'
```

#### Limpeza Semanal
```bash
curl -X POST http://localhost:3000/api/files/schedule \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Limpeza Semanal",
    "frequency": "7d",
    "action": "delete",
    "sourcePath": "/home/usuario/temp",
    "options": {
      "batch": true,
      "filters": {
        "extensions": ["tmp", "temp", "log"],
        "maxAge": "7d"
      }
    }
  }'
```

### 4. Slideshow de Imagens

#### Listar Imagens para Slideshow
```bash
curl -X POST http://localhost:3000/api/files/list-images \
  -H "Content-Type: application/json" \
  -d '{
    "folderPath": "/home/usuario/fotos",
    "extensions": ["jpg", "jpeg", "png", "gif"],
    "recursive": true,
    "maxDepth": 5
  }'
```

#### Servir Imagem Específica
```bash
# URL codificada para a imagem
curl "http://localhost:3000/api/files/image/%2Fhome%2Fusuario%2Ffotos%2Fvacacao.jpg"
```

### 5. Monitoramento e Status

#### Verificar Saúde da Aplicação
```bash
curl http://localhost:3000/api/health
```

#### Listar Operações Agendadas
```bash
curl http://localhost:3000/api/files/scheduled
```

#### Verificar Recursos do Sistema
```bash
curl http://localhost:3000/api/status/resources
```

## 🖼️ Exemplos de Slideshow

### Configuração Básica
```javascript
// Configuração via interface web
const slideshowConfig = {
  interval: 40000,           // 40 segundos
  random: true,              // Ordem aleatória
  preload: true,             // Pré-carregar imagens
  extensions: ['.jpg', '.jpeg', '.png', '.gif'],
  recursive: true,           // Busca recursiva
  hiddenFolder: '/caminho/para/ocultas',
  deletedFolder: '/caminho/para/excluidas'
};
```

### Navegação no Slideshow
```javascript
// Controles disponíveis
const controls = {
  // Teclado
  'ArrowLeft': 'imagem anterior',
  'ArrowRight': 'próxima imagem',
  'Escape': 'sair do slideshow',
  'Space': 'pausar/retomar',
  
  // Mouse
  'Click esquerdo': 'próxima imagem',
  'Click direito': 'imagem anterior',
  'Scroll': 'navegar',
  
  // Botões na tela
  '←': 'imagem anterior',
  '→': 'próxima imagem',
  '👁️': 'ocultar imagem',
  '🗑️': 'apagar imagem',
  '✕': 'sair'
};
```

## 🍓 Exemplos para Raspberry Pi

### Instalação e Configuração
```bash
# 1. Instalar dependências
sudo apt update
sudo apt install -y nodejs npm git

# 2. Clonar repositório
git clone https://github.com/yopastorelli/DePara.git
cd DePara

# 3. Instalar aplicação
npm install

# 4. Configurar como serviço
sudo cp depara.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable depara
sudo systemctl start depara
```

### Configuração Otimizada
```bash
# Configurações específicas para Raspberry Pi
cat > .env << EOF
PORT=3000
NODE_ENV=production
LOG_LEVEL=warn
SLIDESHOW_DEFAULT_INTERVAL=60000
API_RATE_LIMIT=50
EOF
```

### Monitoramento
```bash
# Verificar status do serviço
sudo systemctl status depara

# Ver logs em tempo real
sudo journalctl -u depara -f

# Verificar uso de recursos
htop
```

## 🔧 Exemplos de Scripts

### Script de Backup Automático
```bash
#!/bin/bash
# backup-daily.sh

# Configurações
SOURCE_DIR="/home/usuario/dados"
BACKUP_DIR="/home/usuario/backup/$(date +%Y-%m-%d)"
API_URL="http://localhost:3000/api/files/execute"

# Criar backup via API
curl -X POST $API_URL \
  -H "Content-Type: application/json" \
  -d "{
    \"action\": \"copy\",
    \"sourcePath\": \"$SOURCE_DIR\",
    \"targetPath\": \"$BACKUP_DIR\",
    \"options\": {
      \"batch\": true,
      \"preserveStructure\": true
    }
  }"

echo "Backup concluído: $BACKUP_DIR"
```

### Script de Limpeza
```bash
#!/bin/bash
# cleanup.sh

# Limpar arquivos temporários
curl -X POST http://localhost:3000/api/files/execute \
  -H "Content-Type: application/json" \
  -d '{
    "action": "delete",
    "sourcePath": "/tmp",
    "options": {
      "batch": true,
      "filters": {
        "extensions": ["tmp", "temp", "log"],
        "maxAge": "7d"
      }
    }
  }'

echo "Limpeza concluída"
```

### Script de Monitoramento
```bash
#!/bin/bash
# monitor.sh

# Verificar saúde da aplicação
HEALTH=$(curl -s http://localhost:3000/api/health | jq -r '.status')

if [ "$HEALTH" != "OK" ]; then
    echo "ALERTA: Aplicação não está funcionando"
    # Enviar notificação ou reiniciar
    sudo systemctl restart depara
else
    echo "Aplicação funcionando normalmente"
fi
```

## 📊 Exemplos de Integração

### Integração com Cron
```bash
# Adicionar ao crontab
crontab -e

# Backup diário às 2h da manhã
0 2 * * * /home/usuario/DePara/backup-daily.sh

# Limpeza semanal aos domingos às 3h
0 3 * * 0 /home/usuario/DePara/cleanup.sh

# Monitoramento a cada 5 minutos
*/5 * * * * /home/usuario/DePara/monitor.sh
```

### Integração com Nginx
```nginx
# /etc/nginx/sites-available/depara
server {
    listen 80;
    server_name depara.local;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Integração com Docker
```dockerfile
# Dockerfile
FROM node:16-alpine

WORKDIR /app
COPY package*.json ./
RUN npm install --production

COPY . .

EXPOSE 3000
CMD ["npm", "start"]
```

```yaml
# docker-compose.yml
version: '3.8'
services:
  depara:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data
      - ./backups:/app/backups
      - ./logs:/app/logs
    environment:
      - NODE_ENV=production
      - PORT=3000
```

## 🎯 Casos de Uso Reais

### 1. Organização de Fotos
```bash
# Mover fotos por data
curl -X POST http://localhost:3000/api/files/execute \
  -H "Content-Type: application/json" \
  -d '{
    "action": "move",
    "sourcePath": "/home/usuario/fotos/raw",
    "targetPath": "/home/usuario/fotos/organizadas",
    "options": {
      "batch": true,
      "preserveStructure": true,
      "filters": {
        "extensions": ["jpg", "jpeg", "png"],
        "maxAge": "30d"
      }
    }
  }'
```

### 2. Backup de Documentos
```bash
# Backup automático de documentos
curl -X POST http://localhost:3000/api/files/schedule \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Backup Documentos",
    "frequency": "6h",
    "action": "copy",
    "sourcePath": "/home/usuario/documentos",
    "targetPath": "/mnt/backup/documentos",
    "options": {
      "batch": true,
      "preserveStructure": true
    }
  }'
```

### 3. Limpeza de Logs
```bash
# Limpeza automática de logs antigos
curl -X POST http://localhost:3000/api/files/schedule \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Limpeza Logs",
    "frequency": "1d",
    "action": "delete",
    "sourcePath": "/var/log",
    "options": {
      "batch": true,
      "filters": {
        "extensions": ["log"],
        "maxAge": "30d"
      }
    }
  }'
```

## 🔍 Debugging e Testes

### Teste de Conectividade
```bash
# Testar se API está respondendo
curl -I http://localhost:3000/api/health

# Testar operação simples
curl -X POST http://localhost:3000/api/files/execute \
  -H "Content-Type: application/json" \
  -d '{"action": "test"}'
```

### Teste de Performance
```bash
# Teste de carga simples
for i in {1..10}; do
  curl -s http://localhost:3000/api/health > /dev/null
  echo "Request $i completed"
done
```

### Teste de Slideshow
```bash
# Testar listagem de imagens
curl -X POST http://localhost:3000/api/files/list-images \
  -H "Content-Type: application/json" \
  -d '{
    "folderPath": "/tmp",
    "extensions": ["jpg", "png"],
    "recursive": false
  }'
```

---

**DePara** - Exemplos práticos para todos os casos de uso! 🚀
