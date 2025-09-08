#!/bin/bash

echo "🔍 VERIFICAÇÃO DO CÓDIGO NO RASPBERRY PI"
echo "======================================="

# Verificar se estamos no diretório correto
echo "📁 Diretório atual: $(pwd)"

# Verificar se o arquivo app.js existe
if [ -f "src/public/app.js" ]; then
    echo "✅ Arquivo app.js encontrado"
else
    echo "❌ Arquivo app.js NÃO encontrado"
    exit 1
fi

# Verificar timestamp
echo ""
echo "📄 Informações do arquivo app.js:"
ls -la src/public/app.js

# Verificar se as correções estão presentes
echo ""
echo "🔍 Verificando correções específicas..."

# Verificar logs de debug do Raspberry Pi
if grep -q "🍓 Debug Raspberry Pi" src/public/app.js; then
    echo "✅ Logs de debug do Raspberry Pi encontrados"
    echo "   Linhas encontradas: $(grep -c "🍓 Debug Raspberry Pi" src/public/app.js)"
else
    echo "❌ Logs de debug do Raspberry Pi NÃO encontrados"
fi

# Verificar elemento dinâmico
if grep -q "slideshow-image-new" src/public/app.js; then
    echo "✅ Elemento slideshow-image-new encontrado"
    echo "   Linhas encontradas: $(grep -c "slideshow-image-new" src/public/app.js)"
else
    echo "❌ Elemento slideshow-image-new NÃO encontrado"
fi

# Verificar posicionamento fixo
if grep -q "position: fixed" src/public/app.js; then
    echo "✅ Posicionamento fixo encontrado"
else
    echo "❌ Posicionamento fixo NÃO encontrado"
fi

# Verificar solução de emergência
if grep -q "Solução de emergência" src/public/app.js; then
    echo "✅ Solução de emergência encontrada"
else
    echo "❌ Solução de emergência NÃO encontrada"
fi

# Verificar aplicação individual de estilos
if grep -q "newImageElement.style.display = 'block'" src/public/app.js; then
    echo "✅ Aplicação individual de estilos encontrada"
else
    echo "❌ Aplicação individual de estilos NÃO encontrada"
fi

# Mostrar algumas linhas relevantes
echo ""
echo "📋 Linhas relevantes encontradas:"
echo "--------------------------------"
grep -n "🍓 Debug Raspberry Pi" src/public/app.js | head -3
grep -n "slideshow-image-new" src/public/app.js | head -3
grep -n "position: fixed" src/public/app.js | head -3

# Verificar se há erros de sintaxe
echo ""
echo "🔍 Verificando sintaxe JavaScript..."
if node -c src/public/app.js; then
    echo "✅ Sintaxe JavaScript OK"
else
    echo "❌ Erro de sintaxe JavaScript"
fi

echo ""
echo "🎯 VERIFICAÇÃO CONCLUÍDA!"
echo "Se alguma correção não foi encontrada, execute o script de atualização forçada."
