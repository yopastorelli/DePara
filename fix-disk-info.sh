#!/bin/bash

# Script para corrigir informações de disco
# Execute este script no Raspberry Pi

# Detectar usuário atual
CURRENT_USER=$(whoami)
USER_HOME="/home/$CURRENT_USER"
DEPARA_DIR="$USER_HOME/DePara"

echo "🔧 Corrigindo informações de disco..."

# Navegar para o diretório do projeto
cd "$DEPARA_DIR" || {
    echo "❌ Erro: Não foi possível acessar $DEPARA_DIR"
    exit 1
}

# Atualizar repositório
echo "📥 Atualizando repositório..."
git pull origin main || {
    echo "❌ Erro ao atualizar repositório"
    exit 1
}

# Reiniciar DePara se estiver rodando
echo "🔄 Reiniciando DePara..."
if pgrep -f "node.*main.js" > /dev/null; then
    echo "⏹️ Parando DePara..."
    pkill -f "node.*main.js"
    sleep 2
fi

echo "▶️ Iniciando DePara..."
nohup npm start > /dev/null 2>&1 &
sleep 3

# Verificar se DePara está rodando
if pgrep -f "node.*main.js" > /dev/null; then
    echo "✅ DePara reiniciado com sucesso!"
else
    echo "⚠️ DePara pode não ter iniciado corretamente"
fi

echo ""
echo "🎉 Correção concluída!"
echo ""
echo "🧪 Para testar:"
echo "   1. Abra o DePara: depara open"
echo "   2. Vá para a página Dashboard"
echo "   3. Verifique se as informações de disco estão corretas"
echo ""
echo "📊 Agora deve mostrar:"
echo "   - Uso de disco em GB (ex: 15 GB / 32 GB)"
echo "   - Número de discos se houver múltiplos"
echo "   - Sem mais 'NaN GB'"
