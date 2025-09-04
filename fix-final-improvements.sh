#!/bin/bash

# Script para correções finais do DePara
# Execute este script no Raspberry Pi

# Detectar usuário atual
CURRENT_USER=$(whoami)
USER_HOME="/home/$CURRENT_USER"
DEPARA_DIR="$USER_HOME/DePara"

echo "🔧 Aplicando correções finais do DePara..."

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
echo "🎉 Correções aplicadas com sucesso!"
echo ""
echo "📊 Melhorias implementadas:"
echo "   ✅ Filtro de discos reais (sem tmpfs, devtmpfs, etc.)"
echo "   ✅ Tooltip com detalhes por disco ao passar o mouse"
echo "   ✅ Atividades recentes funcionando"
echo "   ✅ Exibição correta de múltiplos discos"
echo ""
echo "🧪 Para testar:"
echo "   1. Abra o DePara: depara open"
echo "   2. Vá para a página Dashboard"
echo "   3. Verifique as informações de disco (deve mostrar apenas discos reais)"
echo "   4. Passe o mouse sobre o uso de disco para ver detalhes por disco"
echo "   5. Verifique se as atividades recentes aparecem"
echo ""
echo "💡 Funcionalidades:"
echo "   - Discos: Mostra apenas discos reais (não partições temporárias)"
echo "   - Tooltip: Detalhes por disco ao passar o mouse"
echo "   - Atividades: Histórico das últimas operações"
echo "   - Múltiplos discos: Soma total com contador"
