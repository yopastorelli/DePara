#!/bin/bash

# Script rápido para resolver conflito e implementar system tray
# Execute este script no Raspberry Pi

echo "🔧 Resolvendo conflito e implementando system tray..."

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
    chmod +x *.sh 2>/dev/null
    
    # Instalar dependências
    echo "📦 Instalando dependências..."
    sudo apt update
    sudo apt install -y wmctrl python3-pip python3-gi python3-gi-cairo gir1.2-gtk-3.0 gir1.2-appindicator3-0.1
    
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
    fi
    
    # Executar script de criação do ícone de tray
    echo "🎨 Criando ícone de system tray..."
    if [ -f "create-tray-icon.sh" ]; then
        chmod +x create-tray-icon.sh
        ./create-tray-icon.sh
    else
        echo "⚠️ create-tray-icon.sh não encontrado"
    fi
    
    # Iniciar ícone de tray
    echo "🚀 Iniciando ícone de system tray..."
    if [ -f "tray_icon.py" ]; then
        nohup python3 tray_icon.py > /dev/null 2>&1 &
        sleep 2
        
        if pgrep -f "tray_icon.py" > /dev/null; then
            echo "✅ Ícone de system tray iniciado!"
        else
            echo "⚠️ Ícone de system tray pode não ter iniciado"
        fi
    else
        echo "⚠️ tray_icon.py não encontrado"
    fi
    
    echo ""
    echo "🎉 System tray implementado com sucesso!"
    echo ""
    echo "📋 Funcionalidades implementadas:"
    echo "   ✅ Minimizar para system tray (botão na interface + comando)"
    echo "   ✅ Ícone na bandeja do sistema com menu"
    echo "   ✅ Restaurar janela clicando no ícone"
    echo "   ✅ Autostart configurado"
    echo ""
    echo "🧪 Para testar:"
    echo "   1. Procure o ícone na bandeja do sistema (canto inferior direito)"
    echo "   2. Clique com botão direito no ícone para ver o menu"
    echo "   3. Use 'Abrir DePara' para abrir a aplicação"
    echo "   4. Use o botão minimize na interface ou 'depara minimize'"
    echo "   5. Use 'Restaurar Janela' no menu do ícone para trazer de volta"
    echo ""
    echo "💡 Comandos disponíveis:"
    echo "   - depara minimize - Minimizar para system tray"
    echo "   - depara restore - Restaurar do system tray"
    echo "   - depara open - Abrir DePara"
    echo "   - Interface: Botão minimize no header"
    echo "   - System tray: Menu do ícone na bandeja"
    
else
    echo "❌ Erro no pull. Verificando conflitos..."
    git status
fi
