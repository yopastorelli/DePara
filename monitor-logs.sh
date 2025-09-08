#!/bin/bash

# Script para monitorar logs do DePara em tempo real
# Mostra logs relacionados ao slideshow

echo "🔍 Monitorando logs do DePara..."
echo "📁 Caminho do log: logs/app.log"
echo "⏹️  Pressione Ctrl+C para parar"
echo "============================================================"

# Verificar se o arquivo de log existe
if [ -f "logs/app.log" ]; then
    # Usar tail -f para monitorar em tempo real
    tail -f logs/app.log | grep -i "slideshow\|list-images\|imagem\|image\|📸\|🔍\|📁\|📄\|✅\|❌"
else
    echo "❌ Arquivo de log não encontrado: logs/app.log"
    echo "🔧 Criando diretório de logs..."
    mkdir -p logs
    echo "✅ Diretório criado. Execute o servidor novamente."
fi
