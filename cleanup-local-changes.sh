#!/bin/bash

# Script para limpar mudanças locais e organizar o repositório
# Execute este script no Raspberry Pi

echo "🧹 Limpando mudanças locais e organizando repositório..."

# Verificar status atual
echo "📊 Status atual do git:"
git status

# Adicionar arquivo não rastreado
echo "📁 Adicionando arquivo status-indicator.sh..."
git add status-indicator.sh

# Verificar mudanças nos arquivos modificados
echo "🔍 Verificando mudanças em start-depara.sh..."
git diff start-depara.sh

echo ""
echo "🔍 Verificando mudanças em fix-ui-tray.sh..."
git diff fix-ui-tray.sh

# Perguntar se quer manter as mudanças
echo ""
echo "❓ O que você quer fazer com as mudanças locais?"
echo "   1. Manter as mudanças (git add + git commit)"
echo "   2. Descartar as mudanças (git restore)"
echo "   3. Ver as mudanças primeiro"
echo ""
read -p "Escolha uma opção (1/2/3): " choice

case $choice in
    1)
        echo "💾 Mantendo as mudanças locais..."
        git add start-depara.sh fix-ui-tray.sh
        git commit -m "fix: Atualizações locais do Raspberry Pi

- Mudanças locais em start-depara.sh
- Mudanças locais em fix-ui-tray.sh
- Adicionado status-indicator.sh
- Organização do repositório local"
        echo "✅ Mudanças locais mantidas e commitadas"
        ;;
    2)
        echo "🗑️ Descartando mudanças locais..."
        git restore start-depara.sh fix-ui-tray.sh
        echo "✅ Mudanças locais descartadas"
        ;;
    3)
        echo "📋 Mudanças em start-depara.sh:"
        git diff start-depara.sh
        echo ""
        echo "📋 Mudanças em fix-ui-tray.sh:"
        git diff fix-ui-tray.sh
        echo ""
        echo "💡 Execute o script novamente para escolher uma opção"
        exit 0
        ;;
    *)
        echo "❌ Opção inválida"
        exit 1
        ;;
esac

# Verificar status final
echo ""
echo "📊 Status final do git:"
git status

echo ""
echo "🎉 Limpeza concluída!"
echo ""
echo "📋 Próximos passos:"
echo "   1. Testar o botão de system tray: depara open"
echo "   2. Clique no botão minimize no header"
echo "   3. Use 'depara restore' para trazer de volta"
