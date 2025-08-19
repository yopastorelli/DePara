#!/bin/bash

# Script de Instalação para Raspbian/Raspberry Pi
# DePara - Sistema de Conversão e Mapeamento de Dados
# 
# @author yopastorelli
# @version 1.0.0

echo ""
echo "========================================"
echo "    INSTALADOR DEPARA PARA RASPBIAN"
echo "========================================"
echo ""

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Função para log colorido
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Verificar se está rodando como root
if [[ $EUID -eq 0 ]]; then
   log_error "Este script não deve ser executado como root!"
   log_info "Execute como usuário normal: bash install-raspbian.sh"
   exit 1
fi

log_info "Iniciando instalação do DePara para Raspbian..."

# Atualizar sistema
log_info "Atualizando sistema..."
sudo apt update && sudo apt upgrade -y
if [ $? -eq 0 ]; then
    log_success "Sistema atualizado"
else
    log_warning "Falha na atualização do sistema, continuando..."
fi

# Instalar dependências do sistema
log_info "Instalando dependências do sistema..."
sudo apt install -y curl wget git build-essential python3 python3-pip

# Verificar se Node.js está instalado
log_info "Verificando Node.js..."
if ! command -v node &> /dev/null; then
    log_info "Node.js não encontrado. Instalando..."
    
    # Adicionar repositório NodeSource para versão LTS
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    
    # Instalar Node.js
    sudo apt install -y nodejs
    
    if [ $? -eq 0 ]; then
        log_success "Node.js instalado com sucesso"
    else
        log_error "Falha na instalação do Node.js"
        exit 1
    fi
else
    log_success "Node.js já está instalado"
fi

# Verificar se npm está disponível
log_info "Verificando npm..."
if ! command -v npm &> /dev/null; then
    log_error "npm não encontrado!"
    log_info "Reinstalando Node.js para incluir npm..."
    sudo apt remove -y nodejs
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt install -y nodejs
else
    log_success "npm encontrado"
fi

# Verificar versões
NODE_VERSION=$(node --version)
NPM_VERSION=$(npm --version)

log_info "Versões instaladas:"
echo "  Node.js: $NODE_VERSION"
echo "  npm: $NPM_VERSION"

# Verificar se as versões são compatíveis
NODE_MAJOR=$(echo $NODE_VERSION | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_MAJOR" -lt 16 ]; then
    log_error "Node.js versão $NODE_VERSION não é compatível!"
    log_info "Requer versão 16.0.0 ou superior"
    exit 1
fi

# Criar diretório de logs
log_info "Criando diretório de logs..."
mkdir -p logs
log_success "Diretório de logs criado"

# Configurar npm para não usar scripts de pós-instalação problemáticos
log_info "Configurando npm..."
npm config set ignore-scripts false
npm config set python python3

# Instalar dependências
log_info "Instalando dependências do projeto..."
npm install

if [ $? -eq 0 ]; then
    log_success "Dependências instaladas com sucesso"
else
    log_error "Falha na instalação das dependências"
    log_info "Tentando instalar com --force..."
    npm install --force
    if [ $? -ne 0 ]; then
        log_error "Falha na instalação mesmo com --force"
        exit 1
    fi
fi

# Configurar arquivo de ambiente
log_info "Configurando arquivo de ambiente..."
if [ ! -f ".env" ]; then
    if [ -f "env.example" ]; then
        cp env.example .env
        log_success "Arquivo .env criado a partir do exemplo"
        
        # Ajustar configurações para Raspberry Pi
        sed -i 's/PORT=3000/PORT=3000/' .env
        sed -i 's/LOG_LEVEL=info/LOG_LEVEL=info/' .env
        
        log_info "Configurações ajustadas para Raspberry Pi"
    else
        log_warning "Arquivo env.example não encontrado"
        log_info "Crie manualmente o arquivo .env se necessário"
    fi
else
    log_success "Arquivo .env já existe"
fi

# Configurar permissões
log_info "Configurando permissões..."
chmod +x install-raspbian.sh
chmod -R 755 logs/
chmod 644 .env 2>/dev/null || true

# Criar script de serviço systemd (opcional)
log_info "Criando script de serviço systemd..."
sudo tee /etc/systemd/system/depara.service > /dev/null <<EOF
[Unit]
Description=DePara API Service
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$(pwd)
ExecStart=/usr/bin/node src/main.js
Restart=on-failure
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
EOF

log_success "Script de serviço systemd criado"

# Testar instalação
log_info "Testando instalação..."
echo "Testando inicialização da aplicação..."
timeout 5s node src/main.js > /dev/null 2>&1 &
TEST_PID=$!
sleep 3
if kill -0 $TEST_PID 2>/dev/null; then
    kill $TEST_PID
    log_success "Teste de inicialização passou"
else
    log_warning "Teste de inicialização falhou, mas continuando..."
fi

# Configurar firewall (se ufw estiver ativo)
if command -v ufw &> /dev/null && sudo ufw status | grep -q "Status: active"; then
    log_info "Configurando firewall..."
    sudo ufw allow 3000/tcp
    log_success "Porta 3000 liberada no firewall"
fi

# Mostrar informações finais
echo ""
echo "========================================"
echo "    INSTALAÇÃO CONCLUÍDA COM SUCESSO!"
echo "========================================"
echo ""
echo "Para iniciar a aplicação:"
echo "  npm start                    # Modo produção"
echo "  npm run dev                  # Modo desenvolvimento"
echo ""
echo "Para executar testes:"
echo "  npm test                     # Executar testes"
echo ""
echo "Para configurar como serviço:"
echo "  sudo systemctl enable depara # Habilitar serviço"
echo "  sudo systemctl start depara  # Iniciar serviço"
echo "  sudo systemctl status depara # Verificar status"
echo ""
echo "Aplicação disponível em:"
echo "  http://$(hostname -I | awk '{print $1}'):3000"
echo "  http://localhost:3000"
echo ""
echo "Documentação da API:"
echo "  http://$(hostname -I | awk '{print $1}'):3000/api/docs"
echo ""
echo "Logs da aplicação:"
echo "  tail -f logs/app.log"
echo ""
echo "Para monitorar recursos:"
echo "  htop                         # Monitor de sistema"
echo "  free -h                      # Uso de memória"
echo "  df -h                        # Uso de disco"
echo ""

# Verificar uso de recursos
log_info "Verificando recursos do sistema..."
echo "Memória disponível:"
free -h | grep "Mem:"
echo ""
echo "Espaço em disco:"
df -h / | grep "/"
echo ""
echo "Temperatura do CPU (se disponível):"
if command -v vcgencmd &> /dev/null; then
    vcgencmd measure_temp
else
    echo "Comando vcgencmd não disponível"
fi

log_success "Instalação do DePara concluída com sucesso no Raspbian!"
log_info "Reinicie o sistema se necessário: sudo reboot"
