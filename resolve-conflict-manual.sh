#!/bin/bash

# Script manual para resolver conflito do git pull
# Execute este script no Raspberry Pi

echo "🔧 Resolvendo conflito do git pull manualmente..."

# Verificar status atual
echo "📊 Verificando status do git..."
git status

# Fazer backup das mudanças locais
echo "💾 Fazendo backup das mudanças locais..."
git stash push -m "Backup mudanças locais antes do pull"

# Fazer pull das mudanças remotas
echo "📥 Fazendo pull das mudanças remotas..."
git pull origin main

# Verificar se o pull foi bem-sucedido
if [ $? -eq 0 ]; then
    echo "✅ Pull realizado com sucesso!"
    
    # Tornar scripts executáveis
    echo "🔧 Tornando scripts executáveis..."
    chmod +x fix-ui-tray.sh 2>/dev/null || echo "⚠️ fix-ui-tray.sh não encontrado"
    chmod +x start-depara.sh 2>/dev/null || echo "⚠️ start-depara.sh não encontrado"
    chmod +x fix-git-conflict.sh 2>/dev/null || echo "⚠️ fix-git-conflict.sh não encontrado"
    
    echo ""
    echo "🎉 Conflito resolvido com sucesso!"
    echo ""
    echo "📋 Próximos passos:"
    echo "   1. Verifique se as mudanças locais são importantes:"
    echo "      git stash show -p"
    echo ""
    echo "   2. Se as mudanças são importantes, aplique-as:"
    echo "      git stash pop"
    echo ""
    echo "   3. Se quiser descartar as mudanças locais:"
    echo "      git stash drop"
    echo ""
    echo "   4. Aplicar mudanças do system tray:"
    echo "      ./fix-ui-tray.sh"
else
    echo "❌ Erro no pull. Verificando conflitos..."
    git status
fi
