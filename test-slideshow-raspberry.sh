#!/bin/bash

echo "🧪 TESTE ESPECÍFICO DO SLIDESHOW NO RASPBERRY PI"
echo "=============================================="

# Verificar se o código foi atualizado
echo "📥 Atualizando código..."
git pull origin main

# Verificar se o app.js tem as últimas correções
echo ""
echo "🔍 Verificando se as correções estão presentes..."
if grep -q "slideshow-image-new" src/public/app.js; then
    echo "✅ Correção de elemento dinâmico encontrada"
else
    echo "❌ Correção de elemento dinâmico NÃO encontrada"
fi

if grep -q "position: fixed" src/public/app.js; then
    echo "✅ Correção de posicionamento fixo encontrada"
else
    echo "❌ Correção de posicionamento fixo NÃO encontrada"
fi

# Reiniciar o serviço
echo ""
echo "🔄 Reiniciando serviço..."
sudo systemctl restart depara
sleep 5

# Verificar se o serviço está rodando
echo ""
echo "🔧 Verificando status do serviço..."
if sudo systemctl is-active --quiet depara; then
    echo "✅ Serviço está rodando"
else
    echo "❌ Serviço NÃO está rodando"
    sudo systemctl status depara --no-pager
    exit 1
fi

# Testar API de imagens
echo ""
echo "🧪 Testando API de listagem de imagens..."
API_RESPONSE=$(curl -s -X POST http://localhost:3000/api/files/list-images \
  -H "Content-Type: application/json" \
  -d '{
    "folderPath": "/mnt/lytspot/@SYNC@/_@@PICZ & VIDEOS LYT @@_/_@LYT PicZ por ANO@_",
    "extensions": [".jpg", ".jpeg", ".png", ".gif", ".bmp"],
    "recursive": true
  }')

if [ $? -eq 0 ]; then
    echo "✅ API respondeu com sucesso"
    IMAGE_COUNT=$(echo "$API_RESPONSE" | grep -o '"imageCount":[0-9]*' | grep -o '[0-9]*')
    echo "📸 Imagens encontradas: $IMAGE_COUNT"
else
    echo "❌ API não respondeu"
fi

# Verificar logs recentes
echo ""
echo "📋 Últimos logs do serviço:"
sudo journalctl -u depara --no-pager -n 10

echo ""
echo "🎯 TESTE CONCLUÍDO!"
echo "Agora teste o slideshow na interface web."
echo "Se ainda não funcionar, verifique os logs acima."
