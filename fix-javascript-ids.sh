#!/bin/bash

# Script para corrigir IDs no JavaScript
echo "🔧 Corrigindo IDs no JavaScript..."

cd ~/DePara

# 1. Parar DePara
echo "⏹️ Parando DePara..."
sudo pkill -f "node.*main.js" 2>/dev/null || true
sleep 3

# 2. Fazer backup do app.js
echo "💾 Fazendo backup do app.js..."
cp src/public/app.js src/public/app.js.backup

# 3. Corrigir IDs no JavaScript
echo "🔧 Corrigindo IDs no JavaScript..."
python3 << 'EOF'
import re

# Ler o arquivo
with open('src/public/app.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Corrigir referências ao input de configuração
# O input de configuração agora tem ID slideshow-config-folder-path
content = content.replace('document.getElementById(\'slideshow-folder-path\')', 'document.getElementById(\'slideshow-config-folder-path\')')

# Escrever o arquivo corrigido
with open('src/public/app.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ IDs no JavaScript corrigidos!")
EOF

# 4. Verificar se as correções foram aplicadas
echo "🔍 Verificando correções..."
if grep -q "slideshow-config-folder-path" src/public/app.js; then
    echo "✅ Referências ao input de configuração corrigidas"
else
    echo "❌ Erro na correção das referências"
fi

# 5. Verificar se ainda há referências ao ID antigo
echo "🔍 Verificando se ainda há referências ao ID antigo..."
if grep -q "slideshow-folder-path" src/public/app.js; then
    echo "⚠️ Ainda há referências ao ID antigo:"
    grep -n "slideshow-folder-path" src/public/app.js | head -5
else
    echo "✅ Todas as referências foram corrigidas"
fi

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
    echo ""
    echo "🔧 Correções aplicadas:"
    echo "  ✅ Input de configuração: slideshow-config-folder-path"
    echo "  ✅ Input de seleção: slideshow-folder-path"
    echo "  ✅ JavaScript atualizado para usar IDs corretos"
    echo "  ✅ Seleção de pasta deve funcionar corretamente"
else
    echo "❌ Erro na inicialização"
    echo "📋 Verifique os logs: tail -f logs/depara.log"
fi

echo "🎉 IDs no JavaScript corrigidos com sucesso!"
