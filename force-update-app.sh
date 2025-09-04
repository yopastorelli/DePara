#!/bin/bash

# Script para forçar atualização completa do DePara
# Execute este script no Raspberry Pi

# Detectar usuário atual
CURRENT_USER=$(whoami)
USER_HOME="/home/$CURRENT_USER"
DEPARA_DIR="$USER_HOME/DePara"

echo "🔄 Forçando atualização completa do DePara..."

# Navegar para o diretório do projeto
cd "$DEPARA_DIR" || {
    echo "❌ Erro: Não foi possível acessar $DEPARA_DIR"
    exit 1
}

# Parar DePara se estiver rodando
echo "⏹️ Parando DePara..."
if pgrep -f "node.*main.js" > /dev/null; then
    pkill -f "node.*main.js"
    sleep 3
fi

# Limpar cache do npm
echo "🧹 Limpando cache do npm..."
npm cache clean --force

# Reinstalar dependências
echo "📦 Reinstalando dependências..."
npm install

# Fazer pull forçado
echo "📥 Fazendo pull forçado..."
git fetch origin
git reset --hard origin/main

# Verificar se os arquivos foram atualizados
echo "🔍 Verificando arquivos atualizados..."
if [ -f "src/routes/tray.js" ]; then
    echo "✅ src/routes/tray.js encontrado"
else
    echo "❌ src/routes/tray.js não encontrado"
fi

if [ -f "src/public/index.html" ]; then
    if grep -q "tray-btn" src/public/index.html; then
        echo "✅ Botão de tray encontrado no HTML"
    else
        echo "❌ Botão de tray não encontrado no HTML"
    fi
else
    echo "❌ src/public/index.html não encontrado"
fi

# Tornar scripts executáveis
echo "🔧 Tornando scripts executáveis..."
chmod +x *.sh 2>/dev/null

# Iniciar DePara
echo "▶️ Iniciando DePara..."
nohup npm start > /dev/null 2>&1 &
sleep 5

# Verificar se DePara está rodando
if pgrep -f "node.*main.js" > /dev/null; then
    echo "✅ DePara iniciado com sucesso!"
    
    # Testar API de tray
    echo "🧪 Testando API de tray..."
    sleep 2
    curl -s http://localhost:3000/api/tray/status > /dev/null
    if [ $? -eq 0 ]; then
        echo "✅ API de tray funcionando"
    else
        echo "⚠️ API de tray pode não estar funcionando"
    fi
else
    echo "❌ DePara não iniciou corretamente"
    echo "📋 Logs de erro:"
    tail -20 logs/depara.log 2>/dev/null || echo "Logs não encontrados"
fi

echo ""
echo "🎉 Atualização forçada concluída!"
echo ""
echo "🧪 Para testar:"
echo "   1. Abra o DePara: depara open"
echo "   2. Verifique se há um botão de minimizar no header"
echo "   3. Clique no botão para testar o system tray"
echo ""
echo "🔍 Se ainda não funcionar:"
echo "   1. Verifique os logs: tail -f logs/depara.log"
echo "   2. Verifique se o arquivo HTML foi atualizado"
echo "   3. Limpe o cache do navegador (Ctrl+F5)"
