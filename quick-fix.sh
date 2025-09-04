#!/bin/bash

# Script de correção rápida para caminhos hardcoded
# Execute este script no Raspberry Pi

# Detectar usuário atual
CURRENT_USER=$(whoami)
USER_HOME="/home/$CURRENT_USER"
DEPARA_DIR="$USER_HOME/DePara"

echo "🔧 Corrigindo caminhos hardcoded para usuário: $CURRENT_USER"

# Navegar para o diretório do projeto
cd "$DEPARA_DIR" || {
    echo "❌ Erro: Não foi possível acessar $DEPARA_DIR"
    exit 1
}

# Corrigir start-depara.sh
echo "📝 Corrigindo start-depara.sh..."
sed -i "s|/home/pi/DePara|$DEPARA_DIR|g" start-depara.sh

# Corrigir depara.desktop
echo "📝 Corrigindo depara.desktop..."
sed -i "s|/home/pi/DePara|$DEPARA_DIR|g" depara.desktop
sed -i "s|/home/yo/DePara|$DEPARA_DIR|g" depara.desktop

# Corrigir depara.service
echo "📝 Corrigindo depara.service..."
sed -i "s|User=pi|User=$CURRENT_USER|g" depara.service
sed -i "s|Group=pi|Group=$CURRENT_USER|g" depara.service
sed -i "s|/home/pi/DePara|$DEPARA_DIR|g" depara.service
sed -i "s|/home/yo/DePara|$DEPARA_DIR|g" depara.service

# Recriar link simbólico
echo "🔗 Recriando link simbólico..."
sudo rm -f /usr/local/bin/depara
sudo ln -sf "$DEPARA_DIR/start-depara.sh" /usr/local/bin/depara

# Recarregar serviço systemd
echo "🔄 Recarregando serviço systemd..."
sudo cp depara.service /etc/systemd/system/
sudo systemctl daemon-reload

# Recriar arquivo .desktop
echo "🖥️ Recriando arquivo .desktop..."
mkdir -p "$USER_HOME/.local/share/applications"
cp depara.desktop "$USER_HOME/.local/share/applications/"
update-desktop-database "$USER_HOME/.local/share/applications" 2>/dev/null || true

# Recriar autostart
echo "🚀 Recriando autostart..."
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

echo "✅ Correção concluída!"
echo ""
echo "🧪 Testando comando depara..."
if depara status > /dev/null 2>&1; then
    echo "✅ Comando depara funcionando!"
else
    echo "⚠️ Comando depara pode ter problemas"
fi

echo ""
echo "🚀 Para iniciar o DePara:"
echo "   depara start"
echo ""
echo "📱 Para acessar pelo menu:"
echo "   Aplicações > Utilitários > DePara"
