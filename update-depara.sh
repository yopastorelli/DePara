#!/bin/bash

# Script de atualização automática do DePara via GitHub
# Este script verifica e baixa atualizações do repositório GitHub

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
GITHUB_REPO="https://github.com/yopastorelli/DePara.git"
BACKUP_DIR="$DEPARA_DIR/backups"
LOG_FILE="$DEPARA_DIR/logs/update.log"

# Função para log
log() {
    echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

# Função para erro
error() {
    echo -e "${RED}[ERRO]${NC} $1" | tee -a "$LOG_FILE"
}

# Função para sucesso
success() {
    echo -e "${GREEN}[SUCESSO]${NC} $1" | tee -a "$LOG_FILE"
}

# Função para aviso
warning() {
    echo -e "${YELLOW}[AVISO]${NC} $1" | tee -a "$LOG_FILE"
}

# Verificar se o DePara está rodando
check_depara_running() {
    if pgrep -f "node.*main.js" > /dev/null; then
        return 0
    else
        return 1
    fi
}

# Parar o DePara
stop_depara() {
    log "Parando DePara para atualização..."
    
    # Parar serviço systemd
    sudo systemctl stop depara.service 2>/dev/null || true
    
    # Parar processos manuais
    pkill -f "node.*main.js" 2>/dev/null || true
    
    # Aguardar um pouco
    sleep 3
    
    success "DePara parado"
}

# Iniciar o DePara
start_depara() {
    log "Iniciando DePara após atualização..."
    
    # Iniciar serviço systemd
    sudo systemctl start depara.service 2>/dev/null || true
    
    # Aguardar um pouco
    sleep 3
    
    if check_depara_running; then
        success "DePara iniciado com sucesso"
    else
        warning "DePara pode não ter iniciado corretamente"
    fi
}

# Criar backup
create_backup() {
    log "Criando backup da versão atual..."
    
    # Criar diretório de backup se não existir
    mkdir -p "$BACKUP_DIR"
    
    # Nome do backup com timestamp
    BACKUP_NAME="depara-backup-$(date +%Y%m%d-%H%M%S)"
    BACKUP_PATH="$BACKUP_DIR/$BACKUP_NAME"
    
    # Criar backup
    cp -r "$DEPARA_DIR" "$BACKUP_PATH"
    
    # Remover logs e node_modules do backup para economizar espaço
    rm -rf "$BACKUP_PATH/logs" 2>/dev/null || true
    rm -rf "$BACKUP_PATH/node_modules" 2>/dev/null || true
    rm -rf "$BACKUP_PATH/backups" 2>/dev/null || true
    
    success "Backup criado: $BACKUP_NAME"
    echo "$BACKUP_PATH"
}

# Verificar atualizações disponíveis
check_updates() {
    log "Verificando atualizações disponíveis..."
    
    # Navegar para o diretório do projeto
    cd "$DEPARA_DIR" || {
        error "Não foi possível acessar o diretório $DEPARA_DIR"
        exit 1
    }
    
    # Verificar se é um repositório git
    if [ ! -d ".git" ]; then
        error "Diretório não é um repositório git"
        exit 1
    fi
    
    # Buscar atualizações
    git fetch origin 2>/dev/null || {
        error "Falha ao buscar atualizações do GitHub"
        exit 1
    }
    
    # Verificar se há atualizações
    LOCAL_COMMIT=$(git rev-parse HEAD)
    REMOTE_COMMIT=$(git rev-parse origin/main)
    
    if [ "$LOCAL_COMMIT" = "$REMOTE_COMMIT" ]; then
        success "DePara está atualizado"
        return 1
    else
        success "Atualizações disponíveis encontradas"
        return 0
    fi
}

# Atualizar o DePara
update_depara() {
    log "Atualizando DePara..."
    
    # Navegar para o diretório do projeto
    cd "$DEPARA_DIR" || {
        error "Não foi possível acessar o diretório $DEPARA_DIR"
        exit 1
    }
    
    # Fazer pull das atualizações
    git pull origin main 2>/dev/null || {
        error "Falha ao baixar atualizações"
        exit 1
    }
    
    # Instalar dependências se necessário
    if [ -f "package.json" ]; then
        log "Instalando dependências..."
        npm install --production 2>/dev/null || {
            warning "Falha ao instalar dependências, continuando..."
        }
    fi
    
    success "DePara atualizado com sucesso"
}

# Verificar integridade após atualização
verify_update() {
    log "Verificando integridade após atualização..."
    
    # Verificar se os arquivos principais existem
    if [ ! -f "$DEPARA_DIR/src/main.js" ]; then
        error "Arquivo principal não encontrado após atualização"
        return 1
    fi
    
    if [ ! -f "$DEPARA_DIR/package.json" ]; then
        error "Arquivo package.json não encontrado após atualização"
        return 1
    fi
    
    success "Integridade verificada"
    return 0
}

# Limpar backups antigos
cleanup_old_backups() {
    log "Limpando backups antigos..."
    
    # Manter apenas os últimos 5 backups
    cd "$BACKUP_DIR" 2>/dev/null || return 0
    
    # Contar backups
    BACKUP_COUNT=$(ls -1 | wc -l)
    
    if [ "$BACKUP_COUNT" -gt 5 ]; then
        # Remover backups mais antigos
        ls -1t | tail -n +6 | xargs rm -rf 2>/dev/null || true
        success "Backups antigos removidos"
    else
        log "Nenhum backup antigo para remover"
    fi
}

# Atualização automática
auto_update() {
    echo -e "${BLUE}================================${NC}"
    echo -e "${BLUE}  Atualização Automática DePara  ${NC}"
    echo -e "${BLUE}================================${NC}"
    echo ""
    
    # Verificar se há atualizações
    if ! check_updates; then
        echo -e "${GREEN}DePara já está atualizado!${NC}"
        exit 0
    fi
    
    # Criar backup
    BACKUP_PATH=$(create_backup)
    
    # Parar DePara
    if check_depara_running; then
        stop_depara
        DEPARA_WAS_RUNNING=true
    else
        DEPARA_WAS_RUNNING=false
    fi
    
    # Atualizar
    if update_depara; then
        # Verificar integridade
        if verify_update; then
            success "Atualização concluída com sucesso!"
            
            # Reiniciar DePara se estava rodando
            if [ "$DEPARA_WAS_RUNNING" = true ]; then
                start_depara
            fi
            
            # Limpar backups antigos
            cleanup_old_backups
            
            echo ""
            echo -e "${GREEN}================================${NC}"
            echo -e "${GREEN}  Atualização concluída!        ${NC}"
            echo -e "${GREEN}================================${NC}"
            echo ""
            echo -e "${BLUE}Backup criado em:${NC} $BACKUP_PATH"
            echo -e "${BLUE}Para verificar status:${NC} depara status"
            echo -e "${BLUE}Para abrir DePara:${NC} depara open"
        else
            error "Falha na verificação de integridade"
            echo -e "${YELLOW}Restaurando backup...${NC}"
            restore_backup "$BACKUP_PATH"
            exit 1
        fi
    else
        error "Falha na atualização"
        echo -e "${YELLOW}Restaurando backup...${NC}"
        restore_backup "$BACKUP_PATH"
        exit 1
    fi
}

# Restaurar backup
restore_backup() {
    local backup_path="$1"
    
    if [ -d "$backup_path" ]; then
        log "Restaurando backup..."
        rm -rf "$DEPARA_DIR"
        mv "$backup_path" "$DEPARA_DIR"
        success "Backup restaurado"
    else
        error "Backup não encontrado"
    fi
}

# Verificar atualizações sem instalar
check_only() {
    echo -e "${BLUE}Verificando atualizações...${NC}"
    
    if check_updates; then
        echo -e "${GREEN}Atualizações disponíveis!${NC}"
        echo -e "${BLUE}Execute: $0 update${NC}"
    else
        echo -e "${GREEN}DePara está atualizado!${NC}"
    fi
}

# Mostrar ajuda
show_help() {
    echo -e "${BLUE}DePara - Atualização Automática${NC}"
    echo ""
    echo "Uso: $0 [comando]"
    echo ""
    echo "Comandos:"
    echo "  update     - Atualizar DePara automaticamente"
    echo "  check      - Verificar se há atualizações disponíveis"
    echo "  backup     - Criar backup da versão atual"
    echo "  restore    - Restaurar backup (especificar caminho)"
    echo "  help       - Mostrar esta ajuda"
    echo ""
    echo "Exemplos:"
    echo "  $0 update"
    echo "  $0 check"
    echo "  $0 backup"
}

# Criar diretório de logs se não existir
mkdir -p "$(dirname "$LOG_FILE")"

# Processar argumentos
case "$1" in
    update)
        auto_update
        ;;
    check)
        check_only
        ;;
    backup)
        create_backup
        ;;
    restore)
        if [ -z "$2" ]; then
            error "Especifique o caminho do backup"
            exit 1
        fi
        restore_backup "$2"
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
