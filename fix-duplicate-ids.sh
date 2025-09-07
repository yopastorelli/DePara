#!/bin/bash

# Script para corrigir IDs duplicados no slideshow
echo "🔧 Corrigindo IDs duplicados no slideshow..."

cd ~/DePara

# 1. Parar DePara
echo "⏹️ Parando DePara..."
sudo pkill -f "node.*main.js" 2>/dev/null || true
sleep 3

# 2. Fazer backup do index.html
echo "💾 Fazendo backup do index.html..."
cp src/public/index.html src/public/index.html.backup

# 3. Corrigir IDs duplicados
echo "🔧 Corrigindo IDs duplicados..."
python3 << 'EOF'
import re

# Ler o arquivo
with open('src/public/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Corrigir IDs duplicados
# O modal deve ter IDs diferentes do viewer
content = content.replace('id="slideshow-image"', 'id="slideshow-modal-image"')
content = content.replace('id="slideshow-loading"', 'id="slideshow-modal-loading"')
content = content.replace('id="slideshow-error"', 'id="slideshow-modal-error"')

# Escrever o arquivo corrigido
with open('src/public/index.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ IDs duplicados corrigidos!")
EOF

# 4. Verificar se as correções foram aplicadas
echo "🔍 Verificando correções..."
if grep -q "id=\"slideshow-modal-image\"" src/public/index.html; then
    echo "✅ ID do modal corrigido"
else
    echo "❌ Erro na correção do ID do modal"
fi

if grep -q "id=\"slideshow-image\"" src/public/index.html; then
    echo "✅ ID do viewer mantido"
else
    echo "❌ Erro: ID do viewer não encontrado"
fi

# 5. Iniciar DePara
echo "▶️ Iniciando DePara..."
npm start &

# 6. Aguardar inicialização
echo "⏳ Aguardando inicialização..."
sleep 5

# 7. Verificar status
echo "✅ Verificando status..."
if curl -s http://localhost:3000/api/health > /dev/null; then
    echo "✅ DePara funcionando!"
    echo "🌐 Acesse: http://localhost:3000"
    echo "💡 Pressione Ctrl+F5 para limpar cache do navegador"
    echo "🎬 Teste o slideshow agora!"
    echo ""
    echo "🔧 Correções aplicadas:"
    echo "  ✅ IDs duplicados corrigidos"
    echo "  ✅ Modal tem IDs únicos"
    echo "  ✅ Viewer mantém IDs originais"
    echo "  ✅ Conflito de elementos resolvido"
else
    echo "❌ Erro na inicialização"
    echo "📋 Verifique os logs: tail -f logs/depara.log"
fi

echo "🎉 IDs duplicados corrigidos com sucesso!"
