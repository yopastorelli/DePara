#!/bin/bash

# Script para testar API de imagens diretamente
echo "🧪 Testando API de imagens diretamente..."

cd ~/DePara

# 1. Verificar se DePara está rodando
echo "🔍 Verificando se DePara está rodando..."
if ! curl -s http://localhost:3000/api/health > /dev/null; then
    echo "❌ DePara não está rodando. Iniciando..."
    npm start &
    sleep 5
fi

# 2. Testar API de listagem de imagens
echo "🧪 Testando API de listagem de imagens..."

# Testar com pasta /mnt
echo "📁 Testando pasta /mnt..."
curl -X POST http://localhost:3000/api/files/list-images \
  -H "Content-Type: application/json" \
  -d '{
    "folderPath": "/mnt",
    "extensions": [".jpg", ".jpeg", ".png", ".gif", ".bmp"],
    "recursive": true
  }' | jq '.' > /tmp/api-test-mnt.json

echo "📊 Resultado do teste /mnt:"
cat /tmp/api-test-mnt.json

# Testar com pasta específica
echo "📁 Testando pasta específica..."
curl -X POST http://localhost:3000/api/files/list-images \
  -H "Content-Type: application/json" \
  -d '{
    "folderPath": "/home/yo/Pictures",
    "extensions": [".jpg", ".jpeg", ".png", ".gif", ".bmp"],
    "recursive": true
  }' | jq '.' > /tmp/api-test-pictures.json

echo "📊 Resultado do teste /home/yo/Pictures:"
cat /tmp/api-test-pictures.json

# 3. Testar carregamento de uma imagem específica
echo "🖼️ Testando carregamento de imagem específica..."

# Pegar primeira imagem do resultado
FIRST_IMAGE=$(cat /tmp/api-test-mnt.json | jq -r '.data.images[0].path' 2>/dev/null)

if [ "$FIRST_IMAGE" != "null" ] && [ -n "$FIRST_IMAGE" ]; then
    echo "📸 Testando carregamento de: $FIRST_IMAGE"
    
    # Testar URL da imagem
    IMAGE_URL="http://localhost:3000/api/files/image/$(echo "$FIRST_IMAGE" | sed 's/"/\\"/g')"
    echo "🔗 URL da imagem: $IMAGE_URL"
    
    # Testar se a imagem carrega
    if curl -s -I "$IMAGE_URL" | grep -q "200 OK"; then
        echo "✅ Imagem carrega corretamente"
    else
        echo "❌ Erro ao carregar imagem"
        curl -s -I "$IMAGE_URL"
    fi
else
    echo "❌ Nenhuma imagem encontrada para testar"
fi

# 4. Verificar logs do DePara
echo "📋 Verificando logs do DePara..."
echo "📄 Últimas 20 linhas do log:"
tail -20 logs/depara.log 2>/dev/null || echo "❌ Log não encontrado"

echo "🎉 Teste da API concluído!"
echo "📊 Verifique os arquivos /tmp/api-test-*.json para detalhes"
