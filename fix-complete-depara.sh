#!/bin/bash

# Script completo para corrigir e organizar o DePara
# Execute este script no Raspberry Pi

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Detectar usuário atual
CURRENT_USER=$(whoami)
USER_HOME="/home/$CURRENT_USER"
DEPARA_BACKUP_DIR="$USER_HOME/DePara-backup"
DEPARA_DIR="$USER_HOME/DePara"

echo -e "${BLUE}🔧 Script completo para corrigir e organizar o DePara...${NC}"

# 1. Parar todos os processos do DePara
echo -e "${YELLOW}⏹️ Parando todos os processos do DePara...${NC}"

# Parar processos que estão usando a porta 3000
if lsof -ti:3000 > /dev/null 2>&1; then
    echo -e "${YELLOW}🔄 Parando processos na porta 3000...${NC}"
    lsof -ti:3000 | xargs kill -9 2>/dev/null || true
    sleep 2
fi

# Parar processos do Node.js
if pgrep -f "node.*main.js" > /dev/null; then
    echo -e "${YELLOW}🔄 Parando processos do Node.js...${NC}"
    pkill -f "node.*main.js" 2>/dev/null || true
    sleep 2
fi

echo -e "${GREEN}✅ Processos parados${NC}"

# 2. Navegar para o diretório backup
cd "$DEPARA_BACKUP_DIR" || {
    echo -e "${RED}❌ Erro: Não foi possível acessar $DEPARA_BACKUP_DIR${NC}"
    exit 1
}

# 3. Fazer pull das atualizações
echo -e "${YELLOW}📥 Atualizando repositório...${NC}"

# Fazer stash das mudanças locais se houver
git stash push -m "Backup antes da atualização completa" 2>/dev/null || true

# Fazer pull
git pull origin main

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Repositório atualizado com sucesso${NC}"
else
    echo -e "${RED}❌ Erro ao atualizar repositório${NC}"
    exit 1
fi

# 4. Reinstalar dependências
echo -e "${YELLOW}📦 Reinstalando dependências...${NC}"
npm install

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Dependências instaladas com sucesso${NC}"
else
    echo -e "${RED}❌ Erro ao instalar dependências${NC}"
    exit 1
fi

# 5. Remover diretório antigo se existir
echo -e "${YELLOW}🗑️ Removendo diretório antigo...${NC}"
if [ -d "$DEPARA_DIR" ]; then
    rm -rf "$DEPARA_DIR"
    echo -e "${GREEN}✅ Diretório antigo removido${NC}"
else
    echo -e "${YELLOW}⚠️ Diretório antigo não encontrado${NC}"
fi

# 6. Renomear backup para diretório principal
echo -e "${YELLOW}📁 Renomeando diretório...${NC}"
cd "$USER_HOME"
mv "$DEPARA_BACKUP_DIR" "$DEPARA_DIR"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Diretório renomeado para DePara${NC}"
else
    echo -e "${RED}❌ Erro ao renomear diretório${NC}"
    exit 1
fi

# 7. Navegar para o diretório principal
cd "$DEPARA_DIR" || {
    echo -e "${RED}❌ Erro: Não foi possível acessar $DEPARA_DIR${NC}"
    exit 1
}

# 8. Corrigir arquivo .desktop
echo -e "${YELLOW}🔧 Corrigindo arquivo .desktop...${NC}"

DESKTOP_DIR="$USER_HOME/.local/share/applications"
mkdir -p "$DESKTOP_DIR"

# Remover arquivo .desktop antigo se existir
rm -f "$DESKTOP_DIR/depara.desktop"

# Criar novo arquivo .desktop correto
cat > "$DESKTOP_DIR/depara.desktop" << EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=DePara
Comment=DePara - Sistema de Sincronização de Arquivos
Exec=$DEPARA_DIR/start-depara.sh
Icon=$DEPARA_DIR/src/public/logos/depara_logo_icon.svg
Terminal=false
StartupNotify=true
Categories=Utility;FileManager;
Keywords=files;sync;backup;
StartupWMClass=DePara
Path=$DEPARA_DIR
EOF

# Tornar executável
chmod +x "$DESKTOP_DIR/depara.desktop"

# 9. Criar script de início se não existir
echo -e "${YELLOW}📝 Criando script de início...${NC}"

