#!/bin/bash

# Script para configurar arquivo .desktop via API
# Autor: yopastorelli
# Versão: 1.0.0

echo "🔧 Configurando arquivo .desktop via API..."

# Verificar se o DePara está rodando
echo "🔍 Verificando se o DePara está rodando..."
if ! curl -s http://localhost:3000/api/health > /dev/null; then
    echo "❌ DePara não está rodando. Iniciando..."
    cd ~/DePara
    npm start &
    sleep 5
fi

# Aguardar API estar disponível
echo "⏳ Aguardando API estar disponível..."
for i in {1..30}; do
    if curl -s http://localhost:3000/api/health > /dev/null; then
        echo "✅ API disponível!"
        break
    fi
    echo "⏳ Aguardando... ($i/30)"
    sleep 1
done

# Verificar status atual do desktop
echo "🔍 Verificando status atual do desktop..."
curl -s http://localhost:3000/api/desktop/status | jq '.'

# Criar/atualizar arquivo .desktop
echo "🖥️ Criando arquivo .desktop..."
curl -X POST http://localhost:3000/api/desktop/create | jq '.'

# Verificar se foi criado
echo "✅ Verificando se foi criado..."
curl -s http://localhost:3000/api/desktop/status | jq '.'

echo "🎉 Configuração do desktop concluída!"
echo "🌐 Acesse: http://localhost:3000"
echo "💡 Agora o ícone do DePara deve abrir em janela dedicada!"
