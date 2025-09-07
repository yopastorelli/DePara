#!/bin/bash

# Script para resolver conflito de merge final
echo "🔧 Resolvendo conflito de merge final..."

cd ~/DePara

# 1. Parar DePara
echo "⏹️ Parando DePara..."
sudo pkill -f "node.*main.js" 2>/dev/null || true
sleep 3

# 2. Fazer stash das mudanças locais
echo "💾 Fazendo stash das mudanças locais..."
git stash push -m "Mudanças locais antes do merge final"

# 3. Fazer pull
echo "📥 Fazendo pull..."
git pull origin main

# 4. Verificar se DePara está funcionando
echo "🔍 Verificando se DePara está funcionando..."
if curl -s http://localhost:3000/api/health > /dev/null; then
    echo "✅ DePara já está funcionando!"
    echo "🌐 Acesse: http://localhost:3000"
    echo "💡 Pressione Ctrl+F5 para limpar cache do navegador"
    exit 0
fi

# 5. Instalar dependências
echo "📦 Instalando dependências..."
npm install

# 6. Iniciar DePara
echo "▶️ Iniciando DePara..."
npm start &

# 7. Aguardar inicialização
echo "⏳ Aguardando inicialização..."
sleep 5

# 8. Verificar status
echo "✅ Verificando status..."
if curl -s http://localhost:3000/api/health > /dev/null; then
    echo "✅ DePara funcionando!"
    echo "🌐 Acesse: http://localhost:3000"
    echo "💡 Pressione Ctrl+F5 para limpar cache do navegador"
    echo "🎬 Teste o slideshow agora!"
else
    echo "❌ Erro na inicialização"
    echo "📋 Verifique os logs: tail -f logs/depara.log"
fi

echo "🎉 Conflito de merge resolvido!"
