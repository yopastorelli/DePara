#!/bin/bash

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

CURRENT_USER="$(id -un)"
USER_HOME="${HOME:-/home/$CURRENT_USER}"
DEPARA_DIR="$USER_HOME/DePara"
APPLICATIONS_DIR="$USER_HOME/.local/share/applications"
SYSTEMD_DIR="/etc/systemd/system"
PM2_STARTUP_CONFIGURED="false"

log() {
    echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCESSO]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[AVISO]${NC} $1"
}

error() {
    echo -e "${RED}[ERRO]${NC} $1"
}

check_root() {
    if [ "${EUID:-$(id -u)}" -eq 0 ]; then
        error "Nao execute este script como root. Execute como usuario '$CURRENT_USER'."
        exit 1
    fi
}

install_system_dependencies() {
    log "Instalando dependencias do sistema para o launcher e o desktop..."
    sudo apt-get update
    sudo apt-get install -y \
        chromium-browser \
        curl \
        desktop-file-utils \
        hicolor-icon-theme \
        xdg-utils
}

install_node_and_pm2() {
    log "Validando Node.js, npm e PM2..."

    if ! command -v node >/dev/null 2>&1; then
        curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
        sudo apt-get install -y nodejs
    fi

    if ! command -v npm >/dev/null 2>&1; then
        error "npm nao encontrado apos a instalacao do Node.js."
        exit 1
    fi

    if ! command -v pm2 >/dev/null 2>&1; then
        sudo npm install -g pm2
    fi

    success "Node.js $(node --version), npm $(npm --version) e PM2 disponiveis."
}

prepare_launcher() {
    log "Preparando launcher canonico do menu..."
    chmod +x "$DEPARA_DIR/start-depara.sh"
    sudo ln -sf "$DEPARA_DIR/start-depara.sh" /usr/local/bin/depara
    success "Launcher pronto em /usr/local/bin/depara."
}

install_dependencies() {
    log "Instalando dependencias Node.js de producao..."
    cd "$DEPARA_DIR"
    npm ci --omit=dev
    success "Dependencias de producao instaladas."
}

configure_pm2_runtime() {
    log "Registrando o runtime canonico no PM2..."
    cd "$DEPARA_DIR"

    if pm2 describe DePara >/dev/null 2>&1; then
        pm2 restart DePara --update-env
    else
        pm2 start ecosystem.config.js --env production
    fi

    pm2 save

    if sudo env "PATH=$PATH" pm2 startup systemd -u "$CURRENT_USER" --hp "$USER_HOME"; then
        PM2_STARTUP_CONFIGURED="true"
        success "PM2 configurado para restaurar o runtime no boot."
    else
        warning "Falha ao executar 'pm2 startup'. Mantendo bootstrap legacy por systemd como contingencia."
    fi
}

setup_bootstrap_service() {
    if [ "$PM2_STARTUP_CONFIGURED" = "true" ]; then
        log "PM2 startup ja configurado; bootstrap legacy por systemd nao sera habilitado."
        return
    fi

    log "Publicando bootstrap legacy do PM2 em systemd..."
    sudo cp "$DEPARA_DIR/depara.service" "$SYSTEMD_DIR/"
    sudo sed -i "s|User=yo|User=$CURRENT_USER|g" "$SYSTEMD_DIR/depara.service"
    sudo sed -i "s|Group=yo|Group=$CURRENT_USER|g" "$SYSTEMD_DIR/depara.service"
    sudo sed -i "s|/home/yo/DePara|$DEPARA_DIR|g" "$SYSTEMD_DIR/depara.service"
    sudo sed -i "s|/home/yo/.depara|$USER_HOME/.depara|g" "$SYSTEMD_DIR/depara.service"
    sudo systemctl daemon-reload
    sudo systemctl enable depara.service
    success "Bootstrap systemd do PM2 atualizado."
}

setup_desktop_file() {
    log "Publicando atalho canonico do menu..."
    mkdir -p "$APPLICATIONS_DIR"
    cp "$DEPARA_DIR/depara.desktop" "$APPLICATIONS_DIR/depara.desktop"
    sed -i "s|__DEPARA_DIR__|$DEPARA_DIR|g" "$APPLICATIONS_DIR/depara.desktop"
    update-desktop-database "$APPLICATIONS_DIR" 2>/dev/null || true
    gtk-update-icon-cache -f -t "$USER_HOME/.local/share/icons" 2>/dev/null || true
    success "Atalho do menu atualizado."
}

validate_installation() {
    log "Validando runtime e atalho..."
    pm2 status DePara
    curl -fsS http://127.0.0.1:3000/health >/dev/null
    "$DEPARA_DIR/start-depara.sh" status >/dev/null
    success "Validacao minima concluida."
}

main() {
    check_root
    install_system_dependencies
    install_node_and_pm2
    prepare_launcher
    install_dependencies
    configure_pm2_runtime
    setup_bootstrap_service
    setup_desktop_file
    validate_installation

    echo ""
    success "Instalacao RP4 concluida."
    echo "Fluxo canonico:"
    echo "  1. Backend sobe via PM2"
    echo "  2. Reboot restaura o processo salvo"
    echo "  3. O menu chama apenas 'start-depara.sh open'"
    echo ""
    echo "Verificacoes uteis:"
    echo "  pm2 status"
    echo "  curl -s http://127.0.0.1:3000/health"
    echo "  /home/$CURRENT_USER/DePara/start-depara.sh status"
}

main "$@"
