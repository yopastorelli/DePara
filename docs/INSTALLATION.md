# Guia de Instalação - DePara

## 📋 Pré-requisitos

### Sistema Operacional
- **Windows**: 10 ou superior
- **Linux**: Ubuntu 18.04+, Debian 10+, CentOS 7+
- **macOS**: 10.15 ou superior
- **Raspberry Pi**: Raspbian Buster+ ou Ubuntu 20.04+

### Software Necessário
- **Node.js**: Versão 16.0.0 ou superior
- **npm**: Versão 8.0.0 ou superior
- **Git**: Para clonar o repositório

### Verificação das Versões
```bash
node --version    # Deve retornar v16.0.0 ou superior
npm --version     # Deve retornar 8.0.0 ou superior
git --version     # Qualquer versão recente
```

## 🚀 Instalação Automática (Recomendado)

### Windows
```batch
# 1. Clone o repositório
git clone https://github.com/yopastorelli/DePara.git
cd DePara

# 2. Execute o instalador
install.bat
```

### Linux/macOS
```bash
# 1. Clone o repositório
git clone https://github.com/yopastorelli/DePara.git
cd DePara

# 2. Torne o script executável
chmod +x install.sh

# 3. Execute o instalador
./install.sh
```

### Raspberry Pi
```bash
# 1. Clone o repositório
git clone https://github.com/yopastorelli/DePara.git
cd DePara

# 2. Torne o script executável
chmod +x install-raspberry.sh

# 3. Execute o instalador específico para Raspberry Pi
./install-raspberry.sh
```

## 🔧 Instalação Manual

### 1. Clonar o Repositório
```bash
git clone https://github.com/yopastorelli/DePara.git
cd DePara
```

### 2. Instalar Dependências
```bash
npm install
```

### 3. Configurar Ambiente
```bash
# Copiar arquivo de exemplo
cp env.example .env

# Editar configurações (opcional)
nano .env
```

### 4. Criar Estrutura de Pastas
```bash
# Criar pastas necessárias
mkdir -p logs backups temp

# Definir permissões (Linux/macOS)
chmod 755 logs backups temp
```

### 5. Executar a Aplicação

#### Modo Desenvolvimento
```bash
npm run dev
```

#### Modo Produção
```bash
npm start
```

#### Modo Produção com PM2 (Recomendado)
```bash
# Instalar PM2 globalmente
npm install -g pm2

# Iniciar aplicação
npm run start:bg

# Verificar status
npm run status

# Ver logs
npm run logs
```

## 🍓 Instalação no Raspberry Pi

### Pré-requisitos Específicos
```bash
# Atualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Node.js 16+
curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -
sudo apt-get install -y nodejs

# Instalar dependências adicionais
sudo apt-get install -y git build-essential
```

### Instalação Automática
```bash
# Executar script de instalação
./install-raspberry.sh
```

### Configuração como Serviço
```bash
# Copiar arquivo de serviço
sudo cp depara.service /etc/systemd/system/

# Recarregar systemd
sudo systemctl daemon-reload

# Habilitar serviço
sudo systemctl enable depara

# Iniciar serviço
sudo systemctl start depara

# Verificar status
sudo systemctl status depara
```

### Verificação da Instalação
```bash
# Verificar se a aplicação está rodando
curl http://localhost:3000/api/health

# Verificar logs
sudo journalctl -u depara -f
```

## 🌐 Configuração de Acesso

### Acesso Local
- **Interface Web**: http://localhost:3000/ui
- **API**: http://localhost:3000/api
- **Health Check**: http://localhost:3000/api/health

### Acesso Remoto (Raspberry Pi)
```bash
# Descobrir IP do Raspberry Pi
hostname -I

# Acessar de outro dispositivo
http://[IP_DO_RASPBERRY_PI]:3000/ui
```

## 🔧 Configurações Avançadas

### Variáveis de Ambiente (.env)
```bash
# Porta da aplicação
PORT=3000

# Ambiente
NODE_ENV=production

# Configurações de log
LOG_LEVEL=info

# Configurações de backup
BACKUP_RETENTION_DAYS=30
```

### Configuração de Firewall (Linux)
```bash
# Permitir porta 3000
sudo ufw allow 3000

# Verificar status
sudo ufw status
```

### Configuração de Proxy Reverso (Nginx)
```nginx
server {
    listen 80;
    server_name seu-dominio.com;

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

## 🧪 Verificação da Instalação

### Teste Básico
```bash
# Verificar se a aplicação responde
curl http://localhost:3000/api/health

# Resposta esperada
{
  "status": "OK",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 123.45,
  "environment": "production",
  "version": "1.0.0"
}
```

### Teste de Operação de Arquivo
```bash
# Criar arquivo de teste
echo "teste" > /tmp/teste.txt

# Mover arquivo via API
curl -X POST http://localhost:3000/api/files/execute \
  -H "Content-Type: application/json" \
  -d '{
    "action": "move",
    "sourcePath": "/tmp/teste.txt",
    "targetPath": "/tmp/teste_movido.txt"
  }'
```

### Teste de Slideshow
```bash
# Listar imagens
curl -X POST http://localhost:3000/api/files/list-images \
  -H "Content-Type: application/json" \
  -d '{
    "folderPath": "/caminho/para/imagens",
    "extensions": ["jpg", "png"],
    "recursive": true
  }'
```

## 🆘 Solução de Problemas

### Problema: Aplicação não inicia
```bash
# Verificar logs
npm run logs

# Verificar dependências
npm install

# Verificar porta
netstat -tulpn | grep :3000
```

### Problema: Erro de permissão
```bash
# Corrigir permissões (Linux/macOS)
sudo chown -R $USER:$USER /caminho/do/projeto
chmod -R 755 /caminho/do/projeto
```

### Problema: Porta já em uso
```bash
# Encontrar processo usando a porta
lsof -i :3000

# Matar processo
kill -9 [PID]
```

### Problema: Slideshow não carrega imagens
```bash
# Verificar permissões da pasta
ls -la /caminho/para/imagens

# Verificar logs da aplicação
tail -f logs/app.log
```

## 🔄 Atualização

### Atualizar Código
```bash
# Parar aplicação
npm run stop:bg

# Atualizar código
git pull origin main

# Instalar novas dependências
npm install

# Reiniciar aplicação
npm run start:bg
```

### Atualizar no Raspberry Pi
```bash
# Parar serviço
sudo systemctl stop depara

# Atualizar código
git pull origin main
npm install

# Reiniciar serviço
sudo systemctl start depara
```

## 📞 Suporte

Se encontrar problemas durante a instalação:

1. Verifique os logs da aplicação
2. Consulte a seção de troubleshooting
3. Abra uma issue no GitHub
4. Entre em contato com a equipe de desenvolvimento

---

**DePara** - Instalação simples e eficiente! 🚀
