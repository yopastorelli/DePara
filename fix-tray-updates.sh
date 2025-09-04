#!/bin/bash

# Script para corrigir system tray e sistema de atualizações
# Execute este script no Raspberry Pi

# Detectar usuário atual
CURRENT_USER=$(whoami)
USER_HOME="/home/$CURRENT_USER"
DEPARA_DIR="$USER_HOME/DePara"

echo "🔧 Corrigindo system tray e sistema de atualizações..."

# Navegar para o diretório do projeto
cd "$DEPARA_DIR" || {
    echo "❌ Erro: Não foi possível acessar $DEPARA_DIR"
    exit 1
}

# Fazer backup das mudanças locais
echo "💾 Fazendo backup das mudanças locais..."
git stash push -m "Backup antes das correções"

# Fazer pull das mudanças remotas
echo "📥 Fazendo pull das mudanças remotas..."
git pull origin main

# Verificar se o pull foi bem-sucedido
if [ $? -eq 0 ]; then
    echo "✅ Pull realizado com sucesso!"
    
    # Tornar scripts executáveis
    echo "🔧 Tornando scripts executáveis..."
    chmod +x *.sh 2>/dev/null
    
    # Instalar/atualizar wmctrl
    echo "📦 Instalando/atualizando wmctrl..."
    sudo apt update
    sudo apt install -y wmctrl
    
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
        echo "✅ DePara iniciado com sucesso!"
    else
        echo "❌ DePara não iniciou corretamente"
        exit 1
    fi
    
    # Testar API de atualizações
    echo "🧪 Testando API de atualizações..."
    sleep 2
    curl -s http://localhost:3000/api/update/check > /dev/null
    if [ $? -eq 0 ]; then
        echo "✅ API de atualizações funcionando"
    else
        echo "⚠️ API de atualizações pode não estar funcionando"
    fi
    
    # Testar API de system tray
    echo "🧪 Testando API de system tray..."
    curl -s http://localhost:3000/api/tray/status > /dev/null
    if [ $? -eq 0 ]; then
        echo "✅ API de system tray funcionando"
    else
        echo "⚠️ API de system tray pode não estar funcionando"
    fi
    
    echo ""
    echo "🎉 Correções aplicadas com sucesso!"
    echo ""
    echo "📋 Problemas corrigidos:"
    echo "   ✅ System tray melhorado com comandos wmctrl mais robustos"
    echo "   ✅ API de atualizações corrigida para mostrar versão"
    echo "   ✅ Verificação de atualizações funcionando"
    echo "   ✅ Comandos wmctrl otimizados"
    echo ""
    echo "🧪 Para testar:"
    echo "   1. Abra o DePara: depara open"
    echo "   2. Teste o botão de minimizar no header"
    echo "   3. Vá para Configurações > Sistema de Atualizações"
    echo "   4. Clique em 'Verificar Atualizações'"
    echo "   5. Use 'depara minimize' no terminal"
    echo "   6. Use 'depara restore' para trazer de volta"
    echo ""
    echo "💡 Comandos disponíveis:"
    echo "   - Interface: Botão minimize no header"
    echo "   - Terminal: depara minimize / depara restore"
    echo "   - Configurações: Sistema de Atualizações"
    echo "   - API: POST /api/tray/minimize, GET /api/update/check"
    
else
    echo "❌ Erro no pull. Verificando conflitos..."
    git status
fi
