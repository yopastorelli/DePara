#!/bin/bash

# Script para criar aplicativo Electron
# Autor: yopastorelli
# Versão: 1.0.0

echo "🔧 Criando aplicativo Electron..."

# 1. Verificar se Electron está instalado
if ! command -v electron > /dev/null; then
    echo "📦 Instalando Electron..."
    cd ~/DePara
    npm install electron --save-dev
fi

# 2. Criar arquivo main.js do Electron
echo "📝 Criando main.js do Electron..."
cat > /home/yo/DePara/electron-main.js << 'EOF'
const { app, BrowserWindow } = require('electron');
const { exec } = require('child_process');

let mainWindow;

function createWindow() {
    // Criar janela do navegador
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        },
        icon: '/home/yo/DePara/src/public/logos/depara_logo_icon.svg',
        title: 'DePara - Sistema de Sincronização de Arquivos'
    });

    // Carregar a aplicação
    mainWindow.loadURL('http://localhost:3000');

    // Abrir DevTools (opcional)
    // mainWindow.webContents.openDevTools();

    // Fechar quando a janela for fechada
    mainWindow.on('closed', function () {
        mainWindow = null;
    });
}

// Este método será chamado quando o Electron terminar de inicializar
app.whenReady().then(createWindow);

// Sair quando todas as janelas estiverem fechadas
app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
EOF

# 3. Criar script de inicialização
echo "📝 Criando script de inicialização..."
cat > /home/yo/DePara/start-depara-electron.sh << 'EOF'
#!/bin/bash

# Script para iniciar DePara com Electron
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

# Iniciar Electron
echo "⚡ Iniciando Electron..."
cd /home/yo/DePara
npx electron electron-main.js
EOF

# 4. Tornar executável
chmod +x /home/yo/DePara/start-depara-electron.sh

# 5. Remover arquivo .desktop antigo
rm -f /home/yo/.local/share/applications/depara.desktop

# 6. Criar diretório
mkdir -p /home/yo/.local/share/applications

# 7. Criar arquivo .desktop que usa o Electron
echo "📝 Criando arquivo .desktop..."
cat > /home/yo/.local/share/applications/depara.desktop << EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=DePara
Comment=DePara - Sistema de Sincronização de Arquivos
Exec=/home/yo/DePara/start-depara-electron.sh
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

echo "🎉 Aplicativo Electron criado!"
echo "🌐 Acesse: http://localhost:3000"
echo "💡 Agora teste clicando no ícone do DePara no menu!"
