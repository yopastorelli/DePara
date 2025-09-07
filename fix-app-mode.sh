#!/bin/bash

# Script para corrigir modo aplicativo
# Autor: yopastorelli
# Versão: 1.0.0

echo "🔧 Corrigindo modo aplicativo..."

# 1. Parar processos do DePara
echo "🛑 Parando processos do DePara..."
pkill -f "node.*main.js" 2>/dev/null || true
pkill -f "npm.*start" 2>/dev/null || true
sleep 2

# 2. Iniciar DePara
echo "🚀 Iniciando DePara..."
cd ~/DePara
npm start &
sleep 5

# 3. Aguardar API
echo "⏳ Aguardando API..."
for i in {1..30}; do
    if curl -s http://localhost:3000/api/health > /dev/null; then
        echo "✅ API disponível!"
        break
    fi
    echo "⏳ Aguardando... ($i/30)"
    sleep 1
done

# 4. Remover arquivo .desktop antigo
rm -f /home/yo/.local/share/applications/depara.desktop

# 5. Criar diretório
mkdir -p /home/yo/.local/share/applications

# 6. Detectar navegador e criar comando correto
echo "🔍 Detectando navegador..."

if command -v firefox > /dev/null; then
    # Firefox com modo aplicativo
    BROWSER_CMD="firefox --new-window --kiosk http://localhost:3000"
    echo "✅ Firefox detectado - usando modo kiosk"
elif command -v chromium-browser > /dev/null; then
    # Chromium com modo aplicativo
    BROWSER_CMD="chromium-browser --new-window --app=http://localhost:3000 --disable-web-security --disable-features=VizDisplayCompositor"
    echo "✅ Chromium detectado - usando modo app"
elif command -v google-chrome > /dev/null; then
    # Chrome com modo aplicativo
    BROWSER_CMD="google-chrome --new-window --app=http://localhost:3000 --disable-web-security --disable-features=VizDisplayCompositor"
    echo "✅ Chrome detectado - usando modo app"
else
    echo "❌ Nenhum navegador compatível encontrado"
    exit 1
fi

# 7. Criar arquivo .desktop
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

# 8. Tornar executável
chmod +x /home/yo/.local/share/applications/depara.desktop

# 9. Atualizar banco de dados
update-desktop-database /home/yo/.local/share/applications

# 10. Verificar arquivo
echo "✅ Verificando arquivo .desktop..."
if [ -f "/home/yo/.local/share/applications/depara.desktop" ]; then
    echo "✅ Arquivo .desktop criado com sucesso"
    echo "📄 Conteúdo:"
    cat /home/yo/.local/share/applications/depara.desktop
else
    echo "❌ Erro ao criar arquivo .desktop"
fi

# 11. Recarregar menu
killall -HUP lxpanel 2>/dev/null || true
killall -HUP xfce4-panel 2>/dev/null || true
killall -HUP gnome-panel 2>/dev/null || true

echo "🎉 Modo aplicativo configurado!"
echo "🌐 Acesse: http://localhost:3000"
echo "💡 Agora teste clicando no ícone do DePara no menu!"
