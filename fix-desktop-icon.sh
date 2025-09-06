#!/bin/bash

# Script para corrigir o ícone do DePara no menu de aplicações
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
DESKTOP_FILE="$USER_HOME/.local/share/applications/depara.desktop"
ICON_DIR="$USER_HOME/.local/share/icons"

echo -e "${BLUE}🎨 Corrigindo ícone do DePara no menu...${NC}"

# 1. Verificar se o DePara está rodando
if pgrep -f "node.*main.js" > /dev/null; then
    echo -e "${GREEN}✅ DePara está rodando${NC}"
else
    echo -e "${YELLOW}⚠️ DePara não está rodando, iniciando...${NC}"
    cd "$DEPARA_DIR" && nohup npm start > /dev/null 2>&1 &
    sleep 3
fi

# 2. Criar diretório de ícones se não existir
mkdir -p "$ICON_DIR"

# 3. Copiar ícone do DePara para o diretório de ícones
echo -e "${YELLOW}🖼️ Copiando ícone do DePara...${NC}"

# Copiar o ícone icon (melhor para menu)
if [ -f "$DEPARA_DIR/src/public/logos/depara_logo_icon.svg" ]; then
    cp "$DEPARA_DIR/src/public/logos/depara_logo_icon.svg" "$ICON_DIR/depara.svg"
    echo -e "${GREEN}✅ Ícone SVG copiado${NC}"
else
    echo -e "${RED}❌ Ícone SVG não encontrado${NC}"
fi

# Copiar favicon como fallback
if [ -f "$DEPARA_DIR/src/public/favicon/favicon-32x32.png" ]; then
    cp "$DEPARA_DIR/src/public/favicon/favicon-32x32.png" "$ICON_DIR/depara.png"
    echo -e "${GREEN}✅ Ícone PNG copiado${NC}"
else
    echo -e "${RED}❌ Ícone PNG não encontrado${NC}"
fi

# 4. Criar ícone em diferentes tamanhos
echo -e "${YELLOW}🔧 Criando ícones em diferentes tamanhos...${NC}"

# Criar diretório de ícones do DePara
mkdir -p "$ICON_DIR/depara"

# Copiar ícone para diferentes tamanhos
for size in 16 24 32 48 64 128 256; do
    if [ -f "$DEPARA_DIR/src/public/favicon/favicon-${size}x${size}.png" ]; then
        cp "$DEPARA_DIR/src/public/favicon/favicon-${size}x${size}.png" "$ICON_DIR/depara/${size}x${size}.png"
    else
        # Usar o ícone SVG e converter se necessário
        if command -v convert &> /dev/null; then
            convert "$DEPARA_DIR/src/public/logos/depara_logo_icon.svg" -resize ${size}x${size} "$ICON_DIR/depara/${size}x${size}.png" 2>/dev/null || true
        fi
    fi
done

# 5. Atualizar arquivo .desktop
echo -e "${YELLOW}🔧 Atualizando arquivo .desktop...${NC}"

# Criar diretório se não existir
mkdir -p "$(dirname "$DESKTOP_FILE")"

# Criar arquivo .desktop corrigido
cat > "$DESKTOP_FILE" << EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=DePara
Comment=Gerenciador de Arquivos e Operações - mover, copiar, apagar
Exec=$DEPARA_DIR/start-depara.sh open
Icon=depara
Terminal=false
StartupNotify=true
Categories=Utility;FileManager;Office;
Keywords=files;manager;sync;backup;mover;copiar;apagar;
StartupWMClass=DePara
MimeType=application/x-depara;
X-GNOME-Autostart-enabled=false
EOF

# Tornar o arquivo .desktop executável
chmod +x "$DESKTOP_FILE"

# 6. Atualizar cache do desktop
echo -e "${YELLOW}🔄 Atualizando cache do desktop...${NC}"

