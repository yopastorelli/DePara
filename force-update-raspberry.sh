#!/bin/bash

echo "🔄 FORÇANDO ATUALIZAÇÃO COMPLETA NO RASPBERRY PI"
echo "=============================================="

# Parar o serviço
echo "⏹️ Parando serviço..."
sudo systemctl stop depara

# Fazer backup do código atual
echo "💾 Fazendo backup..."
cp -r . ../backup-$(date +%Y%m%d-%H%M%S)

# Limpar cache do git
echo "🧹 Limpando cache do Git..."
git clean -fd
git reset --hard HEAD

# Forçar pull
echo "📥 Forçando atualização do Git..."
git fetch --all
git reset --hard origin/main
git pull origin main --force

# Verificar se as correções estão presentes
echo ""
echo "🔍 Verificando se as correções estão presentes..."

if grep -q "Debug Raspberry Pi" src/public/app.js; then
    echo "✅ Logs de debug do Raspberry Pi encontrados"
else
    echo "❌ Logs de debug do Raspberry Pi NÃO encontrados"
fi

if grep -q "slideshow-image-new" src/public/app.js; then
    echo "✅ Elemento dinâmico encontrado"
else
    echo "❌ Elemento dinâmico NÃO encontrado"
fi

if grep -q "position: fixed" src/public/app.js; then
    echo "✅ Posicionamento fixo encontrado"
else
    echo "❌ Posicionamento fixo NÃO encontrado"
fi

# Verificar timestamp do arquivo
echo ""
echo "📄 Timestamp do app.js:"
ls -la src/public/app.js

# Reinstalar dependências
echo ""
echo "📦 Reinstalando dependências..."
npm install

# Reiniciar serviço
echo ""
echo "🚀 Reiniciando serviço..."
sudo systemctl start depara
sleep 3

# Verificar status
echo ""
echo "🔧 Verificando status do serviço..."
sudo systemctl status depara --no-pager

# Verificar logs
echo ""
echo "📋 Últimos logs:"
sudo journalctl -u depara --no-pager -n 10

echo ""
echo "✅ ATUALIZAÇÃO FORÇADA CONCLUÍDA!"
echo "Agora teste o slideshow e procure pelos logs com emoji 🍓"
