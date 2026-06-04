#!/bin/bash

set -euo pipefail

CURRENT_USER="$(id -un)"
USER_HOME="${HOME:-/home/$CURRENT_USER}"
DEPARA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUNTIME_ROOT="${DEPARA_RUNTIME_ROOT:-$USER_HOME/.depara}"
LOG_DIR="$RUNTIME_ROOT/logs"
LOG_FILE="$LOG_DIR/depara-launcher.log"
CONFIG_ENV_PATH="${DEPARA_CONFIG_ENV_PATH:-$RUNTIME_ROOT/config.env}"
PORT_VALUE="${PORT:-}"
APP_URL=""
HEALTH_URL=""
PM2_APP_NAME="${PM2_APP_NAME:-DePara}"
BROWSER_PROFILE_DIR="$RUNTIME_ROOT/browser-profile"

mkdir -p "$LOG_DIR" "$BROWSER_PROFILE_DIR"

log() {
    printf '%s %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$1" | tee -a "$LOG_FILE"
}

load_runtime_config() {
    if [ -f "$CONFIG_ENV_PATH" ]; then
        local configured_port
        configured_port="$(grep -E '^PORT=' "$CONFIG_ENV_PATH" | tail -n 1 | cut -d '=' -f 2- || true)"
        if [ -n "$configured_port" ] && [ -z "${PORT_VALUE:-}" ]; then
            PORT_VALUE="$configured_port"
        fi
    fi

    if [ -z "${PORT_VALUE:-}" ]; then
        PORT_VALUE="3000"
    fi

    APP_URL="${DEPARA_APP_URL:-http://127.0.0.1:$PORT_VALUE}"
    HEALTH_URL="${APP_URL}/health"
}

load_runtime_config

health_check() {
    if command -v curl >/dev/null 2>&1; then
        curl -fsS --max-time 3 "$HEALTH_URL" >/dev/null
        return $?
    fi

    if command -v wget >/dev/null 2>&1; then
        wget -qO- --timeout=3 "$HEALTH_URL" >/dev/null
        return $?
    fi

    log "Erro: nem curl nem wget estao disponiveis para validar o health check."
    return 1
}

open_browser() {
    if command -v chromium >/dev/null 2>&1; then
        chromium --new-window --app="$APP_URL" --user-data-dir="$BROWSER_PROFILE_DIR/chromium" --no-first-run --no-default-browser-check >/dev/null 2>&1 &
        return 0
    fi

    if command -v chromium-browser >/dev/null 2>&1; then
        chromium-browser --new-window --app="$APP_URL" --user-data-dir="$BROWSER_PROFILE_DIR/chromium-browser" --no-first-run --no-default-browser-check >/dev/null 2>&1 &
        return 0
    fi

    if command -v google-chrome >/dev/null 2>&1; then
        google-chrome --new-window --app="$APP_URL" --user-data-dir="$BROWSER_PROFILE_DIR/google-chrome" --no-first-run --no-default-browser-check >/dev/null 2>&1 &
        return 0
    fi

    if command -v firefox >/dev/null 2>&1; then
        firefox --new-window "$APP_URL" >/dev/null 2>&1 &
        return 0
    fi

    if command -v xdg-open >/dev/null 2>&1; then
        xdg-open "$APP_URL" >/dev/null 2>&1 &
        return 0
    fi

    log "Erro: nenhum navegador compativel encontrado para abrir $APP_URL."
    return 1
}

show_status() {
    echo "DePara RP4 status"
    echo "App URL: $APP_URL"
    echo "PM2 app: $PM2_APP_NAME"
    echo ""

    if command -v pm2 >/dev/null 2>&1; then
        pm2 status "$PM2_APP_NAME" || true
    else
        echo "pm2 nao encontrado no PATH."
    fi

    echo ""
    if health_check; then
        echo "Health: OK ($HEALTH_URL)"
    else
        echo "Health: FALHOU ($HEALTH_URL)"
        echo "Se o backend nao estiver no ar, inicie com:"
        echo "  pm2 start ecosystem.config.js --env production"
        echo "  pm2 save"
    fi
}

open_ui() {
    if ! health_check; then
        log "Backend nao esta saudavel em $HEALTH_URL."
        log "Inicie ou recupere o runtime canonicamente com:"
        log "  pm2 start ecosystem.config.js --env production"
        log "  pm2 save"
        exit 1
    fi

    log "Abrindo DePara em $APP_URL"
    open_browser
}

show_help() {
    cat <<EOF
DePara RP4 launcher

Uso:
  $0 open
  $0 status
  $0 help

Comportamento:
  - Este script nao inicia nem reinicia o backend.
  - O backend canonico roda apenas via PM2.
  - O launcher apenas valida /health e abre a UI.
EOF
}

COMMAND="${1:-open}"

case "$COMMAND" in
    open)
        open_ui
        ;;
    status)
        show_status
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        echo "Comando nao suportado: $COMMAND"
        show_help
        exit 1
        ;;
esac
