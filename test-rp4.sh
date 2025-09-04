#!/bin/bash

# Script de Teste para Raspberry Pi 4
# DePara - Verificação de Funcionalidade
#
# @author yopastorelli
# @version 1.0.0

echo "========================================"
echo "    TESTE DEPARA - RASPBERRY PI 4"
echo "========================================"
echo ""

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

# Verificar se está no diretório correto
if [ ! -f "package.json" ]; then
    log_error "Execute este script no diretório raiz do projeto DePara"
    log_info "Exemplo: cd /path/to/DePara && bash test-rp4.sh"
    exit 1
fi

log_info "Iniciando testes no Raspberry Pi 4..."
echo ""

# Teste 1: Verificar Node.js
log_info "Teste 1: Verificando Node.js..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    log_success "Node.js encontrado: $NODE_VERSION"

    # Verificar versão
    NODE_MAJOR=$(echo $NODE_VERSION | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_MAJOR" -ge 16 ]; then
        log_success "Versão do Node.js compatível"
    else
        log_warning "Versão do Node.js pode ser antiga: $NODE_VERSION"
    fi
else
    log_error "Node.js não encontrado!"
    log_info "Instale o Node.js 18.x: curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash - && sudo apt install -y nodejs"
    exit 1
fi
echo ""

# Teste 2: Verificar npm
log_info "Teste 2: Verificando npm..."
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    log_success "npm encontrado: $NPM_VERSION"
else
    log_error "npm não encontrado!"
    exit 1
fi
echo ""

# Teste 3: Verificar dependências
log_info "Teste 3: Verificando dependências do projeto..."
if [ -d "node_modules" ]; then
    DEP_COUNT=$(find node_modules -maxdepth 1 -type d | wc -l)
    log_success "Dependências instaladas ($((DEP_COUNT-1)) pacotes encontrados)"
else
    log_warning "Dependências não instaladas"
    log_info "Execute: npm install"
fi
echo ""

# Teste 4: Verificar arquivo de configuração
log_info "Teste 4: Verificando arquivo de configuração..."
if [ -f ".env" ]; then
    log_success "Arquivo .env encontrado"
    # Verificar configurações críticas
    if grep -q "PORT=3000" .env; then
        log_success "Porta configurada corretamente"
    else
        log_warning "Porta pode não estar configurada"
    fi
else
    log_warning "Arquivo .env não encontrado"
    log_info "Execute: cp env.example .env"
fi
echo ""

# Teste 5: Verificar diretórios necessários
log_info "Teste 5: Verificando diretórios necessários..."
DIRS=("logs" "backups")
for dir in "${DIRS[@]}"; do
    if [ -d "$dir" ]; then
        log_success "Diretório $dir existe"
    else
        log_warning "Diretório $dir não existe"
        mkdir -p "$dir"
        log_info "Diretório $dir criado"
    fi
done
echo ""

# Teste 6: Verificar recursos do sistema
log_info "Teste 6: Verificando recursos do sistema..."
echo "Memória disponível:"
free -h | grep "Mem:"
echo ""
echo "Espaço em disco:"
df -h / | tail -1
echo ""

# Teste 7: Teste de inicialização da aplicação
log_info "Teste 7: Testando inicialização da aplicação..."
echo "Tentando iniciar aplicação por 10 segundos..."
timeout 10s node src/main.js > /tmp/depara-test.log 2>&1 &
TEST_PID=$!
sleep 8

if kill -0 $TEST_PID 2>/dev/null; then
    log_success "Aplicação iniciou com sucesso"
    kill $TEST_PID
else
    log_warning "Aplicação pode não ter iniciado corretamente"
    echo "Logs de teste:"
    cat /tmp/depara-test.log 2>/dev/null || echo "Nenhum log gerado"
fi
echo ""

# Teste 8: Verificar conectividade
log_info "Teste 8: Verificando conectividade..."
IP_ADDRESS=$(hostname -I | awk '{print $1}')
if [ ! -z "$IP_ADDRESS" ]; then
    log_success "IP do Raspberry Pi: $IP_ADDRESS"
    echo "Aplicação deve estar disponível em: http://$IP_ADDRESS:3000"
else
    log_warning "Não foi possível determinar o IP"
fi
echo ""

# Teste 9: Verificar temperatura (se disponível)
log_info "Teste 9: Verificando temperatura..."
if command -v vcgencmd &> /dev/null; then
    TEMP=$(vcgencmd measure_temp)
    log_success "Temperatura do CPU: $TEMP"
else
    log_info "Comando vcgencmd não disponível (não é um Raspberry Pi?)"
fi
echo ""

# Resumo final
echo "========================================"
echo "        RESUMO DOS TESTES"
echo "========================================"
echo ""
log_info "Para iniciar a aplicação:"
echo "  npm start                    # Modo produção"
echo "  npm run dev                  # Modo desenvolvimento"
echo ""
log_info "Para acessar a aplicação:"
echo "  http://$IP_ADDRESS:3000      # Local"
echo "  http://localhost:3000        # Localhost"
echo ""
log_info "Para monitorar:"
echo "  tail -f logs/app.log         # Logs da aplicação"
echo "  htop                         # Monitor de sistema"
echo ""
log_info "Para configurar como serviço:"
echo "  sudo systemctl enable depara # Habilitar serviço"
echo "  sudo systemctl start depara  # Iniciar serviço"
echo ""

log_success "Teste concluído! 🍓"
echo ""
echo "Se encontrou algum problema, consulte o README-Raspbian.md"
echo "para instruções detalhadas de solução de problemas."
