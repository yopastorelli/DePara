#!/bin/bash

# Script para corrigir exibição individual de discos
# Execute este script no Raspberry Pi

# Detectar usuário atual
CURRENT_USER=$(whoami)
USER_HOME="/home/$CURRENT_USER"
DEPARA_DIR="$USER_HOME/DePara"

echo "🔧 Corrigindo exibição individual de discos..."

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
echo "🎉 Correção aplicada com sucesso!"
echo ""
echo "📊 Melhorias implementadas:"
echo "   ✅ Filtro mais rigoroso para discos físicos reais"
echo "   ✅ Exibição individual de discos (não agrupados)"
echo "   ✅ Mostra primeiro disco + contador de outros"
echo "   ✅ Tooltip com detalhes de todos os discos"
echo ""
echo "🧪 Para testar:"
echo "   1. Abra o DePara: depara open"
echo "   2. Vá para a página Dashboard"
echo "   3. Verifique se mostra apenas discos físicos reais"
echo "   4. Passe o mouse para ver detalhes de cada disco"
echo ""
echo "💡 Formato esperado:"
echo "   - 1 disco: '526 GB / 2396 GB (/mnt/disco1)'"
echo "   - 2+ discos: '526 GB / 2396 GB (/mnt/disco1) +1'"
echo "   - Tooltip: Lista completa de todos os discos"
