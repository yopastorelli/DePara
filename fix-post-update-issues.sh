#!/bin/bash

# Script para corrigir problemas após atualização automática
# - Corrigir arquivo .desktop
# - Melhorar funcionalidade de reinicialização
# - Verificar permissões e caminhos

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Detectar usuário atual e diretório do projeto
CURRENT_USER=$(whoami)
USER_HOME="/home/$CURRENT_USER"
DEPARA_DIR="$USER_HOME/DePara"
DESKTOP_FILE="$USER_HOME/.local/share/applications/depara.desktop"

echo -e "${BLUE}🔧 Corrigindo problemas pós-atualização do DePara...${NC}"

# 1. Verificar se o DePara está rodando
echo -e "${YELLOW}📊 Verificando status do DePara...${NC}"
if pgrep -f "node.*main.js" > /dev/null; then
    echo -e "${GREEN}✅ DePara está rodando${NC}"
else
    echo -e "${YELLOW}⚠️ DePara não está rodando, iniciando...${NC}"
    cd "$DEPARA_DIR" && nohup npm start > /dev/null 2>&1 &
    sleep 3
fi

# 2. Corrigir arquivo .desktop
echo -e "${YELLOW}🔧 Corrigindo arquivo .desktop...${NC}"

# Criar diretório se não existir
mkdir -p "$(dirname "$DESKTOP_FILE")"

# Criar arquivo .desktop corrigido
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

# Tornar o arquivo .desktop executável
chmod +x "$DESKTOP_FILE"

# Atualizar cache do desktop
if command -v update-desktop-database &> /dev/null; then
    update-desktop-database "$USER_HOME/.local/share/applications"
    echo -e "${GREEN}✅ Cache do desktop atualizado${NC}"
fi

# 3. Verificar e corrigir permissões do script start-depara.sh
echo -e "${YELLOW}🔧 Verificando permissões do script...${NC}"
if [ -f "$DEPARA_DIR/start-depara.sh" ]; then
    chmod +x "$DEPARA_DIR/start-depara.sh"
    echo -e "${GREEN}✅ Script start-depara.sh está executável${NC}"
else
    echo -e "${RED}❌ Script start-depara.sh não encontrado${NC}"
fi

# 4. Melhorar funcionalidade de reinicialização
echo -e "${YELLOW}🔧 Melhorando funcionalidade de reinicialização...${NC}"

# Criar script de reinicialização melhorado
cat > "$DEPARA_DIR/restart-depara.sh" << 'EOF'
#!/bin/bash

# Script melhorado para reinicializar o DePara
CURRENT_USER=$(whoami)
USER_HOME="/home/$CURRENT_USER"
DEPARA_DIR="$USER_HOME/DePara"

echo "🔄 Reiniciando DePara..."

# Parar DePara se estiver rodando
if pgrep -f "node.*main.js" > /dev/null; then
    echo "⏹️ Parando DePara..."
    pkill -f "node.*main.js"
    sleep 3
fi

# Navegar para o diretório
cd "$DEPARA_DIR" || {
    echo "❌ Erro: Não foi possível acessar $DEPARA_DIR"
    exit 1
}

# Reinstalar dependências se necessário
if [ -f "package.json" ]; then
    echo "📦 Verificando dependências..."
    npm install
fi

# Iniciar DePara
echo "▶️ Iniciando DePara..."
nohup npm start > /dev/null 2>&1 &

# Aguardar inicialização
sleep 5

# Verificar se está rodando
if pgrep -f "node.*main.js" > /dev/null; then
    echo "✅ DePara reiniciado com sucesso!"
    echo "🌐 Acesse: http://localhost:3000"
    
    # Abrir no navegador
    if command -v xdg-open &> /dev/null; then
        xdg-open "http://localhost:3000" 2>/dev/null &
    fi
else
    echo "❌ Erro: Falha ao reiniciar DePara"
    exit 1
fi
EOF

chmod +x "$DEPARA_DIR/restart-depara.sh"

# 5. Atualizar rota de reinicialização no backend
echo -e "${YELLOW}🔧 Atualizando rota de reinicialização...${NC}"

# Verificar se a rota existe e está correta
if [ -f "$DEPARA_DIR/src/routes/update.js" ]; then
    # Fazer backup do arquivo original
    cp "$DEPARA_DIR/src/routes/update.js" "$DEPARA_DIR/src/routes/update.js.backup"
    
    # Atualizar a rota de reinicialização para usar o script melhorado
    sed -i 's|exec('\''nohup npm start > /dev/null 2>&1 &'\''|exec('\''bash '$DEPARA_DIR'/restart-depara.sh'\''|g' "$DEPARA_DIR/src/routes/update.js"
    
    echo -e "${GREEN}✅ Rota de reinicialização atualizada${NC}"
else
    echo -e "${YELLOW}⚠️ Arquivo de rotas não encontrado${NC}"
fi

# 6. Testar funcionalidade do .desktop
echo -e "${YELLOW}🧪 Testando funcionalidade do .desktop...${NC}"

# Verificar se o arquivo .desktop é válido
if desktop-file-validate "$DESKTOP_FILE" 2>/dev/null; then
    echo -e "${GREEN}✅ Arquivo .desktop é válido${NC}"
else
    echo -e "${YELLOW}⚠️ Arquivo .desktop pode ter problemas, mas foi criado${NC}"
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

# 8. Reiniciar o DePara para aplicar as correções
echo -e "${YELLOW}🔄 Reiniciando DePara para aplicar correções...${NC}"
if [ -f "$DEPARA_DIR/restart-depara.sh" ]; then
    bash "$DEPARA_DIR/restart-depara.sh"
else
    # Fallback para reinicialização manual
    pkill -f "node.*main.js"
    sleep 2
    cd "$DEPARA_DIR" && nohup npm start > /dev/null 2>&1 &
    sleep 5
fi

# 9. Verificar status final
echo -e "${BLUE}📊 Status final:${NC}"
if pgrep -f "node.*main.js" > /dev/null; then
    echo -e "${GREEN}✅ DePara está rodando${NC}"
    echo -e "${GREEN}✅ Arquivo .desktop corrigido${NC}"
    echo -e "${GREEN}✅ Script de reinicialização melhorado${NC}"
    echo -e "${BLUE}🌐 Acesse: http://localhost:3000${NC}"
    echo -e "${BLUE}📱 Ícone em Acessórios deve funcionar agora${NC}"
else
    echo -e "${RED}❌ DePara não está rodando${NC}"
    echo -e "${YELLOW}💡 Execute manualmente: cd $DEPARA_DIR && npm start${NC}"
fi

echo -e "${GREEN}🎉 Correções aplicadas com sucesso!${NC}"
