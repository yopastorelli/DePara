#!/bin/bash

# Script de inicialização do DePara
# Este script inicia o DePara e monitora seu status

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Detectar usuário atual e diretório do projeto
CURRENT_USER=$(whoami)
USER_HOME="/home/$CURRENT_USER"
DEPARA_DIR="$USER_HOME/DePara"
LOG_FILE="$DEPARA_DIR/logs/depara-startup.log"

# Função para log
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

# Função para verificar se o DePara está rodando
check_depara_status() {
    if pgrep -f "node.*main.js" > /dev/null; then
        return 0
    else
        return 1
    fi
}

# Função para iniciar o DePara
start_depara() {
    log "🚀 Iniciando DePara..."
    
    # Navegar para o diretório do projeto
    cd "$DEPARA_DIR" || {
        log "❌ Erro: Não foi possível acessar o diretório $DEPARA_DIR"
        exit 1
    }
    
    # Verificar se o Node.js está instalado
    if ! command -v node &> /dev/null; then
        log "❌ Erro: Node.js não está instalado"
        exit 1
    fi
    
    # Verificar se o npm está instalado
    if ! command -v npm &> /dev/null; then
        log "❌ Erro: npm não está instalado"
        exit 1
    fi
    
    # Instalar dependências se necessário
    if [ ! -d "node_modules" ]; then
        log "📦 Instalando dependências..."
        npm install
    fi
    
    # Iniciar o DePara
    log "🎯 Iniciando servidor DePara na porta 3000..."
    nohup npm start > /dev/null 2>&1 &
    
    # Aguardar um pouco para o servidor inicializar
    sleep 3
    
    # Verificar se o DePara está rodando
    if check_depara_status; then
        log "✅ DePara iniciado com sucesso!"
        log "🌐 Acesse: http://localhost:3000"
        return 0
    else
        log "❌ Erro: Falha ao iniciar o DePara"
        return 1
    fi
}

# Função para parar o DePara
stop_depara() {
    log "🛑 Parando DePara..."
    pkill -f "node.*main.js"
    sleep 2
    
    if ! check_depara_status; then
        log "✅ DePara parado com sucesso!"
    else
        log "⚠️ Aviso: DePara ainda está rodando"
    fi
}

# Função para mostrar status
show_status() {
    if check_depara_status; then
        echo -e "${GREEN}✅ DePara está rodando${NC}"
        echo -e "${BLUE}🌐 Acesse: http://localhost:3000${NC}"
        
        # Mostrar informações do processo
        PID=$(pgrep -f "node.*main.js")
        echo -e "${BLUE}📊 PID: $PID${NC}"
        
        # Mostrar uso de memória
        MEMORY=$(ps -p $PID -o rss= 2>/dev/null | awk '{print $1/1024 " MB"}')
        echo -e "${BLUE}💾 Memória: $MEMORY${NC}"
    else
        echo -e "${RED}❌ DePara não está rodando${NC}"
    fi
}

# Função para abrir no navegador
open_browser() {
    if check_depara_status; then
        log "🌐 Abrindo DePara no navegador..."
        xdg-open "http://localhost:3000" 2>/dev/null || \
        chromium-browser "http://localhost:3000" 2>/dev/null || \
        firefox "http://localhost:3000" 2>/dev/null || \
        log "⚠️ Não foi possível abrir o navegador automaticamente"
    else
        log "❌ DePara não está rodando. Execute: $0 start"
    fi
}

# Função para mostrar ajuda
show_help() {
    echo -e "${BLUE}DePara - Gerenciador de Arquivos${NC}"
    echo ""
    echo "Uso: $0 [comando]"
    echo ""
    echo "Comandos:"
    echo "  start     - Iniciar o DePara"
    echo "  stop      - Parar o DePara"
    echo "  restart   - Reiniciar o DePara"
    echo "  status    - Mostrar status do DePara"
    echo "  open      - Abrir DePara no navegador"
    echo "  help      - Mostrar esta ajuda"
    echo ""
    echo "Exemplos:"
    echo "  $0 start"
    echo "  $0 status"
    echo "  $0 open"
}

# Criar diretório de logs se não existir
mkdir -p "$(dirname "$LOG_FILE")"

# Processar argumentos
case "$1" in
    start)
        if check_depara_status; then
            log "⚠️ DePara já está rodando"
            show_status
        else
            start_depara
        fi
        ;;
    stop)
        stop_depara
        ;;
    restart)
        stop_depara
        sleep 2
        start_depara
        ;;
    status)
        show_status
        ;;
    open)
        open_browser
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        echo -e "${YELLOW}Comando não reconhecido: $1${NC}"
        show_help
        exit 1
        ;;
esac
