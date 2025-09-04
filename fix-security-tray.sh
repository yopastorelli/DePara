#!/bin/bash

# Script para corrigir segurança e adicionar system tray
# Execute este script no Raspberry Pi

# Detectar usuário atual
CURRENT_USER=$(whoami)
USER_HOME="/home/$CURRENT_USER"
DEPARA_DIR="$USER_HOME/DePara"

echo "🔧 Corrigindo segurança e adicionando system tray..."

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

# Instalar wmctrl para system tray
echo "📦 Instalando wmctrl para system tray..."
sudo apt update && sudo apt install -y wmctrl

# Parar DePara se estiver rodando
echo "⏹️ Parando DePara..."
if pgrep -f "node.*main.js" > /dev/null; then
    pkill -f "node.*main.js"
    sleep 2
fi

# Iniciar DePara
echo "▶️ Iniciando DePara..."
nohup npm start > /dev/null 2>&1 &
sleep 3

# Verificar se DePara está rodando
if pgrep -f "node.*main.js" > /dev/null; then
    echo "✅ DePara reiniciado com sucesso!"
else
    echo "⚠️ DePara pode não ter iniciado corretamente"
fi

echo ""
echo "🎉 Correções aplicadas com sucesso!"
echo ""
echo "🔒 Problemas de segurança corrigidos:"
echo "   ✅ Removido --disable-web-security (flag insegura)"
echo "   ✅ Adicionado --disable-extensions para melhor segurança"
echo "   ✅ Mantido --user-data-dir para isolamento"
echo ""
echo "📱 System tray implementado:"
echo "   ✅ depara minimize - Minimizar para system tray"
echo "   ✅ depara restore - Restaurar do system tray"
echo "   ✅ wmctrl instalado para controle de janelas"
echo ""
echo "🧪 Para testar:"
echo "   1. Abra o DePara: depara open"
echo "   2. Minimize para tray: depara minimize"
echo "   3. Restaure do tray: depara restore"
echo ""
echo "💡 Comandos disponíveis:"
echo "   - depara start - Iniciar DePara"
echo "   - depara open - Abrir no navegador (sem avisos de segurança)"
echo "   - depara minimize - Minimizar para system tray"
echo "   - depara restore - Restaurar do system tray"
echo "   - depara status - Ver status"
echo "   - depara stop - Parar DePara"
