#!/bin/bash

# Script completo para implementar system tray funcional
# Execute este script no Raspberry Pi

# Detectar usuário atual
CURRENT_USER=$(whoami)
USER_HOME="/home/$CURRENT_USER"
DEPARA_DIR="$USER_HOME/DePara"

echo "🔧 Implementando system tray completo..."

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

# Instalar dependências
echo "📦 Instalando dependências..."
sudo apt update
sudo apt install -y wmctrl python3-pip python3-gi python3-gi-cairo gir1.2-gtk-3.0 gir1.2-appindicator3-0.1

# Parar DePara se estiver rodando
echo "⏹️ Parando DePara..."
if pgrep -f "node.*main.js" > /dev/null; then
    pkill -f "node.*main.js"
    sleep 2
fi

# Parar ícone de tray se estiver rodando
echo "⏹️ Parando ícone de tray..."
if pgrep -f "tray_icon.py" > /dev/null; then
    pkill -f "tray_icon.py"
    sleep 1
fi

# Tornar scripts executáveis
echo "🔧 Tornando scripts executáveis..."
chmod +x *.sh 2>/dev/null

# Iniciar DePara
echo "▶️ Iniciando DePara..."
nohup npm start > /dev/null 2>&1 &
sleep 3

# Verificar se DePara está rodando
if pgrep -f "node.*main.js" > /dev/null; then
    echo "✅ DePara iniciado com sucesso!"
else
    echo "❌ DePara não iniciou corretamente"
    exit 1
fi

# Executar script de criação do ícone de tray
echo "🎨 Criando ícone de system tray..."
chmod +x create-tray-icon.sh
./create-tray-icon.sh

# Iniciar ícone de tray
echo "🚀 Iniciando ícone de system tray..."
nohup python3 tray_icon.py > /dev/null 2>&1 &
sleep 2

# Verificar se ícone de tray está rodando
if pgrep -f "tray_icon.py" > /dev/null; then
    echo "✅ Ícone de system tray iniciado!"
else
    echo "⚠️ Ícone de system tray pode não ter iniciado"
fi

echo ""
echo "🎉 System tray implementado com sucesso!"
echo ""
echo "📋 Funcionalidades implementadas:"
echo "   ✅ Minimizar para system tray (botão na interface + comando)"
echo "   ✅ Ícone na bandeja do sistema com menu"
echo "   ✅ Restaurar janela clicando no ícone"
echo "   ✅ Autostart configurado"
echo "   ✅ Comandos melhorados com wmctrl"
echo ""
echo "🧪 Para testar:"
echo "   1. Procure o ícone na bandeja do sistema (canto inferior direito)"
echo "   2. Clique com botão direito no ícone para ver o menu"
echo "   3. Use 'Abrir DePara' para abrir a aplicação"
echo "   4. Use o botão minimize na interface ou 'depara minimize'"
echo "   5. Use 'Restaurar Janela' no menu do ícone para trazer de volta"
echo ""
echo "💡 Comandos disponíveis:"
echo "   - depara minimize - Minimizar para system tray"
echo "   - depara restore - Restaurar do system tray"
echo "   - depara open - Abrir DePara"
echo "   - Interface: Botão minimize no header"
echo "   - System tray: Menu do ícone na bandeja"
