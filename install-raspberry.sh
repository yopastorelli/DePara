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
RUNTIME_ROOT="${DEPARA_RUNTIME_ROOT:-$USER_HOME/.depara}"
CONFIG_ENV_PATH="${DEPARA_CONFIG_ENV_PATH:-$RUNTIME_ROOT/config.env}"
APPLICATIONS_DIR="$USER_HOME/.local/share/applications"
NODE_VERSION="${DEPARA_NODE_VERSION:-22.23.1}"

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

    if [ ! -f "$DEPARA_DIR/package.json" ]; then
        error "Repositorio DePara nao encontrado em $DEPARA_DIR."
        exit 1
    fi
}

install_system_dependencies() {
    log "Instalando dependencias essenciais do sistema..."
    sudo apt-get update
    sudo apt-get install -y \
        ca-certificates \
        curl \
        desktop-file-utils \
        hicolor-icon-theme \
        tar \
        xdg-utils \
        xz-utils

    if command -v chromium >/dev/null 2>&1 || \
       command -v chromium-browser >/dev/null 2>&1 || \
       command -v firefox >/dev/null 2>&1; then
        return
    fi

    if sudo apt-get install -y chromium; then
        success "Chromium instalado."
    elif sudo apt-get install -y chromium-browser; then
        success "Chromium Browser instalado."
    else
        warning "Nenhum navegador foi instalado automaticamente; xdg-open sera usado quando houver navegador padrao."
    fi
}

resolve_node_distribution() {
    case "$(uname -m)" in
        aarch64|arm64)
            echo "linux-arm64"
            ;;
        armv7l|armv7*)
            echo "linux-armv7l"
            ;;
        x86_64|amd64)
            echo "linux-x64"
            ;;
        *)
            error "Arquitetura nao suportada para o runtime Node: $(uname -m)"
            exit 1
            ;;
    esac
}

install_pinned_node() {
    local distribution archive base_url temp_dir expected_hash install_dir
    distribution="$(resolve_node_distribution)"
    archive="node-v${NODE_VERSION}-${distribution}.tar.xz"
    base_url="https://nodejs.org/dist/v${NODE_VERSION}"
    temp_dir="$(mktemp -d)"
    install_dir="/opt/depara-node/node-v${NODE_VERSION}-${distribution}"

    log "Instalando Node.js v${NODE_VERSION} para ${distribution}..."

    curl -fsSL "${base_url}/${archive}" -o "${temp_dir}/${archive}"
    curl -fsSL "${base_url}/SHASUMS256.txt" -o "${temp_dir}/SHASUMS256.txt"

    expected_hash="$(awk -v target="$archive" '$2 == target { print $1 }' "${temp_dir}/SHASUMS256.txt")"
    if [ -z "$expected_hash" ]; then
        rm -rf "$temp_dir"
        error "Checksum oficial nao encontrado para $archive."
        exit 1
    fi

    (
        cd "$temp_dir"
        printf '%s  %s\n' "$expected_hash" "$archive" | sha256sum -c -
    )

    sudo mkdir -p /opt/depara-node
    sudo rm -rf "$install_dir"
    sudo tar -xJf "${temp_dir}/${archive}" -C /opt/depara-node

    for binary in node npm npx corepack; do
        if [ -x "${install_dir}/bin/${binary}" ]; then
            sudo ln -sfn "${install_dir}/bin/${binary}" "/usr/local/bin/${binary}"
        fi
    done

    rm -rf "$temp_dir"
}

install_node_and_pm2() {
    local node_major=""

    if command -v node >/dev/null 2>&1; then
        node_major="$(node -p "Number(process.versions.node.split('.')[0])" 2>/dev/null || true)"
    fi

    if [ "$node_major" != "22" ] && [ "$node_major" != "24" ]; then
        install_pinned_node
    fi

    hash -r

    if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
        error "Node.js ou npm indisponivel apos a instalacao."
        exit 1
    fi

    node_major="$(node -p "Number(process.versions.node.split('.')[0])")"
    if [ "$node_major" != "22" ] && [ "$node_major" != "24" ]; then
        error "Node.js $(node --version) nao certificado. Use Node 22 ou 24 LTS."
        exit 1
    fi

    if ! command -v pm2 >/dev/null 2>&1; then
        sudo env "PATH=/usr/local/bin:$PATH" npm install -g pm2
    fi

    success "Node.js $(node --version), npm $(npm --version) e PM2 $(pm2 --version) disponiveis."
}

