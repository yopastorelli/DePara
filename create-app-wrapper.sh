#!/bin/bash

# Script para criar wrapper de aplicativo
# Autor: yopastorelli
# Versão: 1.0.0

echo "🔧 Criando wrapper de aplicativo..."

# 1. Criar script wrapper
echo "📝 Criando script wrapper..."
cat > /home/yo/DePara/start-depara-app.sh << 'EOF'
#!/bin/bash

# Script para iniciar DePara como aplicativo
# Autor: yopastorelli
# Versão: 1.0.0

# Verificar se o DePara está rodando
if ! curl -s http://localhost:3000/api/health > /dev/null; then
    echo "🚀 Iniciando DePara..."
    cd /home/yo/DePara
    npm start &
    sleep 5
fi

# Aguardar API estar disponível
echo "⏳ Aguardando API estar disponível..."
for i in {1..30}; do
    if curl -s http://localhost:3000/api/health > /dev/null; then
        echo "✅ API disponível!"
        break
    fi
    echo "⏳ Aguardando... ($i/30)"
    sleep 1
done

# Detectar navegador e abrir como aplicativo
if command -v firefox > /dev/null; then
    echo "🦊 Abrindo com Firefox em modo aplicativo..."
    firefox --new-window --kiosk http://localhost:3000
elif command -v chromium-browser > /dev/null; then
    echo "🌐 Abrindo com Chromium em modo aplicativo..."
    chromium-browser --new-window --app=http://localhost:3000 --disable-web-security --disable-features=VizDisplayCompositor
elif command -v google-chrome > /dev/null; then
    echo "🌐 Abrindo com Chrome em modo aplicativo..."
    google-chrome --new-window --app=http://localhost:3000 --disable-web-security --disable-features=VizDisplayCompositor
else
    echo "❌ Nenhum navegador compatível encontrado"
    exit 1
fi
EOF

# 2. Tornar executável
chmod +x /home/yo/DePara/start-depara-app.sh

# 3. Remover arquivo .desktop antigo
rm -f /home/yo/.local/share/applications/depara.desktop

# 4. Criar diretório
mkdir -p /home/yo/.local/share/applications

# 5. Criar arquivo .desktop que usa o wrapper
echo "📝 Criando arquivo .desktop..."
cat > /home/yo/.local/share/applications/depara.desktop << EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=DePara
Comment=DePara - Sistema de Sincronização de Arquivos
Exec=/home/yo/DePara/start-depara-app.sh
Icon=/home/yo/DePara/src/public/logos/depara_logo_icon.svg
Terminal=false
StartupNotify=true
Categories=Utility;FileTools;
Keywords=files;sync;backup;
StartupWMClass=DePara
NoDisplay=false
Hidden=false
EOF

# 6. Tornar executável
chmod +x /home/yo/.local/share/applications/depara.desktop

# 7. Atualizar banco de dados
update-desktop-database /home/yo/.local/share/applications

# 8. Verificar arquivo
echo "✅ Verificando arquivo .desktop..."
if [ -f "/home/yo/.local/share/applications/depara.desktop" ]; then
    echo "✅ Arquivo .desktop criado com sucesso"
    echo "📄 Conteúdo:"
    cat /home/yo/.local/share/applications/depara.desktop
else
    echo "❌ Erro ao criar arquivo .desktop"
fi

# 9. Recarregar menu
killall -HUP lxpanel 2>/dev/null || true
killall -HUP xfce4-panel 2>/dev/null || true
killall -HUP gnome-panel 2>/dev/null || true

echo "🎉 Wrapper de aplicativo criado!"
echo "🌐 Acesse: http://localhost:3000"
echo "💡 Agora teste clicando no ícone do DePara no menu!"
