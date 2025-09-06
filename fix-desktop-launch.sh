#!/bin/bash

# Script para corrigir problema de abertura do DePara
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
DEPARA_DIR="$USER_HOME/DePara"
DESKTOP_DIR="$USER_HOME/.local/share/applications"

echo -e "${BLUE}🔧 Corrigindo problema de abertura do DePara...${NC}"

# 1. Navegar para o diretório
cd "$DEPARA_DIR" || {
    echo -e "${RED}❌ Erro: Não foi possível acessar $DEPARA_DIR${NC}"
    exit 1
}

# 2. Verificar se o script de início existe
echo -e "${YELLOW}🔍 Verificando script de início...${NC}"

if [ ! -f "start-depara.sh" ]; then
    echo -e "${YELLOW}📝 Criando script de início...${NC}"
    
    # Criar script de início
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

    # Tornar executável
    chmod +x start-depara.sh
    echo -e "${GREEN}✅ Script de início criado${NC}"
else
    echo -e "${GREEN}✅ Script de início já existe${NC}"
fi

# 3. Verificar se o package.json tem o script start
echo -e "${YELLOW}🔍 Verificando package.json...${NC}"

if ! grep -q '"start"' package.json; then
    echo -e "${YELLOW}📝 Adicionando script start ao package.json...${NC}"
    
    # Fazer backup do package.json
    cp package.json package.json.backup
    
    # Adicionar script start se não existir
    if ! grep -q '"scripts"' package.json; then
        # Adicionar seção de scripts
        sed -i '/"main":/a\  "scripts": {\n    "start": "node src/main.js",\n    "start:bg": "nohup node src/main.js > /dev/null 2>&1 &"\n  },' package.json
    else
        # Adicionar script start dentro da seção existente
        sed -i '/"scripts": {/,/}/ s/"scripts": {/"scripts": {\n    "start": "node src/main.js",\n    "start:bg": "nohup node src/main.js > \/dev\/null 2>&1 &",/' package.json
    fi
    
    echo -e "${GREEN}✅ Script start adicionado ao package.json${NC}"
else
    echo -e "${GREEN}✅ Script start já existe no package.json${NC}"
fi

# 4. Corrigir arquivo .desktop
echo -e "${YELLOW}🔧 Corrigindo arquivo .desktop...${NC}"

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

# 5. Tornar arquivo .desktop executável
chmod +x "$DESKTOP_DIR/depara.desktop"

# 6. Atualizar banco de dados de aplicações
echo -e "${YELLOW}🔄 Atualizando banco de dados de aplicações...${NC}"

if command -v update-desktop-database >/dev/null 2>&1; then
    update-desktop-database "$DESKTOP_DIR" 2>/dev/null || true
    echo -e "${GREEN}✅ Banco de dados atualizado${NC}"
else
    echo -e "${YELLOW}⚠️ update-desktop-database não encontrado${NC}"
fi

# 7. Verificar se o DePara está rodando
echo -e "${YELLOW}🔍 Verificando se o DePara está rodando...${NC}"

if pgrep -f "node.*main.js" > /dev/null; then
    echo -e "${GREEN}✅ DePara já está rodando${NC}"
else
    echo -e "${YELLOW}▶️ Iniciando DePara...${NC}"
    
    # Iniciar DePara em background
    nohup npm start > /dev/null 2>&1 &
    sleep 3
    
    if pgrep -f "node.*main.js" > /dev/null; then
        echo -e "${GREEN}✅ DePara iniciado com sucesso${NC}"
    else
        echo -e "${RED}❌ Erro ao iniciar DePara${NC}"
        echo -e "${YELLOW}💡 Tente executar manualmente: npm start${NC}"
    fi
fi

# 8. Testar abertura do DePara
echo -e "${YELLOW}🧪 Testando abertura do DePara...${NC}"

# Testar se o script funciona
if [ -x "$DEPARA_DIR/start-depara.sh" ]; then
    echo -e "${GREEN}✅ Script de início é executável${NC}"
else
    echo -e "${RED}❌ Script de início não é executável${NC}"
    chmod +x "$DEPARA_DIR/start-depara.sh"
fi

# Testar se a API responde
sleep 2
if curl -s http://localhost:3000/api/health | grep -q "success"; then
    echo -e "${GREEN}✅ API do DePara funcionando${NC}"
else
    echo -e "${RED}❌ API do DePara com problemas${NC}"
fi

# 9. Resumo final
echo -e "${BLUE}📊 Resumo das correções:${NC}"
echo -e "${GREEN}✅ Script de início criado/corrigido${NC}"
echo -e "${GREEN}✅ Arquivo .desktop corrigido${NC}"
echo -e "${GREEN}✅ Package.json atualizado${NC}"
echo -e "${GREEN}✅ Banco de dados de aplicações atualizado${NC}"
echo -e "${BLUE}🌐 Acesse: http://localhost:3000${NC}"
echo -e "${YELLOW}💡 Agora o DePara deve abrir quando clicar no ícone!${NC}"

echo -e "${GREEN}🎉 Correções aplicadas com sucesso!${NC}"
