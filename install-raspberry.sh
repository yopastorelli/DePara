#!/bin/bash

# Script de instalação do DePara no Raspberry Pi
# Este script configura o DePara para inicialização automática e acesso pelo menu

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Detectar usuário atual
CURRENT_USER=$(whoami)
USER_HOME="/home/$CURRENT_USER"

# Diretórios
DEPARA_DIR="$USER_HOME/DePara"
DESKTOP_DIR="$USER_HOME/Desktop"
APPLICATIONS_DIR="$USER_HOME/.local/share/applications"
SYSTEMD_DIR="/etc/systemd/system"

# Função para log
log() {
    echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} $1"
}

# Função para erro
error() {
    echo -e "${RED}[ERRO]${NC} $1"
}

# Função para sucesso
success() {
    echo -e "${GREEN}[SUCESSO]${NC} $1"
}

# Função para aviso
warning() {
    echo -e "${YELLOW}[AVISO]${NC} $1"
}

# Verificar se está rodando como root
check_root() {
    if [ "$EUID" -eq 0 ]; then
        error "Não execute este script como root. Execute como usuário '$CURRENT_USER'"
        exit 1
    fi
}

# Verificar se o Node.js está instalado
check_nodejs() {
    if ! command -v node &> /dev/null; then
        warning "Node.js não está instalado. Instalando..."
        
        # Instalar Node.js via NodeSource
        curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
        sudo apt-get install -y nodejs
        
        if command -v node &> /dev/null; then
            success "Node.js instalado com sucesso"
        else
            error "Falha ao instalar Node.js"
            exit 1
        fi
    else
        success "Node.js já está instalado: $(node --version)"
    fi
}

# Verificar se o npm está instalado
check_npm() {
    if ! command -v npm &> /dev/null; then
        error "npm não está instalado"
        exit 1
    else
        success "npm já está instalado: $(npm --version)"
    fi
}

# Instalar dependências do sistema
install_system_dependencies() {
    log "Instalando dependências do sistema..."
    
    sudo apt-get update
    sudo apt-get install -y \
        chromium-browser \
        xdg-utils \
        desktop-file-utils \
        hicolor-icon-theme \
        gtk2-engines-murrine \
        gtk2-engines-pixbuf
    
    success "Dependências do sistema instaladas"
}

# Configurar script de inicialização
setup_startup_script() {
    log "Configurando script de inicialização..."
    
    # Tornar o script executável
    chmod +x "$DEPARA_DIR/start-depara.sh"
    
    # Criar link simbólico no PATH
    sudo ln -sf "$DEPARA_DIR/start-depara.sh" /usr/local/bin/depara
    
    success "Script de inicialização configurado"
}

# Configurar arquivo .desktop
setup_desktop_file() {
    log "Configurando arquivo .desktop..."
    
    # Criar diretório de aplicações se não existir
    mkdir -p "$APPLICATIONS_DIR"
    
    # Copiar arquivo .desktop e ajustar caminhos
    cp "$DEPARA_DIR/depara.desktop" "$APPLICATIONS_DIR/"
    
    # Ajustar caminho da aplicacao no template
    sed -i "s|__DEPARA_DIR__|$DEPARA_DIR|g" "$APPLICATIONS_DIR/depara.desktop"
    sed -i "s|/home/pi/DePara|$DEPARA_DIR|g" "$APPLICATIONS_DIR/depara.desktop"
    sed -i "s|/home/yo/DePara|$DEPARA_DIR|g" "$APPLICATIONS_DIR/depara.desktop"

    # Publicar icone no tema local para o menu do desktop
    mkdir -p "$USER_HOME/.local/share/icons/hicolor/192x192/apps"
    if [ -f "$DEPARA_DIR/src/public/favicon/android-chrome-192x192.png" ]; then
        cp "$DEPARA_DIR/src/public/favicon/android-chrome-192x192.png" \
           "$USER_HOME/.local/share/icons/hicolor/192x192/apps/depara.png"
    elif [ -f "$DEPARA_DIR/src/public/favicon/favicon-32x32.png" ]; then
        cp "$DEPARA_DIR/src/public/favicon/favicon-32x32.png" \
           "$USER_HOME/.local/share/icons/hicolor/192x192/apps/depara.png"
    fi
    
    # Atualizar banco de dados de aplicações
    update-desktop-database "$APPLICATIONS_DIR" 2>/dev/null || true
    gtk-update-icon-cache -f -t "$USER_HOME/.local/share/icons" 2>/dev/null || true
    
    # Criar link no desktop
    ln -sf "$APPLICATIONS_DIR/depara.desktop" "$DESKTOP_DIR/"
    
    success "Arquivo .desktop configurado"
}