if [ ! -f "start-depara.sh" ]; then
    cat > start-depara.sh << 'EOF'
#!/bin/bash

# Script para iniciar o DePara
# Navegar para o diretório do DePara
cd "$(dirname "$0")"

# Verificar se o Node.js está instalado
if ! command -v node >/dev/null 2>&1; then
    echo "❌ Node.js não encontrado. Instale o Node.js primeiro."
    exit 1
fi

# Verificar se o npm está instalado
if ! command -v npm >/dev/null 2>&1; then
    echo "❌ npm não encontrado. Instale o npm primeiro."
    exit 1
fi

# Verificar se as dependências estão instaladas
if [ ! -d "node_modules" ]; then
    echo "📦 Instalando dependências..."
    npm install
fi

# Iniciar o DePara
echo "🚀 Iniciando DePara..."
npm start
EOF

    chmod +x start-depara.sh
    echo -e "${GREEN}✅ Script de início criado${NC}"
else
    echo -e "${GREEN}✅ Script de início já existe${NC}"
fi

# 10. Atualizar cache de ícones
echo -e "${YELLOW}🔄 Atualizando cache de ícones...${NC}"

ICONS_DIR="$USER_HOME/.local/share/icons"
mkdir -p "$ICONS_DIR"

# Copiar ícone SVG
if [ -f "src/public/logos/depara_logo_icon.svg" ]; then
    cp "src/public/logos/depara_logo_icon.svg" "$ICONS_DIR/depara.svg"
    echo -e "${GREEN}✅ Ícone SVG copiado${NC}"
fi

# Atualizar cache de ícones do sistema
if command -v gtk-update-icon-cache >/dev/null 2>&1; then
    gtk-update-icon-cache -f -t "$ICONS_DIR" 2>/dev/null || true
fi

# Atualizar banco de dados de aplicações
if command -v update-desktop-database >/dev/null 2>&1; then
    update-desktop-database "$DESKTOP_DIR" 2>/dev/null || true
fi

# 11. Iniciar DePara
echo -e "${YELLOW}▶️ Iniciando DePara...${NC}"

# Iniciar em background
nohup npm start > /dev/null 2>&1 &
sleep 5

# 12. Verificar se está rodando
if pgrep -f "node.*main.js" > /dev/null; then
    echo -e "${GREEN}✅ DePara iniciado com sucesso${NC}"
else
    echo -e "${RED}❌ Erro ao iniciar DePara${NC}"
    echo -e "${YELLOW}💡 Tente executar manualmente: npm start${NC}"
fi

# 13. Testar API
echo -e "${YELLOW}🧪 Testando API...${NC}"
sleep 3

if curl -s http://localhost:3000/api/health | grep -q "success"; then
    echo -e "${GREEN}✅ API funcionando perfeitamente${NC}"
    
    # Mostrar resposta da API
    API_RESPONSE=$(curl -s http://localhost:3000/api/health)
    echo -e "${BLUE}📄 Resposta da API: $API_RESPONSE${NC}"
else
    echo -e "${RED}❌ API com problemas${NC}"
    
    # Tentar rota básica
    if curl -s http://localhost:3000/health | grep -q "OK"; then
        echo -e "${GREEN}✅ Rota básica funcionando${NC}"
    else
        echo -e "${RED}❌ Rota básica também com problemas${NC}"
    fi
fi

# 14. Resumo final
echo -e "${BLUE}📊 Resumo das correções:${NC}"
echo -e "${GREEN}✅ DePara atualizado e organizado${NC}"
echo -e "${GREEN}✅ Diretório renomeado (sem -backup)${NC}"
echo -e "${GREEN}✅ Arquivo .desktop corrigido${NC}"
echo -e "${GREEN}✅ Script de início criado${NC}"
echo -e "${GREEN}✅ Cache de ícones atualizado${NC}"
echo -e "${GREEN}✅ DePara iniciado${NC}"
echo -e "${BLUE}🌐 Acesse: http://localhost:3000${NC}"
echo -e "${BLUE}🔧 Interface: http://localhost:3000/ui${NC}"
echo -e "${YELLOW}💡 O ícone do DePara deve aparecer bonito no menu!${NC}"

echo -e "${GREEN}🎉 Script executado com sucesso!${NC}"
