#!/bin/bash

# Script de teste para slideshow no Raspberry Pi
# Testa a API de listagem de imagens

echo "🍓 Testando API de slideshow no Raspberry Pi..."
echo "============================================================"

# URL da API (ajustar conforme necessário)
API_URL="http://localhost:3000/api/files/list-images"

# Caminho de teste (ajustar conforme o caminho real no Raspberry Pi)
TEST_PATH="/mnt/lytspot/@SYNC@/_@@PICZ & VIDEOS LYT @@_/_@LYT PicZ por ANO@_"

echo "🔗 URL da API: $API_URL"
echo "📁 Caminho de teste: $TEST_PATH"
echo ""

# Dados da requisição
BODY='{
  "folderPath": "'"$TEST_PATH"'",
  "extensions": [".jpg", ".jpeg", ".png", ".gif", ".bmp"],
  "recursive": true
}'

echo "📤 Enviando requisição..."
echo "📋 Dados: $BODY"
echo ""

# Fazer requisição para a API
RESPONSE=$(curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d "$BODY")

# Verificar se a requisição foi bem-sucedida
if [ $? -eq 0 ]; then
    echo "✅ Resposta recebida!"
    echo "📊 Resultado:"
    
    # Extrair informações da resposta JSON
    SUCCESS=$(echo "$RESPONSE" | jq -r '.success // false')
    IMAGE_COUNT=$(echo "$RESPONSE" | jq -r '.data.totalCount // 0')
    FOLDER_PATH=$(echo "$RESPONSE" | jq -r '.data.folderPath // "N/A"')
    
    echo "   - Sucesso: $SUCCESS"
    echo "   - Total de imagens: $IMAGE_COUNT"
    echo "   - Caminho processado: $FOLDER_PATH"
    
    if [ "$IMAGE_COUNT" -gt 0 ]; then
        echo "📸 Primeiras imagens encontradas:"
        echo "$RESPONSE" | jq -r '.data.images[0:5][] | "   - \(.name) (\(.extension), \(.size) bytes)"'
    else
        echo "⚠️  Nenhuma imagem encontrada!"
        echo "🔍 Verifique se o caminho existe e contém imagens"
    fi
else
    echo "❌ Erro na requisição:"
    echo "   - Código de saída: $?"
    echo "   - Resposta: $RESPONSE"
fi

echo ""
echo "🏁 Teste concluído!"
