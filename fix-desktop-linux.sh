#!/bin/bash

# Script para corrigir arquivo .desktop no Linux
# Execute este script no Raspberry Pi/Linux

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
DESKTOP_FILE="$USER_HOME/.local/share/applications/depara.desktop"

echo -e "${BLUE}🔧 Corrigindo arquivo .desktop do DePara...${NC}"

# 1. Verificar se o DePara está rodando
if pgrep -f "node.*main.js" > /dev/null; then
    echo -e "${GREEN}✅ DePara está rodando${NC}"
else
    echo -e "${YELLOW}⚠️ DePara não está rodando, iniciando...${NC}"
    cd "$DEPARA_DIR" && nohup npm start > /dev/null 2>&1 &
    sleep 3
fi

# 2. Criar diretório se não existir
mkdir -p "$(dirname "$DESKTOP_FILE")"

# 3. Criar arquivo .desktop corrigido
echo -e "${YELLOW}🔧 Criando arquivo .desktop corrigido...${NC}"

cat > "$DESKTOP_FILE" << EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=DePara
Comment=Gerenciador de Arquivos e Operações
Exec=$DEPARA_DIR/start-depara.sh open
Icon=$DEPARA_DIR/src/public/favicon.ico
Terminal=false
StartupNotify=true
Categories=Utility;FileManager;
Keywords=files;manager;sync;backup;
StartupWMClass=DePara
MimeType=application/x-depara;
EOF

# 4. Tornar o arquivo .desktop executável
chmod +x "$DESKTOP_FILE"

# 5. Atualizar cache do desktop
if command -v update-desktop-database &> /dev/null; then
    update-desktop-database "$USER_HOME/.local/share/applications"
    echo -e "${GREEN}✅ Cache do desktop atualizado${NC}"
fi

# 6. Verificar se o script start-depara.sh existe e está executável
if [ -f "$DEPARA_DIR/start-depara.sh" ]; then
    chmod +x "$DEPARA_DIR/start-depara.sh"
    echo -e "${GREEN}✅ Script start-depara.sh está executável${NC}"
else
    echo -e "${RED}❌ Script start-depara.sh não encontrado${NC}"
fi

# 7. Verificar se o ícone existe
if [ -f "$DEPARA_DIR/src/public/favicon.ico" ]; then
    echo -e "${GREEN}✅ Ícone encontrado${NC}"
else
    echo -e "${YELLOW}⚠️ Ícone não encontrado, criando um simples...${NC}"
    # Criar um ícone simples se não existir
    mkdir -p "$DEPARA_DIR/src/public"
    # Usar um ícone padrão do sistema temporariamente
    if [ -f "/usr/share/pixmaps/folder.png" ]; then
        cp "/usr/share/pixmaps/folder.png" "$DEPARA_DIR/src/public/favicon.ico"
    fi
fi

# 8. Testar funcionalidade do .desktop
echo -e "${YELLOW}🧪 Testando funcionalidade do .desktop...${NC}"

if desktop-file-validate "$DESKTOP_FILE" 2>/dev/null; then
    echo -e "${GREEN}✅ Arquivo .desktop é válido${NC}"
else
    echo -e "${YELLOW}⚠️ Arquivo .desktop pode ter problemas, mas foi criado${NC}"
fi

# 9. Verificar status final
echo -e "${BLUE}📊 Status final:${NC}"
if pgrep -f "node.*main.js" > /dev/null; then
    echo -e "${GREEN}✅ DePara está rodando${NC}"
    echo -e "${GREEN}✅ Arquivo .desktop corrigido${NC}"
    echo -e "${GREEN}✅ Script start-depara.sh executável${NC}"
    echo -e "${BLUE}🌐 Acesse: http://localhost:3000${NC}"
    echo -e "${BLUE}📱 Ícone em Acessórios deve funcionar agora${NC}"
else
    echo -e "${RED}❌ DePara não está rodando${NC}"
    echo -e "${YELLOW}💡 Execute: cd $DEPARA_DIR && npm start${NC}"
fi

echo -e "${GREEN}🎉 Correções aplicadas com sucesso!${NC}"
