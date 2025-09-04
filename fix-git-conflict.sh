#!/bin/bash

# Script para resolver conflito do git pull
# Execute este script no Raspberry Pi

# Detectar usuário atual
CURRENT_USER=$(whoami)
USER_HOME="/home/$CURRENT_USER"
DEPARA_DIR="$USER_HOME/DePara"

echo "🔧 Resolvendo conflito do git pull..."

# Navegar para o diretório do projeto
cd "$DEPARA_DIR" || {
    echo "❌ Erro: Não foi possível acessar $DEPARA_DIR"
    exit 1
}

# Verificar status atual
echo "📊 Verificando status do git..."
git status

# Fazer backup das mudanças locais
echo "💾 Fazendo backup das mudanças locais..."
git stash push -m "Backup mudanças locais antes do pull"

# Fazer pull das mudanças remotas
echo "📥 Fazendo pull das mudanças remotas..."
git pull origin main

# Aplicar mudanças locais se necessário
echo "🔄 Verificando se há mudanças para aplicar..."
if git stash list | grep -q "Backup mudanças locais"; then
    echo "⚠️ Há mudanças locais em stash. Verificando se são compatíveis..."
    git stash show -p
    echo ""
    echo "💡 Se as mudanças locais são importantes, execute:"
    echo "   git stash pop"
    echo ""
    echo "💡 Se quiser descartar as mudanças locais, execute:"
    echo "   git stash drop"
fi

# Tornar scripts executáveis
echo "🔧 Tornando scripts executáveis..."
chmod +x fix-ui-tray.sh 2>/dev/null || echo "⚠️ fix-ui-tray.sh não encontrado"
chmod +x start-depara.sh 2>/dev/null || echo "⚠️ start-depara.sh não encontrado"

echo ""
echo "✅ Conflito resolvido com sucesso!"
echo ""
echo "📋 Próximos passos:"
echo "   1. Verifique se as mudanças locais são importantes"
echo "   2. Se sim: git stash pop"
echo "   3. Se não: git stash drop"
echo "   4. Execute: ./fix-ui-tray.sh"
echo ""
echo "🔍 Para ver as mudanças em stash:"
echo "   git stash show -p"
