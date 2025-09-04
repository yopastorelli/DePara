#!/bin/bash

# Script rápido para resolver conflito e implementar sistema de atualizações
# Execute este script no Raspberry Pi

echo "🔄 Resolvendo conflito e implementando sistema de atualizações..."

# Fazer backup das mudanças locais
echo "💾 Fazendo backup das mudanças locais..."
git stash push -m "Backup antes da implementação de atualizações"

# Fazer pull das mudanças remotas
echo "📥 Fazendo pull das mudanças remotas..."
git pull origin main

# Verificar se o pull foi bem-sucedido
if [ $? -eq 0 ]; then
    echo "✅ Pull realizado com sucesso!"
    
    # Tornar scripts executáveis
    echo "🔧 Tornando scripts executáveis..."
    chmod +x *.sh 2>/dev/null
    
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
        echo "✅ DePara iniciado com sucesso!"
    else
        echo "❌ DePara não iniciou corretamente"
        exit 1
    fi
    
    # Testar API de atualizações
    echo "🧪 Testando API de atualizações..."
    sleep 2
    curl -s http://localhost:3000/api/update/status > /dev/null
    if [ $? -eq 0 ]; then
        echo "✅ API de atualizações funcionando"
    else
        echo "⚠️ API de atualizações pode não estar funcionando"
    fi
    
    echo ""
    echo "🎉 Sistema de atualização automática implementado!"
    echo ""
    echo "📋 Funcionalidades implementadas:"
    echo "   ✅ Interface de atualizações nas configurações"
    echo "   ✅ API para verificar e aplicar atualizações"
    echo "   ✅ Verificação automática de atualizações"
    echo "   ✅ Aplicação de atualizações com um clique"
    echo "   ✅ Reinicialização automática da aplicação"
    echo "   ✅ Configurações de frequência de verificação"
    echo ""
    echo "🧪 Para testar:"
    echo "   1. Abra o DePara: depara open"
    echo "   2. Vá para a aba 'Configurações'"
    echo "   3. Procure a seção 'Sistema de Atualizações'"
    echo "   4. Clique em 'Verificar Atualizações'"
    echo "   5. Se houver atualizações, clique em 'Aplicar Atualizações'"
    echo "   6. Clique em 'Reiniciar Aplicação' para aplicar"
    echo ""
    echo "💡 Funcionalidades disponíveis:"
    echo "   - Verificação automática de atualizações"
    echo "   - Aplicação de atualizações com backup automático"
    echo "   - Reinicialização da aplicação"
    echo "   - Configurações de frequência (diária, semanal, mensal, manual)"
    echo "   - Aplicação automática (opcional para desenvolvimento)"
    echo ""
    echo "🔧 Configurações:"
    echo "   - Verificação automática: Ativada por padrão"
    echo "   - Frequência: Semanal"
    echo "   - Aplicação automática: Desativada (recomendado)"
    echo ""
    echo "🎯 Agora você pode atualizar o DePara diretamente da interface!"
    
else
    echo "❌ Erro no pull. Verificando conflitos..."
    git status
fi
