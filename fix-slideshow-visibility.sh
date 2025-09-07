#!/bin/bash

# Script para corrigir visibilidade do slideshow
echo "🔧 Corrigindo visibilidade do slideshow..."

cd ~/DePara

# 1. Parar DePara
echo "⏹️ Parando DePara..."
sudo pkill -f "node.*main.js" 2>/dev/null || true
sleep 3

# 2. Fazer backup do app.js
echo "💾 Fazendo backup do app.js..."
cp src/public/app.js src/public/app.js.backup

# 3. Corrigir problema de visibilidade
echo "🔧 Corrigindo visibilidade do slideshow..."
python3 << 'EOF'
import re

# Ler o arquivo
with open('src/public/app.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Corrigir o método startSlideshowViewer para garantir visibilidade
old_start = '''    startSlideshowViewer() {
        console.log('🎬 Iniciando viewer do slideshow...');
        
        // Mostrar viewer
        const viewer = document.getElementById('slideshow-viewer');
        if (viewer) {
            viewer.style.display = 'flex';
        }
        
        this.currentSlideIndex = 0;
        this.slideshowPlaying = true;

        // Entrar em fullscreen automaticamente
        this.enterFullscreen();

        this.updateSlideDisplay();
        this.startAutoPlay();
    }'''

new_start = '''    startSlideshowViewer() {
        console.log('🎬 Iniciando viewer do slideshow...');
        
        // Mostrar viewer
        const viewer = document.getElementById('slideshow-viewer');
        if (viewer) {
            viewer.style.display = 'flex';
            viewer.style.visibility = 'visible';
            viewer.style.opacity = '1';
            viewer.style.zIndex = '10000';
            console.log('✅ Slideshow viewer exibido');
        } else {
            console.error('❌ Elemento slideshow-viewer não encontrado');
            return;
        }
        
        this.currentSlideIndex = 0;
        this.slideshowPlaying = true;

        // Entrar em fullscreen automaticamente
        this.enterFullscreen();

        this.updateSlideDisplay();
        this.startAutoPlay();
    }'''

content = content.replace(old_start, new_start)

# Corrigir o método enterFullscreen para garantir que funcione
old_fullscreen = '''    // Entrar em fullscreen
    enterFullscreen() {
        const viewer = document.getElementById('slideshow-viewer');
        if (viewer) {
            if (viewer.requestFullscreen) {
                viewer.requestFullscreen();
            } else if (viewer.webkitRequestFullscreen) {
                viewer.webkitRequestFullscreen();
            } else if (viewer.mozRequestFullScreen) {
                viewer.mozRequestFullScreen();
            } else if (viewer.msRequestFullscreen) {
                viewer.msRequestFullscreen();
            }
        }
    }'''

new_fullscreen = '''    // Entrar em fullscreen
    enterFullscreen() {
        const viewer = document.getElementById('slideshow-viewer');
        if (viewer) {
            console.log('🖥️ Tentando entrar em fullscreen...');
            try {
                if (viewer.requestFullscreen) {
                    viewer.requestFullscreen();
                } else if (viewer.webkitRequestFullscreen) {
                    viewer.webkitRequestFullscreen();
                } else if (viewer.mozRequestFullScreen) {
                    viewer.mozRequestFullScreen();
                } else if (viewer.msRequestFullscreen) {
                    viewer.msRequestFullscreen();
                }
                console.log('✅ Fullscreen solicitado');
            } catch (error) {
                console.error('❌ Erro ao entrar em fullscreen:', error);
            }
        } else {
            console.error('❌ Elemento slideshow-viewer não encontrado para fullscreen');
        }
    }'''

content = content.replace(old_fullscreen, new_fullscreen)

# Adicionar método para verificar se o viewer está visível
old_exit = '''    // Sair do fullscreen
    exitFullscreen() {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        } else if (document.mozCancelFullScreen) {
            document.mozCancelFullScreen();
        } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
        }
    }'''

new_exit = '''    // Sair do fullscreen
    exitFullscreen() {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        } else if (document.mozCancelFullScreen) {
            document.mozCancelFullScreen();
        } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
        }
    }

    // Verificar se o viewer está visível
    isSlideshowViewerVisible() {
        const viewer = document.getElementById('slideshow-viewer');
        if (!viewer) return false;
        
        const style = window.getComputedStyle(viewer);
        return style.display !== 'none' && 
               style.visibility !== 'hidden' && 
               style.opacity !== '0';
    }'''

content = content.replace(old_exit, new_exit)

# Escrever o arquivo corrigido
with open('src/public/app.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ Correções de visibilidade aplicadas!")
EOF

# 4. Verificar se as correções foram aplicadas
echo "🔍 Verificando correções..."
if grep -q "viewer.style.visibility = 'visible';" src/public/app.js; then
    echo "✅ Visibilidade corrigida"
else
    echo "❌ Erro na correção da visibilidade"
fi

if grep -q "isSlideshowViewerVisible" src/public/app.js; then
    echo "✅ Método de verificação adicionado"
else
    echo "❌ Erro na adição do método de verificação"
fi

# 5. Iniciar DePara
echo "▶️ Iniciando DePara..."
npm start &

# 6. Aguardar inicialização
echo "⏳ Aguardando inicialização..."
sleep 5

# 7. Verificar status
echo "✅ Verificando status..."
if curl -s http://localhost:3000/api/health > /dev/null; then
    echo "✅ DePara funcionando!"
    echo "🌐 Acesse: http://localhost:3000"
    echo "💡 Pressione Ctrl+F5 para limpar cache do navegador"
    echo "🎬 Teste o slideshow agora!"
    echo ""
    echo "🔧 Correções aplicadas:"
    echo "  ✅ Visibilidade do slideshow garantida"
    echo "  ✅ Z-index configurado corretamente"
    echo "  ✅ Logs para debug de visibilidade"
    echo "  ✅ Método para verificar se está visível"
else
    echo "❌ Erro na inicialização"
    echo "📋 Verifique os logs: tail -f logs/depara.log"
fi

echo "🎉 Correções de visibilidade aplicadas com sucesso!"