# Atualizar cache do desktop
if command -v update-desktop-database &> /dev/null; then
    update-desktop-database "$USER_HOME/.local/share/applications"
    echo -e "${GREEN}✅ Cache do desktop atualizado${NC}"
fi

# Atualizar cache de ícones
if command -v gtk-update-icon-cache &> /dev/null; then
    gtk-update-icon-cache -f -t "$ICON_DIR" 2>/dev/null || true
    echo -e "${GREEN}✅ Cache de ícones atualizado${NC}"
fi

# 7. Verificar se o script start-depara.sh existe e está executável
if [ -f "$DEPARA_DIR/start-depara.sh" ]; then
    chmod +x "$DEPARA_DIR/start-depara.sh"
    echo -e "${GREEN}✅ Script start-depara.sh está executável${NC}"
else
    echo -e "${RED}❌ Script start-depara.sh não encontrado${NC}"
fi

# 8. Criar ícone de alta qualidade usando o logo stacked
echo -e "${YELLOW}🎨 Criando ícone de alta qualidade...${NC}"

# Usar o logo stacked como base para o ícone
if [ -f "$DEPARA_DIR/src/public/logos/depara_logo_stacked.svg" ]; then
    # Criar versão otimizada para menu
    cp "$DEPARA_DIR/src/public/logos/depara_logo_stacked.svg" "$ICON_DIR/depara-menu.svg"
    
    # Converter para PNG em diferentes tamanhos se ImageMagick estiver disponível
    if command -v convert &> /dev/null; then
        for size in 32 48 64 128; do
            convert "$DEPARA_DIR/src/public/logos/depara_logo_stacked.svg" -resize ${size}x${size} -background transparent "$ICON_DIR/depara-${size}.png" 2>/dev/null || true
        done
        echo -e "${GREEN}✅ Ícones de alta qualidade criados${NC}"
    fi
fi

# 9. Atualizar arquivo .desktop com ícone de alta qualidade
cat > "$DESKTOP_FILE" << EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=DePara
Comment=Gerenciador de Arquivos e Operações - mover, copiar, apagar
Exec=$DEPARA_DIR/start-depara.sh open
Icon=depara-menu
Terminal=false
StartupNotify=true
Categories=Utility;FileManager;Office;
Keywords=files;manager;sync;backup;mover;copiar;apagar;
StartupWMClass=DePara
MimeType=application/x-depara;
X-GNOME-Autostart-enabled=false
EOF

# 10. Testar funcionalidade do .desktop
echo -e "${YELLOW}🧪 Testando funcionalidade do .desktop...${NC}"

if desktop-file-validate "$DESKTOP_FILE" 2>/dev/null; then
    echo -e "${GREEN}✅ Arquivo .desktop é válido${NC}"
else
    echo -e "${YELLOW}⚠️ Arquivo .desktop pode ter problemas, mas foi criado${NC}"
fi

# 11. Verificar status final
echo -e "${BLUE}📊 Status final:${NC}"
if pgrep -f "node.*main.js" > /dev/null; then
    echo -e "${GREEN}✅ DePara está rodando${NC}"
    echo -e "${GREEN}✅ Arquivo .desktop corrigido${NC}"
    echo -e "${GREEN}✅ Ícones atualizados${NC}"
    echo -e "${GREEN}✅ Cache do desktop atualizado${NC}"
    echo -e "${BLUE}🌐 Acesse: http://localhost:3000${NC}"
    echo -e "${BLUE}📱 Ícone no menu deve estar corrigido agora${NC}"
    echo -e "${BLUE}🔄 Reinicie o menu de aplicações para ver as mudanças${NC}"
else
    echo -e "${RED}❌ DePara não está rodando${NC}"
    echo -e "${YELLOW}💡 Execute: cd $DEPARA_DIR && npm start${NC}"
fi

echo -e "${GREEN}🎉 Correção do ícone aplicada com sucesso!${NC}"
echo -e "${YELLOW}💡 Dica: Feche e abra o menu de aplicações para ver o novo ícone${NC}"