# Configurar serviço systemd
setup_systemd_service() {
    log "Configurando serviço systemd..."
    
    # Copiar arquivo de serviço e ajustar usuário
    sudo cp "$DEPARA_DIR/depara.service" "$SYSTEMD_DIR/"
    
    # Ajustar usuário no arquivo de serviço
    sudo sed -i "s/User=pi/User=$CURRENT_USER/g" "$SYSTEMD_DIR/depara.service"
    sudo sed -i "s/Group=pi/Group=$CURRENT_USER/g" "$SYSTEMD_DIR/depara.service"
    sudo sed -i "s|WorkingDirectory=/home/pi/DePara|WorkingDirectory=$DEPARA_DIR|g" "$SYSTEMD_DIR/depara.service"
    sudo sed -i "s|ReadWritePaths=/home/pi/DePara|ReadWritePaths=$DEPARA_DIR|g" "$SYSTEMD_DIR/depara.service"
    
    # Recarregar systemd
    sudo systemctl daemon-reload
    
    # Habilitar serviço
    sudo systemctl enable depara.service
    
    success "Serviço systemd configurado"
}

# Configurar inicialização automática
setup_autostart() {
    log "Configurando inicialização automática..."
    
    # Criar diretório de autostart
    mkdir -p "$HOME/.config/autostart"
    
    # Criar arquivo de autostart
    cat > "$HOME/.config/autostart/depara.desktop" << EOF
[Desktop Entry]
Type=Application
Name=DePara
Comment=Gerenciador de Arquivos
Exec=$DEPARA_DIR/start-depara.sh start
Hidden=false
NoDisplay=false
X-GNOME-Autostart-enabled=true
EOF
    
    success "Inicialização automática configurada"
}

# Configurar atualização automática
setup_auto_update() {
    log "Configurando atualização automática..."
    
    # Tornar scripts executáveis
    chmod +x "$DEPARA_DIR/update-depara.sh"
    chmod +x "$DEPARA_DIR/check-updates.sh"
    
    # Criar link no PATH
    sudo ln -sf "$DEPARA_DIR/update-depara.sh" /usr/local/bin/depara-update
    sudo ln -sf "$DEPARA_DIR/check-updates.sh" /usr/local/bin/depara-check
    
    # Configurar cron para verificar atualizações diariamente
    CRON_JOB="0 2 * * * $DEPARA_DIR/check-updates.sh >> $DEPARA_DIR/logs/cron.log 2>&1"
    
    # Adicionar ao crontab se não existir
    (crontab -l 2>/dev/null | grep -v "check-updates.sh"; echo "$CRON_JOB") | crontab - 2>/dev/null || true
    
    success "Atualização automática configurada"
}

