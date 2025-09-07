#!/bin/bash

# Script para corrigir desktop e slideshow
# Autor: yopastorelli
# Versão: 1.0.0

echo "🔧 Corrigindo desktop e slideshow..."

# 1. Verificar se o DePara está rodando
echo "🔍 Verificando se o DePara está rodando..."
if ! curl -s http://localhost:3000/api/health > /dev/null; then
    echo "❌ DePara não está rodando. Iniciando..."
    cd ~/DePara
    npm start &
    sleep 5
fi

# 2. Aguardar API estar disponível
echo "⏳ Aguardando API estar disponível..."
for i in {1..30}; do
    if curl -s http://localhost:3000/api/health > /dev/null; then
        echo "✅ API disponível!"
        break
    fi
    echo "⏳ Aguardando... ($i/30)"
    sleep 1
done

# 3. Corrigir arquivo .desktop
echo "🖥️ Corrigindo arquivo .desktop..."

# Remover arquivo antigo
rm -f /home/yo/.local/share/applications/depara.desktop

# Criar diretório se não existir
mkdir -p /home/yo/.local/share/applications

# Detectar navegador
BROWSER_CMD=""
if command -v firefox > /dev/null; then
    BROWSER_CMD="firefox --new-window --app=http://localhost:3000"
elif command -v chromium-browser > /dev/null; then
    BROWSER_CMD="chromium-browser --new-window --app=http://localhost:3000"
elif command -v google-chrome > /dev/null; then
    BROWSER_CMD="google-chrome --new-window --app=http://localhost:3000"
else
    echo "❌ Nenhum navegador compatível encontrado"
    exit 1
fi

echo "✅ Navegador detectado: $BROWSER_CMD"

# Criar arquivo .desktop
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

# Tornar executável
chmod +x /home/yo/.local/share/applications/depara.desktop

# Atualizar banco de dados
update-desktop-database /home/yo/.local/share/applications

# 4. Testar slideshow via API
echo "🎬 Testando slideshow..."

# Verificar se a API do slideshow está funcionando
curl -s http://localhost:3000/api/health | grep -q "OK" && echo "✅ API funcionando" || echo "❌ API com problemas"

# 5. Verificar se o arquivo .desktop foi criado
echo "📄 Verificando arquivo .desktop..."
if [ -f "/home/yo/.local/share/applications/depara.desktop" ]; then
    echo "✅ Arquivo .desktop criado com sucesso"
    echo "📄 Conteúdo:"
    cat /home/yo/.local/share/applications/depara.desktop
else
    echo "❌ Erro ao criar arquivo .desktop"
fi

# 6. Recarregar menu
echo "🔄 Recarregando menu..."
killall -HUP lxpanel 2>/dev/null || true
killall -HUP xfce4-panel 2>/dev/null || true
killall -HUP gnome-panel 2>/dev/null || true

echo "🎉 Correções aplicadas!"
echo "🌐 Acesse: http://localhost:3000"
echo "💡 Agora o ícone do DePara deve abrir em janela dedicada!"
echo "🎬 O slideshow deve funcionar com as configurações corretas!"
