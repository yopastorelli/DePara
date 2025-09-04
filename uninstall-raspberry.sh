#!/bin/bash

# Script de desinstalação do DePara no Raspberry Pi

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
APPLICATIONS_DIR="$USER_HOME/.local/share/applications"
DESKTOP_DIR="$USER_HOME/Desktop"
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

# Parar o DePara
stop_depara() {
    log "Parando DePara..."
    
    # Parar serviço systemd
    sudo systemctl stop depara.service 2>/dev/null || true
    
    # Parar processos manuais
    pkill -f "node.*main.js" 2>/dev/null || true
    
    success "DePara parado"
}

# Remover serviço systemd
remove_systemd_service() {
    log "Removendo serviço systemd..."
    
    # Desabilitar serviço
    sudo systemctl disable depara.service 2>/dev/null || true
    
    # Remover arquivo de serviço
    sudo rm -f "$SYSTEMD_DIR/depara.service"
    
    # Recarregar systemd
    sudo systemctl daemon-reload
    
    success "Serviço systemd removido"
}

# Remover arquivos .desktop
remove_desktop_files() {
    log "Removendo arquivos .desktop..."
    
    # Remover do diretório de aplicações
    rm -f "$APPLICATIONS_DIR/depara.desktop"
    
    # Remover do desktop
    rm -f "$DESKTOP_DIR/depara.desktop"
    
    # Remover autostart
    rm -f "$HOME/.config/autostart/depara.desktop"
    
    # Atualizar banco de dados
    update-desktop-database "$APPLICATIONS_DIR" 2>/dev/null || true
    
    success "Arquivos .desktop removidos"
}

# Remover links simbólicos
remove_symlinks() {
    log "Removendo links simbólicos..."
    
    # Remover links do PATH
    sudo rm -f /usr/local/bin/depara
    sudo rm -f /usr/local/bin/depara-status
    sudo rm -f /usr/local/bin/depara-update
    sudo rm -f /usr/local/bin/depara-check
    
    success "Links simbólicos removidos"
}

# Remover configurações de atualização automática
remove_auto_update() {
    log "Removendo configurações de atualização automática..."
    
    # Remover jobs do cron
    crontab -l 2>/dev/null | grep -v "check-updates.sh" | crontab - 2>/dev/null || true
    
    success "Configurações de atualização automática removidas"
}

# Remover diretório do projeto (opcional)
remove_project_directory() {
    read -p "Deseja remover o diretório do projeto ($DEPARA_DIR)? [y/N]: " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log "Removendo diretório do projeto..."
        rm -rf "$DEPARA_DIR"
        success "Diretório do projeto removido"
    else
        warning "Diretório do projeto mantido"
    fi
}

# Função principal
main() {
    echo -e "${BLUE}================================${NC}"
    echo -e "${BLUE}  Desinstalação do DePara       ${NC}"
    echo -e "${BLUE}================================${NC}"
    echo ""
    
    # Confirmar desinstalação
    read -p "Tem certeza que deseja desinstalar o DePara? [y/N]: " -n 1 -r
    echo
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Desinstalação cancelada"
        exit 0
    fi
    
    # Executar desinstalação
    stop_depara
    remove_systemd_service
    remove_desktop_files
    remove_symlinks
    remove_auto_update
    remove_project_directory
    
    echo ""
    echo -e "${GREEN}================================${NC}"
    echo -e "${GREEN}  Desinstalação concluída!     ${NC}"
    echo -e "${GREEN}================================${NC}"
    echo ""
    echo -e "${BLUE}O DePara foi removido do sistema${NC}"
    echo -e "${BLUE}Para reinstalar, execute:${NC}"
    echo "  ./install-raspberry.sh"
}

# Executar função principal
main "$@"
