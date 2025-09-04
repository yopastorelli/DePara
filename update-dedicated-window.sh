#!/bin/bash

# Script para atualizar DePara com janela dedicada
# Execute este script no Raspberry Pi

# Detectar usuário atual
CURRENT_USER=$(whoami)
USER_HOME="/home/$CURRENT_USER"
DEPARA_DIR="$USER_HOME/DePara"

echo "🔧 Atualizando DePara para janela dedicada..."

# Navegar para o diretório do projeto
cd "$DEPARA_DIR" || {
    echo "❌ Erro: Não foi possível acessar $DEPARA_DIR"
    exit 1
}

# Atualizar repositório
echo "📥 Atualizando repositório..."
git pull origin main || {
    echo "❌ Erro ao atualizar repositório"
    exit 1
}

# Recriar link simbólico
echo "🔗 Atualizando link simbólico..."
sudo rm -f /usr/local/bin/depara
sudo ln -sf "$DEPARA_DIR/start-depara.sh" /usr/local/bin/depara
sudo chmod +x /usr/local/bin/depara

# Atualizar arquivo .desktop
echo "🖥️ Atualizando arquivo .desktop..."
mkdir -p "$USER_HOME/.local/share/applications"
cp depara.desktop "$USER_HOME/.local/share/applications/"
update-desktop-database "$USER_HOME/.local/share/applications" 2>/dev/null || true

# Criar diretório temporário para o navegador
echo "📁 Criando diretório temporário para navegador..."
mkdir -p /tmp/depara-browser
chmod 755 /tmp/depara-browser

echo ""
echo "✅ Atualização concluída!"
echo ""
echo "🚀 Agora o DePara abrirá em uma janela dedicada do navegador!"
echo ""
echo "🧪 Para testar:"
echo "   depara open"
echo ""
echo "📱 Ou pelo menu:"
echo "   Aplicações > Utilitários > DePara"
echo ""
echo "💡 A janela dedicada:"
echo "   - Não mostra barra de endereço"
echo "   - Não mostra botões de navegação"
echo "   - Parece uma aplicação nativa"
echo "   - Abre em nova janela sempre"