prepare_runtime_config() {
    mkdir -p "$RUNTIME_ROOT"

    if [ ! -f "$CONFIG_ENV_PATH" ]; then
        cat > "$CONFIG_ENV_PATH" <<EOF
HOST=127.0.0.1
PORT=3001
NODE_ENV=production
LOG_LEVEL=warn
LOG_TO_CONSOLE=false
DEPARA_RUNTIME_ROOT=$RUNTIME_ROOT
DEPARA_CONFIG_ENV_PATH=$CONFIG_ENV_PATH
PM2_APP_NAME=DePara
DEPARA_ALLOW_SYSTEMD_FALLBACK=false
DEPARA_ALLOWED_PATHS=$USER_HOME:/media:/mnt
EOF
        chmod 600 "$CONFIG_ENV_PATH"
        success "Config runtime criada em $CONFIG_ENV_PATH."
    else
        success "Config runtime existente preservada em $CONFIG_ENV_PATH."
    fi
}

prepare_launcher() {
    log "Preparando launcher canonico do menu..."
    chmod +x "$DEPARA_DIR/start-depara.sh"
    sudo ln -sfn "$DEPARA_DIR/start-depara.sh" /usr/local/bin/depara
    success "Launcher pronto em /usr/local/bin/depara."
}

install_dependencies() {
    log "Preparando release imutavel e dependencias de producao..."
    cd "$DEPARA_DIR"
    npm ci --omit=dev
    node bootstrap-runtime-release.js
    success "Release imutavel preparada."
}

read_runtime_port() {
    if [ -f "$CONFIG_ENV_PATH" ]; then
        local configured_port
        configured_port="$(grep -E '^PORT=' "$CONFIG_ENV_PATH" | tail -n 1 | cut -d '=' -f 2- || true)"
        if [[ "$configured_port" =~ ^[0-9]+$ ]] && [ "$configured_port" -ge 1 ] && [ "$configured_port" -le 65535 ]; then
            echo "$configured_port"
            return
        fi
    fi

    echo "3001"
}

configure_pm2_runtime() {
    log "Registrando o runtime canonico no PM2..."
    cd "$DEPARA_DIR"

    if pm2 describe DePara >/dev/null 2>&1; then
        pm2 delete DePara
    fi

    pm2 start ecosystem.config.js --env production
    pm2 save
    sudo env "PATH=/usr/local/bin:$PATH" pm2 startup systemd -u "$CURRENT_USER" --hp "$USER_HOME"
    success "PM2 configurado para restaurar o runtime no boot."
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
    log "Validando runtime, persistencia e atalho..."
    local runtime_port active_entry
    runtime_port="$(read_runtime_port)"

    pm2 status DePara
    curl -fsS --max-time 5 "http://127.0.0.1:${runtime_port}/health" >/dev/null
    curl -fsS --max-time 5 "http://127.0.0.1:${runtime_port}/api/status" >/dev/null
    "$DEPARA_DIR/start-depara.sh" status >/dev/null

    active_entry="$RUNTIME_ROOT/current/src/main.js"
    if [ ! -f "$active_entry" ]; then
        error "Wrapper da release ativa ausente: $active_entry"
        exit 1
    fi

    success "Validacao RP4 concluida na porta ${runtime_port}."
}

main() {
    check_root
    install_system_dependencies
    install_node_and_pm2
    prepare_runtime_config
    prepare_launcher
    install_dependencies
    configure_pm2_runtime
    setup_desktop_file
    validate_installation

    local runtime_port
    runtime_port="$(read_runtime_port)"

    echo ""
    success "Instalacao RP4 concluida."
    echo "Fluxo canonico:"
    echo "  1. Backend sobe via PM2"
    echo "  2. Reboot restaura o processo salvo"
    echo "  3. O menu chama apenas 'start-depara.sh open'"
    echo ""
    echo "Verificacoes uteis:"
    echo "  pm2 status DePara"
    echo "  curl -fsS http://127.0.0.1:${runtime_port}/health"
    echo "  $DEPARA_DIR/start-depara.sh status"
}

main "$@"