# Criar ícone na barra de status
create_status_indicator() {
    log "Criando indicador de status..."
    
    # Criar script de status
    cat > "$DEPARA_DIR/status-indicator.sh" << EOF
#!/bin/bash

# Indicador de status do DePara
# Este script cria um indicador visual na barra de status

# Função para verificar status
check_status() {
    if pgrep -f "node.*main.js" > /dev/null; then
        echo "🟢 DePara Online"
    else
        echo "🔴 DePara Offline"
    fi
}

# Função para abrir DePara
open_depara() {
    if pgrep -f "node.*main.js" > /dev/null; then
        xdg-open "http://localhost:3000"
    else
        $DEPARA_DIR/start-depara.sh start
        sleep 3
        xdg-open "http://localhost:3000"
    fi
}

# Menu de opções
show_menu() {
    echo "DePara - Gerenciador de Arquivos"
    echo "================================"
    echo "1. Abrir DePara"
    echo "2. Ver Status"
    echo "3. Iniciar DePara"
    echo "4. Parar DePara"
    echo "5. Reiniciar DePara"
    echo "6. Sair"
    echo ""
    read -p "Escolha uma opção: " choice
    
    case \$choice in
        1) open_depara ;;
        2) check_status ;;
        3) $DEPARA_DIR/start-depara.sh start ;;
        4) $DEPARA_DIR/start-depara.sh stop ;;
        5) $DEPARA_DIR/start-depara.sh restart ;;
        6) exit 0 ;;
        *) echo "Opção inválida" ;;
    esac
}

# Executar menu
show_menu
EOF
    
    # Tornar executável
    chmod +x "$DEPARA_DIR/status-indicator.sh"
    
    # Criar link no PATH
    sudo ln -sf "$DEPARA_DIR/status-indicator.sh" /usr/local/bin/depara-status
    
    success "Indicador de status criado"
}

# Testar instalação
test_installation() {
    log "Testando instalação..."
    
    # Verificar se o script está funcionando
    if "$DEPARA_DIR/start-depara.sh" status > /dev/null 2>&1; then
        success "Script de inicialização funcionando"
    else
        warning "Script de inicialização pode ter problemas"
    fi
    
    # Verificar se o serviço está configurado
    if systemctl is-enabled depara.service > /dev/null 2>&1; then
        success "Serviço systemd habilitado"
    else
        warning "Serviço systemd não está habilitado"
    fi
    
    # Verificar se o arquivo .desktop está configurado
    if [ -f "$APPLICATIONS_DIR/depara.desktop" ]; then
        success "Arquivo .desktop configurado"
    else
        warning "Arquivo .desktop não encontrado"
    fi
}

# Função principal
main() {
    echo -e "${BLUE}================================${NC}"
    echo -e "${BLUE}  Instalação do DePara no RPi   ${NC}"
    echo -e "${BLUE}================================${NC}"
    echo ""
    
    # Verificações iniciais
    check_root
    check_nodejs
    check_npm
    
    # Instalação
    install_system_dependencies
    setup_startup_script
    setup_desktop_file
    setup_systemd_service
    setup_autostart
    setup_auto_update
    create_status_indicator
    
    # Teste
    test_installation
    
    echo ""
    echo -e "${GREEN}================================${NC}"
    echo -e "${GREEN}  Instalação concluída!        ${NC}"
    echo -e "${GREEN}================================${NC}"
    echo ""
    echo -e "${BLUE}Comandos disponíveis:${NC}"
    echo "  depara start      - Iniciar DePara"
    echo "  depara stop       - Parar DePara"
    echo "  depara status     - Ver status"
    echo "  depara open       - Abrir no navegador"
    echo "  depara-status     - Menu de status"
    echo "  depara-update     - Atualizar DePara"
    echo "  depara-check      - Verificar atualizações"
    echo ""
    echo -e "${BLUE}Para iniciar o DePara agora:${NC}"
    echo "  depara start"
    echo ""
    echo -e "${BLUE}Para acessar pelo menu:${NC}"
    echo "  Aplicações > Utilitários > DePara"
    echo ""
    echo -e "${BLUE}Para inicialização automática:${NC}"
    echo "  O DePara iniciará automaticamente no próximo boot"
}

# Executar função principal
main "$@"
