#!/bin/bash

# Script para corrigir arquivo .desktop do DePara
# Execute este script no Raspberry Pi

# Detectar usuário atual
CURRENT_USER=$(whoami)
USER_HOME="/home/$CURRENT_USER"
DEPARA_DIR="$USER_HOME/DePara"
APPLICATIONS_DIR="$USER_HOME/.local/share/applications"

echo "🔧 Corrigindo arquivo .desktop para usuário: $CURRENT_USER"

# Navegar para o diretório do projeto
cd "$DEPARA_DIR" || {
    echo "❌ Erro: Não foi possível acessar $DEPARA_DIR"
    exit 1
}

# Remover arquivo .desktop antigo
echo "🗑️ Removendo arquivo .desktop antigo..."
rm -f "$APPLICATIONS_DIR/depara.desktop"
rm -f "$USER_HOME/Desktop/depara.desktop"

# Criar novo arquivo .desktop válido
echo "📝 Criando novo arquivo .desktop..."
cat > "$APPLICATIONS_DIR/depara.desktop" << EOF
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
EOF

# Tornar arquivo executável
chmod +x "$APPLICATIONS_DIR/depara.desktop"

# Atualizar banco de dados de aplicações
echo "🔄 Atualizando banco de dados de aplicações..."
update-desktop-database "$APPLICATIONS_DIR" 2>/dev/null || true

# Criar link no desktop se existir
if [ -d "$USER_HOME/Desktop" ]; then
    echo "🖥️ Criando link no desktop..."
    ln -sf "$APPLICATIONS_DIR/depara.desktop" "$USER_HOME/Desktop/"
fi

# Verificar se o arquivo é válido
echo "✅ Verificando arquivo .desktop..."
if desktop-file-validate "$APPLICATIONS_DIR/depara.desktop" 2>/dev/null; then
    echo "✅ Arquivo .desktop é válido!"
else
    echo "⚠️ Arquivo .desktop pode ter problemas"
    echo "📋 Conteúdo do arquivo:"
    cat "$APPLICATIONS_DIR/depara.desktop"
fi

echo ""
echo "🎉 Correção concluída!"
echo ""
echo "📱 O DePara deve aparecer no menu:"
echo "   Aplicações > Utilitários > DePara"
echo ""
echo "🧪 Para testar:"
echo "   1. Abra o menu do Raspberry Pi"
echo "   2. Vá para Acessórios/Utilitários"
echo "   3. Clique em DePara"
echo ""
echo "🔧 Se ainda não funcionar, execute:"
echo "   depara open"
