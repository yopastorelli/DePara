#!/bin/bash

# Script para corrigir erro de sintaxe e reiniciar
echo "🔧 Corrigindo erro de sintaxe e reiniciando..."

cd ~/DePara

# 1. Parar DePara
echo "⏹️ Parando DePara..."
sudo pkill -f "node.*main.js" 2>/dev/null || true
sleep 3

# 2. Atualizar código
echo "📥 Atualizando código..."
git pull origin main

# 3. Verificar sintaxe
echo "🔍 Verificando sintaxe..."
if node -c src/public/app.js; then
    echo "✅ Sintaxe OK!"
else
    echo "❌ Erro de sintaxe encontrado"
    echo "🔄 Restaurando arquivo original..."
    git checkout HEAD -- src/public/app.js
fi

# 4. Limpar cache do navegador (se possível)
echo "🧹 Limpando cache do navegador..."
# Forçar reload sem cache
echo "💡 Pressione Ctrl+F5 no navegador para limpar cache"

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

echo "🎉 Correção e reinicialização concluída!"
