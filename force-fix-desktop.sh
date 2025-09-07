#!/bin/bash

# Script para forçar correção do desktop
# Autor: yopastorelli
# Versão: 1.0.0

echo "🔧 Forçando correção do desktop..."

# 1. Parar todos os processos do DePara
echo "🛑 Parando processos do DePara..."
pkill -f "node.*main.js" 2>/dev/null || true
pkill -f "npm.*start" 2>/dev/null || true

# 2. Aguardar um pouco
sleep 2

# 3. Iniciar DePara
echo "🚀 Iniciando DePara..."
cd ~/DePara
npm start &
sleep 5

# 4. Aguardar API estar disponível
echo "⏳ Aguardando API estar disponível..."
for i in {1..30}; do
    if curl -s http://localhost:3000/api/health > /dev/null; then
        echo "✅ API disponível!"
        break
    fi
    echo "⏳ Aguardando... ($i/30)"
    sleep 1
done

# 5. Remover arquivo .desktop antigo
echo "🗑️ Removendo arquivo .desktop antigo..."
rm -f /home/yo/.local/share/applications/depara.desktop

# 6. Criar diretório se não existir
mkdir -p /home/yo/.local/share/applications

# 7. Detectar navegador e criar arquivo .desktop
echo "🔍 Detectando navegador..."

if command -v firefox > /dev/null; then
    BROWSER_CMD="firefox --new-window --app=http://localhost:3000"
    echo "✅ Firefox detectado"
elif command -v chromium-browser > /dev/null; then
    BROWSER_CMD="chromium-browser --new-window --app=http://localhost:3000"
    echo "✅ Chromium detectado"
elif command -v google-chrome > /dev/null; then
    BROWSER_CMD="google-chrome --new-window --app=http://localhost:3000"
    echo "✅ Chrome detectado"
else
    echo "❌ Nenhum navegador compatível encontrado"
    exit 1
fi

# 8. Criar arquivo .desktop
echo "📝 Criando arquivo .desktop..."
cat > /home/yo/.local/share/applications/depara.desktop << EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=DePara
Comment=DePara - Sistema de Sincronização de Arquivos
Exec=$BROWSER_CMD
Icon=/home/yo/DePara/src/public/logos/depara_logo_icon.svg
Terminal=false
StartupNotify=true
Categories=Utility;FileTools;
Keywords=files;sync;backup;
StartupWMClass=DePara
NoDisplay=false
Hidden=false
EOF

# 9. Tornar executável
chmod +x /home/yo/.local/share/applications/depara.desktop

# 10. Atualizar banco de dados
echo "🔄 Atualizando banco de dados..."
update-desktop-database /home/yo/.local/share/applications

# 11. Verificar se foi criado
echo "✅ Verificando arquivo .desktop..."
if [ -f "/home/yo/.local/share/applications/depara.desktop" ]; then
    echo "✅ Arquivo .desktop criado com sucesso"
    echo "📄 Conteúdo:"
    cat /home/yo/.local/share/applications/depara.desktop
else
    echo "❌ Erro ao criar arquivo .desktop"
fi

# 12. Recarregar menu
echo "🔄 Recarregando menu..."
killall -HUP lxpanel 2>/dev/null || true
killall -HUP xfce4-panel 2>/dev/null || true
killall -HUP gnome-panel 2>/dev/null || true

echo "🎉 Correção forçada concluída!"
echo "🌐 Acesse: http://localhost:3000"
echo "💡 Agora teste clicando no ícone do DePara no menu!"
