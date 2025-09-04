#!/bin/bash

# Script de correção rápida para o DePara no Raspberry Pi
# Este script corrige os problemas de instalação

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Detectar usuário atual
CURRENT_USER=$(whoami)
USER_HOME="/home/$CURRENT_USER"
DEPARA_DIR="$USER_HOME/DePara"

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

echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}  Correção da Instalação DePara  ${NC}"
echo -e "${BLUE}================================${NC}"
echo ""

# Verificar se estamos no diretório correto
if [ ! -d "$DEPARA_DIR" ]; then
    error "Diretório $DEPARA_DIR não encontrado"
    exit 1
fi

cd "$DEPARA_DIR" || {
    error "Não foi possível acessar o diretório $DEPARA_DIR"
    exit 1
}

# Atualizar o repositório
log "Atualizando repositório..."
git pull origin main || {
    error "Falha ao atualizar repositório"
    exit 1
}
success "Repositório atualizado"

# Tornar scripts executáveis
log "Tornando scripts executáveis..."
chmod +x start-depara.sh
chmod +x install-raspberry.sh
chmod +x update-depara.sh
chmod +x check-updates.sh
success "Scripts tornados executáveis"

# Configurar script de inicialização
log "Configurando script de inicialização..."
sudo ln -sf "$DEPARA_DIR/start-depara.sh" /usr/local/bin/depara
success "Script de inicialização configurado"

# Configurar arquivo .desktop
log "Configurando arquivo .desktop..."
mkdir -p "$USER_HOME/.local/share/applications"
cp "$DEPARA_DIR/depara.desktop" "$USER_HOME/.local/share/applications/"

# Ajustar caminhos no arquivo .desktop
sed -i "s|/home/pi/DePara|$DEPARA_DIR|g" "$USER_HOME/.local/share/applications/depara.desktop"

# Atualizar banco de dados de aplicações
update-desktop-database "$USER_HOME/.local/share/applications" 2>/dev/null || true

# Criar link no desktop se existir
if [ -d "$USER_HOME/Desktop" ]; then
    ln -sf "$USER_HOME/.local/share/applications/depara.desktop" "$USER_HOME/Desktop/"
fi

success "Arquivo .desktop configurado"

# Configurar serviço systemd
log "Configurando serviço systemd..."
sudo cp "$DEPARA_DIR/depara.service" /etc/systemd/system/

# Ajustar usuário no arquivo de serviço
sudo sed -i "s/User=pi/User=$CURRENT_USER/g" /etc/systemd/system/depara.service
sudo sed -i "s/Group=pi/Group=$CURRENT_USER/g" /etc/systemd/system/depara.service
sudo sed -i "s|WorkingDirectory=/home/pi/DePara|WorkingDirectory=$DEPARA_DIR|g" /etc/systemd/system/depara.service
sudo sed -i "s|ReadWritePaths=/home/pi/DePara|ReadWritePaths=$DEPARA_DIR|g" /etc/systemd/system/depara.service

# Recarregar systemd
sudo systemctl daemon-reload

# Habilitar serviço
sudo systemctl enable depara.service

success "Serviço systemd configurado"

# Configurar inicialização automática
log "Configurando inicialização automática..."
mkdir -p "$HOME/.config/autostart"

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

# Configurar atualização automática
log "Configurando atualização automática..."
sudo ln -sf "$DEPARA_DIR/update-depara.sh" /usr/local/bin/depara-update
sudo ln -sf "$DEPARA_DIR/check-updates.sh" /usr/local/bin/depara-check

# Configurar cron para verificar atualizações diariamente
CRON_JOB="0 2 * * * $DEPARA_DIR/check-updates.sh >> $DEPARA_DIR/logs/cron.log 2>&1"

# Adicionar ao crontab se não existir
(crontab -l 2>/dev/null | grep -v "check-updates.sh"; echo "$CRON_JOB") | crontab - 2>/dev/null || true

success "Atualização automática configurada"

# Criar indicador de status
log "Criando indicador de status..."
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

chmod +x "$DEPARA_DIR/status-indicator.sh"
sudo ln -sf "$DEPARA_DIR/status-indicator.sh" /usr/local/bin/depara-status

success "Indicador de status criado"

# Testar instalação
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
if [ -f "$USER_HOME/.local/share/applications/depara.desktop" ]; then
    success "Arquivo .desktop configurado"
else
    warning "Arquivo .desktop não encontrado"
fi

echo ""
echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}  Correção concluída!           ${NC}"
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
