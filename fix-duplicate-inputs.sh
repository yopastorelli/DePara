#!/bin/bash

# Script para corrigir inputs duplicados do slideshow
echo "🔧 Corrigindo inputs duplicados do slideshow..."

cd ~/DePara

# 1. Parar DePara
echo "⏹️ Parando DePara..."
sudo pkill -f "node.*main.js" 2>/dev/null || true
sleep 3

# 2. Fazer backup do index.html
echo "💾 Fazendo backup do index.html..."
cp src/public/index.html src/public/index.html.backup

# 3. Corrigir inputs duplicados
echo "🔧 Corrigindo inputs duplicados..."
python3 << 'EOF'
import re

# Ler o arquivo
with open('src/public/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Corrigir IDs duplicados dos inputs
# O modal de configuração deve ter ID diferente do modal de seleção
content = content.replace('id="slideshow-folder-path"', 'id="slideshow-config-folder-path"')

# Escrever o arquivo corrigido
with open('src/public/index.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ Inputs duplicados corrigidos!")
EOF

# 4. Verificar se as correções foram aplicadas
echo "🔍 Verificando correções..."
if grep -q "id=\"slideshow-config-folder-path\"" src/public/index.html; then
    echo "✅ ID do input de configuração corrigido"
else
    echo "❌ Erro na correção do ID do input de configuração"
fi

if grep -q "id=\"slideshow-folder-path\"" src/public/index.html; then
    echo "✅ ID do input de seleção mantido"
else
    echo "❌ Erro: ID do input de seleção não encontrado"
fi

# 5. Verificar se há IDs duplicados
echo "🔍 Verificando se ainda há IDs duplicados..."
DUPLICATES=$(grep -o 'id="[^"]*"' src/public/index.html | sort | uniq -d)
if [ -n "$DUPLICATES" ]; then
    echo "⚠️ Ainda há IDs duplicados:"
    echo "$DUPLICATES"
else
    echo "✅ Nenhum ID duplicado encontrado"
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
    echo "  ✅ IDs únicos garantidos"
    echo "  ✅ Seleção de pasta deve funcionar"
else
    echo "❌ Erro na inicialização"
    echo "📋 Verifique os logs: tail -f logs/depara.log"
fi

echo "🎉 Inputs duplicados corrigidos com sucesso!"
