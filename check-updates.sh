#!/bin/bash

# Script de verificação de atualizações do DePara
# Este script pode ser executado via cron para verificar atualizações automaticamente

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configurações
CURRENT_USER=$(whoami)
USER_HOME="/home/$CURRENT_USER"
DEPARA_DIR="$USER_HOME/DePara"
LOG_FILE="$DEPARA_DIR/logs/update-check.log"
NOTIFICATION_FILE="$DEPARA_DIR/logs/update-notification.txt"

# Função para log
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

# Função para notificação
notify() {
    local message="$1"
    echo "$message" > "$NOTIFICATION_FILE"
    
    # Tentar notificar via sistema (se disponível)
    if command -v notify-send &> /dev/null; then
        notify-send "DePara" "$message" 2>/dev/null || true
    fi
    
    # Tentar notificar via wall (se disponível)
    if command -v wall &> /dev/null; then
        echo "DePara: $message" | wall 2>/dev/null || true
    fi
}

# Verificar atualizações
check_updates() {
    log "Verificando atualizações..."
    
    # Navegar para o diretório do projeto
    cd "$DEPARA_DIR" 2>/dev/null || {
        log "ERRO: Não foi possível acessar o diretório $DEPARA_DIR"
        return 1
    }
    
    # Verificar se é um repositório git
    if [ ! -d ".git" ]; then
        log "ERRO: Diretório não é um repositório git"
        return 1
    fi
    
    # Buscar atualizações
    git fetch origin 2>/dev/null || {
        log "ERRO: Falha ao buscar atualizações do GitHub"
        return 1
    }
    
    # Verificar se há atualizações
    LOCAL_COMMIT=$(git rev-parse HEAD 2>/dev/null)
    REMOTE_COMMIT=$(git rev-parse origin/main 2>/dev/null)
    
    if [ "$LOCAL_COMMIT" = "$REMOTE_COMMIT" ]; then
        log "DePara está atualizado"
        return 1
    else
        log "Atualizações disponíveis encontradas"
        
        # Obter informações da atualização
        LOCAL_DATE=$(git log -1 --format=%ci 2>/dev/null)
        REMOTE_DATE=$(git log -1 --format=%ci origin/main 2>/dev/null)
        COMMIT_MESSAGE=$(git log -1 --format=%s origin/main 2>/dev/null)
        
        # Criar notificação
        notify "Atualizações disponíveis para o DePara! Última atualização: $COMMIT_MESSAGE"
        
        return 0
    fi
}

# Verificar se o DePara está rodando
check_depara_status() {
    if pgrep -f "node.*main.js" > /dev/null; then
        log "DePara está rodando"
        return 0
    else
        log "DePara não está rodando"
        return 1
    fi
}

# Verificar saúde do sistema
check_system_health() {
    log "Verificando saúde do sistema..."
    
    # Verificar espaço em disco
    DISK_USAGE=$(df -h "$DEPARA_DIR" | awk 'NR==2 {print $5}' | sed 's/%//')
    if [ "$DISK_USAGE" -gt 90 ]; then
        log "AVISO: Espaço em disco baixo ($DISK_USAGE%)"
        notify "AVISO: Espaço em disco baixo ($DISK_USAGE%)"
    fi
    
    # Verificar memória
    MEMORY_USAGE=$(free | awk 'NR==2{printf "%.0f", $3*100/$2}')
    if [ "$MEMORY_USAGE" -gt 90 ]; then
        log "AVISO: Uso de memória alto ($MEMORY_USAGE%)"
        notify "AVISO: Uso de memória alto ($MEMORY_USAGE%)"
    fi
    
    # Verificar logs de erro
    if [ -f "$DEPARA_DIR/logs/error.log" ]; then
        ERROR_COUNT=$(wc -l < "$DEPARA_DIR/logs/error.log" 2>/dev/null || echo "0")
        if [ "$ERROR_COUNT" -gt 100 ]; then
            log "AVISO: Muitos erros nos logs ($ERROR_COUNT linhas)"
            notify "AVISO: Muitos erros nos logs ($ERROR_COUNT linhas)"
        fi
    fi
}

# Limpar logs antigos
cleanup_logs() {
    log "Limpando logs antigos..."
    
    # Limpar logs de verificação de atualizações (manter últimos 30 dias)
    find "$DEPARA_DIR/logs" -name "update-check.log*" -mtime +30 -delete 2>/dev/null || true
    
    # Limpar logs de atualização (manter últimos 30 dias)
    find "$DEPARA_DIR/logs" -name "update.log*" -mtime +30 -delete 2>/dev/null || true
    
    # Limpar logs de erro antigos (manter últimos 7 dias)
    find "$DEPARA_DIR/logs" -name "error.log*" -mtime +7 -delete 2>/dev/null || true
    
    log "Limpeza de logs concluída"
}

# Função principal
main() {
    # Criar diretório de logs se não existir
    mkdir -p "$(dirname "$LOG_FILE")"
    
    # Verificar atualizações
    if check_updates; then
        log "Atualizações disponíveis - notificação enviada"
    fi
    
    # Verificar status do DePara
    check_depara_status
    
    # Verificar saúde do sistema
    check_system_health
    
    # Limpar logs antigos
    cleanup_logs
    
    log "Verificação concluída"
}

# Executar função principal
main "$@"
