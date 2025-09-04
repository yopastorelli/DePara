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

# Função para minimizar para system tray
minimize_to_tray() {
    if check_depara_status; then
        log "📱 Minimizando DePara para system tray..."
        
        # Tentar usar wmctrl para minimizar janelas do navegador
        if command -v wmctrl &> /dev/null; then
            # Minimizar todas as janelas do Chromium/Chrome/Firefox que contenham "DePara" ou "localhost:3000"
            wmctrl -l | grep -E "(DePara|localhost:3000|Chromium|Chrome|Firefox)" | awk '{print $1}' | while read window_id; do
                wmctrl -i -r "$window_id" -b add,hidden 2>/dev/null
            done
            log "✅ DePara minimizado para system tray"
        else
            log "⚠️ wmctrl não encontrado. Instalando..."
            sudo apt update && sudo apt install -y wmctrl
            if command -v wmctrl &> /dev/null; then
                log "✅ wmctrl instalado. Execute novamente: $0 minimize"
            else
                log "❌ Não foi possível instalar wmctrl"
            fi
        fi
    else
        log "❌ DePara não está rodando. Execute: $0 start"
    fi
}

# Função para restaurar do system tray
restore_from_tray() {
    if check_depara_status; then
        log "📱 Restaurando DePara do system tray..."
        
        if command -v wmctrl &> /dev/null; then
            # Restaurar todas as janelas do navegador que contenham "DePara" ou "localhost:3000"
            wmctrl -l | grep -E "(DePara|localhost:3000|Chromium|Chrome|Firefox)" | awk '{print $1}' | while read window_id; do
                wmctrl -i -r "$window_id" -b remove,hidden 2>/dev/null
                wmctrl -i -a "$window_id" 2>/dev/null
            done
            log "✅ DePara restaurado do system tray"
        else
            log "❌ wmctrl não encontrado. Execute: $0 open"
        fi
    else
        log "❌ DePara não está rodando. Execute: $0 start"
    fi
}

# Função para abrir no navegador
open_browser() {
    if check_depara_status; then
        log "🌐 Abrindo DePara no navegador..."
        
        # Tentar abrir em janela dedicada do Chromium (sem flags inseguras)
        if command -v chromium-browser &> /dev/null; then
            log "🚀 Abrindo em janela dedicada do Chromium..."
            chromium-browser --new-window --app="http://localhost:3000" --user-data-dir="/tmp/depara-browser" --no-first-run --no-default-browser-check --disable-extensions 2>/dev/null &
        # Tentar abrir em janela dedicada do Chrome (sem flags inseguras)
        elif command -v google-chrome &> /dev/null; then
            log "🚀 Abrindo em janela dedicada do Chrome..."
            google-chrome --new-window --app="http://localhost:3000" --user-data-dir="/tmp/depara-browser" --no-first-run --no-default-browser-check --disable-extensions 2>/dev/null &
        # Tentar abrir em janela dedicada do Firefox
        elif command -v firefox &> /dev/null; then
            log "🚀 Abrindo em janela dedicada do Firefox..."
            firefox --new-window "http://localhost:3000" 2>/dev/null &
        # Fallback para xdg-open
        else
            log "⚠️ Navegador dedicado não encontrado, usando xdg-open..."
            xdg-open "http://localhost:3000" 2>/dev/null || \
            log "⚠️ Não foi possível abrir o navegador automaticamente"
        fi
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
    echo "  minimize  - Minimizar para system tray"
    echo "  restore   - Restaurar do system tray"
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
    minimize)
        minimize_to_tray
        ;;
    restore)
        restore_from_tray
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
