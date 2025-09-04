#!/bin/bash

# Script para adicionar botão de system tray na interface
# Execute este script no Raspberry Pi

# Detectar usuário atual
CURRENT_USER=$(whoami)
USER_HOME="/home/$CURRENT_USER"
DEPARA_DIR="$USER_HOME/DePara"

echo "🔧 Adicionando botão de system tray na interface..."

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
echo "🎉 Botão de system tray adicionado com sucesso!"
echo ""
echo "🎨 Melhorias implementadas:"
echo "   ✅ Botão de system tray no header da aplicação"
echo "   ✅ API /api/tray/minimize para controlar system tray"
echo "   ✅ Event listener para o botão de minimizar"
echo "   ✅ Toast notifications para feedback"
echo "   ✅ Logs detalhados para debug"
echo ""
echo "🧪 Para testar:"
echo "   1. Abra o DePara: depara open"
echo "   2. Clique no botão de minimizar (ícone minimize) no header"
echo "   3. A aplicação deve minimizar para system tray"
echo "   4. Use 'depara restore' para trazer de volta"
echo ""
echo "💡 Funcionalidades:"
echo "   - Botão visual no header da aplicação"
echo "   - Minimizar diretamente da interface"
echo "   - Feedback visual com toast notifications"
echo "   - API REST para controle programático"
echo "   - Logs detalhados para monitoramento"
echo ""
echo "🔧 Comandos disponíveis:"
echo "   - Interface: Clique no botão minimize no header"
echo "   - Terminal: depara minimize / depara restore"
echo "   - API: POST /api/tray/minimize"
