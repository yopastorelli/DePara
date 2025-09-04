#!/bin/bash

# Script para criar ícone na bandeja do sistema
# Execute este script no Raspberry Pi

# Detectar usuário atual
CURRENT_USER=$(whoami)
USER_HOME="/home/$CURRENT_USER"
DEPARA_DIR="$USER_HOME/DePara"

echo "🔧 Criando ícone na bandeja do sistema..."

# Navegar para o diretório do projeto
cd "$DEPARA_DIR" || {
    echo "❌ Erro: Não foi possível acessar $DEPARA_DIR"
    exit 1
}

# Instalar dependências para system tray
echo "📦 Instalando dependências para system tray..."
sudo apt update
sudo apt install -y python3-pip python3-gi python3-gi-cairo gir1.2-gtk-3.0 gir1.2-appindicator3-0.1

# Criar script Python para system tray
echo "🐍 Criando script Python para system tray..."
cat > tray_icon.py << 'EOF'
#!/usr/bin/env python3
import gi
gi.require_version('Gtk', '3.0')
gi.require_version('AppIndicator3', '0.1')
from gi.repository import Gtk, AppIndicator3
import subprocess
import os
import signal
import sys

class DeParaTray:
    def __init__(self):
        self.indicator = AppIndicator3.Indicator.new(
            "depara-tray",
            "applications-system",
            AppIndicator3.IndicatorCategory.APPLICATION_STATUS
        )
        self.indicator.set_status(AppIndicator3.IndicatorStatus.ACTIVE)
        self.indicator.set_menu(self.create_menu())
        
    def create_menu(self):
        menu = Gtk.Menu()
        
        # Item para abrir DePara
        open_item = Gtk.MenuItem("Abrir DePara")
        open_item.connect("activate", self.open_depara)
        menu.append(open_item)
        
        # Separador
        separator = Gtk.SeparatorMenuItem()
        menu.append(separator)
        
        # Item para restaurar janela
        restore_item = Gtk.MenuItem("Restaurar Janela")
        restore_item.connect("activate", self.restore_window)
        menu.append(restore_item)
        
        # Item para minimizar
        minimize_item = Gtk.MenuItem("Minimizar")
        minimize_item.connect("activate", self.minimize_window)
        menu.append(minimize_item)
        
        # Separador
        separator2 = Gtk.SeparatorMenuItem()
        menu.append(separator2)
        
        # Item para sair
        quit_item = Gtk.MenuItem("Sair")
        quit_item.connect("activate", self.quit_app)
        menu.append(quit_item)
        
        menu.show_all()
        return menu
    
    def open_depara(self, widget):
        subprocess.Popen(['depara', 'open'])
    
    def restore_window(self, widget):
        subprocess.Popen(['depara', 'restore'])
    
    def minimize_window(self, widget):
        subprocess.Popen(['depara', 'minimize'])
    
    def quit_app(self, widget):
        Gtk.main_quit()
    
    def run(self):
        Gtk.main()

if __name__ == "__main__":
    app = DeParaTray()
    signal.signal(signal.SIGINT, signal.SIG_DFL)
    app.run()
EOF

# Tornar script executável
chmod +x tray_icon.py

# Criar script de inicialização do system tray
echo "🚀 Criando script de inicialização do system tray..."
cat > start-tray-icon.sh << 'EOF'
#!/bin/bash
# Script para iniciar ícone do system tray

DEPARA_DIR="/home/$(whoami)/DePara"
cd "$DEPARA_DIR" || exit 1

# Verificar se DePara está rodando
if ! pgrep -f "node.*main.js" > /dev/null; then
    echo "❌ DePara não está rodando. Iniciando..."
    nohup npm start > /dev/null 2>&1 &
    sleep 3
fi

# Iniciar ícone do system tray
python3 tray_icon.py &
EOF

chmod +x start-tray-icon.sh

# Criar entrada no autostart
echo "🔄 Configurando autostart do system tray..."
mkdir -p "$USER_HOME/.config/autostart"

cat > "$USER_HOME/.config/autostart/depara-tray.desktop" << EOF
[Desktop Entry]
Type=Application
Name=DePara System Tray
Comment=DePara System Tray Icon
Exec=$DEPARA_DIR/start-tray-icon.sh
Icon=applications-system
Hidden=false
NoDisplay=false
X-GNOME-Autostart-enabled=true
EOF

echo ""
echo "🎉 Ícone do system tray criado com sucesso!"
echo ""
echo "📋 Funcionalidades implementadas:"
echo "   ✅ Ícone na bandeja do sistema"
echo "   ✅ Menu com opções: Abrir, Restaurar, Minimizar, Sair"
echo "   ✅ Autostart configurado"
echo "   ✅ Integração com comandos depara"
echo ""
echo "🧪 Para testar:"
echo "   1. Reinicie o sistema ou execute: $DEPARA_DIR/start-tray-icon.sh"
echo "   2. Procure o ícone na bandeja do sistema"
echo "   3. Clique com botão direito para ver o menu"
echo "   4. Use 'Abrir DePara' para abrir a aplicação"
echo "   5. Use 'Minimizar' para esconder a janela"
echo "   6. Use 'Restaurar Janela' para trazer de volta"
echo ""
echo "💡 O ícone aparecerá automaticamente no próximo boot!"
