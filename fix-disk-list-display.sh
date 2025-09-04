#!/bin/bash

# Script para melhorar exibição de lista de discos
# Execute este script no Raspberry Pi

# Detectar usuário atual
CURRENT_USER=$(whoami)
USER_HOME="/home/$CURRENT_USER"
DEPARA_DIR="$USER_HOME/DePara"

echo "🔧 Melhorando exibição de lista de discos..."

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

# Parar DePara se estiver rodando
echo "⏹️ Parando DePara..."
if pgrep -f "node.*main.js" > /dev/null; then
    pkill -f "node.*main.js"
    sleep 2
fi

# Iniciar DePara
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
echo "🎉 Exibição de discos melhorada!"
echo ""
echo "📊 Melhorias implementadas:"
echo "   ✅ Lista todos os discos visíveis (até 3)"
echo "   ✅ Formato: '34 GB / 440 GB (/) | 15 GB / 500 GB (/mnt/disco2)'"
echo "   ✅ Tooltip com todos os discos detectados"
echo "   ✅ Contador para discos adicionais (+2)"
echo "   ✅ Separador '|' entre discos"
echo ""
echo "🧪 Para testar:"
echo "   1. Abra o DePara: depara open"
echo "   2. Vá para a página Dashboard"
echo "   3. Verifique se mostra todos os discos na linha"
echo "   4. Passe o mouse para ver tooltip completo"
echo ""
echo "💡 Formato esperado:"
echo "   - 1 disco: '34 GB / 440 GB (/)'"
echo "   - 2 discos: '34 GB / 440 GB (/) | 15 GB / 500 GB (/mnt/disco2)'"
echo "   - 3+ discos: '34 GB / 440 GB (/) | 15 GB / 500 GB (/mnt/disco2) | 20 GB / 300 GB (/mnt/disco3) +1'"
