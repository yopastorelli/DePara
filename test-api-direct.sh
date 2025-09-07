#!/bin/bash

# Script para testar API diretamente
echo "🧪 Testando API diretamente..."

cd ~/DePara

# 1. Verificar se DePara está rodando
echo "🔍 Verificando se DePara está rodando..."
if ! curl -s http://localhost:3000/api/health > /dev/null; then
    echo "❌ DePara não está rodando. Iniciando..."
    npm start &
    sleep 5
fi

# 2. Testar API de listagem de imagens
echo "📡 Testando API de listagem de imagens..."
curl -X POST http://localhost:3000/api/files/list-images \
  -H "Content-Type: application/json" \
  -d '{
    "folderPath": "/mnt/lytspot/@SYNC@/_@@PICZ & VIDEOS LYT @@_/_@LYT PicZ por ANO@_",
    "extensions": [".jpg", ".jpeg", ".png", ".gif", ".bmp"],
    "recursive": true
  }' | jq '.' > api-test-result.json

echo "📊 Resultado da API salvo em api-test-result.json"

# 3. Verificar se a API retornou imagens
echo "🔍 Verificando se a API retornou imagens..."
if jq -e '.success == true and .images | length > 0' api-test-result.json > /dev/null; then
    echo "✅ API retornou imagens com sucesso!"
    echo "📊 Total de imagens: $(jq '.images | length' api-test-result.json)"
    echo "📋 Primeira imagem: $(jq -r '.images[0].path' api-test-result.json)"
else
    echo "❌ API não retornou imagens ou retornou erro"
    echo "📄 Resposta da API:"
    cat api-test-result.json
fi

# 4. Testar API de imagem específica
echo "🖼️ Testando API de imagem específica..."
FIRST_IMAGE=$(jq -r '.images[0].path' api-test-result.json 2>/dev/null)
if [ "$FIRST_IMAGE" != "null" ] && [ -n "$FIRST_IMAGE" ]; then
    echo "🔗 Testando URL: /api/files/image/$(echo "$FIRST_IMAGE" | sed 's/ /%20/g')"
    IMAGE_URL="/api/files/image/$(echo "$FIRST_IMAGE" | sed 's/ /%20/g')"
    
    if curl -s -I "http://localhost:3000$IMAGE_URL" | grep -q "200 OK"; then
        echo "✅ Imagem acessível via API!"
    else
        echo "❌ Imagem não acessível via API"
        echo "📄 Headers da resposta:"
        curl -s -I "http://localhost:3000$IMAGE_URL"
    fi
else
    echo "⚠️ Nenhuma imagem para testar"
fi

# 5. Verificar logs do DePara
echo "📋 Verificando logs do DePara..."
echo "📄 Últimas 10 linhas do log:"
tail -10 logs/depara.log 2>/dev/null || echo "❌ Log não encontrado"

echo "🎉 Teste da API concluído!"
