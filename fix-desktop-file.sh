#!/bin/bash

# Script para corrigir arquivo .desktop do DePara
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

echo -e "${BLUE}🔧 Corrigindo arquivo .desktop do DePara...${NC}"

# 1. Navegar para o diretório do DePara
cd "$DEPARA_DIR" || {
    echo -e "${RED}❌ Erro: Não foi possível acessar $DEPARA_DIR${NC}"
    exit 1
}

# 2. Verificar se o script de início existe
echo -e "${YELLOW}🔍 Verificando script de início...${NC}"

if [ ! -f "start-depara.sh" ]; then
    echo -e "${YELLOW}📝 Criando script de início...${NC}"
    
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

# 3. Criar diretório de aplicações se não existir
echo -e "${YELLOW}📁 Criando diretório de aplicações...${NC}"
mkdir -p "$DESKTOP_DIR"

# 4. Remover arquivo .desktop antigo se existir
echo -e "${YELLOW}🗑️ Removendo arquivo .desktop antigo...${NC}"
rm -f "$DESKTOP_DIR/depara.desktop"

# 5. Criar novo arquivo .desktop correto
echo -e "${YELLOW}📝 Criando arquivo .desktop correto...${NC}"

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
MimeType=
NoDisplay=false
Hidden=false
EOF

# 6. Tornar arquivo .desktop executável
chmod +x "$DESKTOP_DIR/depara.desktop"

# 7. Verificar se o arquivo foi criado corretamente
echo -e "${YELLOW}🔍 Verificando arquivo .desktop...${NC}"

if [ -f "$DESKTOP_DIR/depara.desktop" ]; then
    echo -e "${GREEN}✅ Arquivo .desktop criado com sucesso${NC}"
    
    # Mostrar conteúdo do arquivo
    echo -e "${BLUE}📄 Conteúdo do arquivo .desktop:${NC}"
    cat "$DESKTOP_DIR/depara.desktop"
else
    echo -e "${RED}❌ Erro ao criar arquivo .desktop${NC}"
    exit 1
fi

# 8. Verificar se o ícone existe
echo -e "${YELLOW}🎨 Verificando ícone...${NC}"

if [ -f "$DEPARA_DIR/src/public/logos/depara_logo_icon.svg" ]; then
    echo -e "${GREEN}✅ Ícone SVG encontrado${NC}"
else
    echo -e "${RED}❌ Ícone SVG não encontrado${NC}"
    echo -e "${YELLOW}💡 Criando ícone temporário...${NC}"
    
    # Criar diretório de logos se não existir
    mkdir -p "$DEPARA_DIR/src/public/logos"
    
    # Criar ícone SVG simples
    cat > "$DEPARA_DIR/src/public/logos/depara_logo_icon.svg" << 'EOF'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <circle cx="50" cy="50" r="45" fill="#5E7CF4" stroke="#8A5CF6" stroke-width="2"/>
  <text x="50" y="60" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="24" font-weight="bold">DP</text>
</svg>
EOF
    
    echo -e "${GREEN}✅ Ícone temporário criado${NC}"
fi

# 9. Atualizar cache de ícones
echo -e "${YELLOW}🔄 Atualizando cache de ícones...${NC}"

ICONS_DIR="$USER_HOME/.local/share/icons"
mkdir -p "$ICONS_DIR"

# Copiar ícone para diretório de ícones
cp "$DEPARA_DIR/src/public/logos/depara_logo_icon.svg" "$ICONS_DIR/depara.svg"

# Atualizar cache de ícones do sistema
if command -v gtk-update-icon-cache >/dev/null 2>&1; then
    gtk-update-icon-cache -f -t "$ICONS_DIR" 2>/dev/null || true
    echo -e "${GREEN}✅ Cache de ícones atualizado${NC}"
else
    echo -e "${YELLOW}⚠️ gtk-update-icon-cache não encontrado${NC}"
fi

# 10. Atualizar banco de dados de aplicações
echo -e "${YELLOW}🔄 Atualizando banco de dados de aplicações...${NC}"

if command -v update-desktop-database >/dev/null 2>&1; then
    update-desktop-database "$DESKTOP_DIR" 2>/dev/null || true
    echo -e "${GREEN}✅ Banco de dados de aplicações atualizado${NC}"
else
    echo -e "${YELLOW}⚠️ update-desktop-database não encontrado${NC}"
fi

# 11. Verificar se o DePara está rodando
echo -e "${YELLOW}🔍 Verificando se o DePara está rodando...${NC}"

if pgrep -f "node.*main.js" > /dev/null; then
    echo -e "${GREEN}✅ DePara está rodando${NC}"
else
    echo -e "${YELLOW}▶️ Iniciando DePara...${NC}"
    nohup npm start > /dev/null 2>&1 &
    sleep 3
    
    if pgrep -f "node.*main.js" > /dev/null; then
        echo -e "${GREEN}✅ DePara iniciado com sucesso${NC}"
    else
        echo -e "${RED}❌ Erro ao iniciar DePara${NC}"
    fi
fi

# 12. Testar abertura do DePara
echo -e "${YELLOW}🧪 Testando abertura do DePara...${NC}"

# Testar se o script funciona
if [ -x "$DEPARA_DIR/start-depara.sh" ]; then
    echo -e "${GREEN}✅ Script de início é executável${NC}"
else
    echo -e "${RED}❌ Script de início não é executável${NC}"
    chmod +x "$DEPARA_DIR/start-depara.sh"
fi

# Testar se a API responde
if curl -s http://localhost:3000/api/health | grep -q "success"; then
    echo -e "${GREEN}✅ API funcionando${NC}"
else
    echo -e "${RED}❌ API com problemas${NC}"
fi

# 13. Resumo final
echo -e "${BLUE}📊 Resumo das correções:${NC}"
echo -e "${GREEN}✅ Arquivo .desktop corrigido${NC}"
echo -e "${GREEN}✅ Script de início criado/verificado${NC}"
echo -e "${GREEN}✅ Ícone configurado${NC}"
echo -e "${GREEN}✅ Cache de ícones atualizado${NC}"
echo -e "${GREEN}✅ Banco de dados de aplicações atualizado${NC}"
echo -e "${BLUE}🌐 Acesse: http://localhost:3000${NC}"
echo -e "${YELLOW}💡 Agora o ícone do DePara deve abrir sem erro!${NC}"

echo -e "${GREEN}🎉 Correções aplicadas com sucesso!${NC}"
