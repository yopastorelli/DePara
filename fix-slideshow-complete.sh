#!/bin/bash

# Script completo para corrigir slideshow - carregamento e fullscreen
echo "🔧 Corrigindo slideshow completamente..."

cd ~/DePara

# 1. Parar DePara
echo "⏹️ Parando DePara..."
sudo pkill -f "node.*main.js" 2>/dev/null || true
sleep 2

# 2. Atualizar código
echo "📥 Atualizando código..."
git pull origin main

# 3. Corrigir método updateSlideDisplay com fullscreen
echo "🔧 Corrigindo método updateSlideDisplay..."
cat > /tmp/fix_slideshow_complete.js << 'EOF'
    // Atualizar exibição do slide atual
    async updateSlideDisplay() {
        console.log('🖼️ Atualizando exibição do slide...');
        
        const imageElement = document.getElementById('slideshow-image');
        const counterElement = document.getElementById('slideshow-counter');
        const filenameElement = document.getElementById('slideshow-filename');
        const loadingElement = document.getElementById('slideshow-loading');
        const errorElement = document.getElementById('slideshow-error');

        if (this.slideshowImages.length === 0) {
            console.log('❌ Nenhuma imagem carregada');
            loadingElement.style.display = 'none';
            errorElement.style.display = 'block';
            return;
        }

        const currentImage = this.slideshowImages[this.currentSlideIndex];
        console.log('📸 Imagem atual:', currentImage);

        // Atualizar contador e nome do arquivo
        counterElement.textContent = `${this.currentSlideIndex + 1} / ${this.slideshowImages.length}`;
        filenameElement.textContent = currentImage.name;
        
        // Atualizar caminho completo da imagem no rodapé
        const pathElement = document.getElementById('slideshow-path');
        if (pathElement) {
            pathElement.textContent = currentImage.path;
        }

        // Construir URL da imagem
        const imageUrl = `/api/files/image/${encodeURIComponent(currentImage.path)}`;
        console.log('🔗 URL da imagem:', imageUrl);

        // Mostrar loading
        loadingElement.style.display = 'block';
        imageElement.style.display = 'none';
        errorElement.style.display = 'none';

        // Carregar imagem diretamente
        const img = new Image();
        
        img.onload = () => {
            console.log('✅ Imagem carregada com sucesso:', imageUrl);
            loadingElement.style.display = 'none';
            imageElement.src = imageUrl;
            imageElement.style.display = 'block';
            errorElement.style.display = 'none';
            
            // Pré-carregar próxima imagem
            this.preloadNextImage();
        };
        
        img.onerror = (error) => {
            console.error('❌ Erro ao carregar imagem:', error);
            loadingElement.style.display = 'none';
            imageElement.style.display = 'none';
            errorElement.style.display = 'block';
        };
        
        img.src = imageUrl;
    }
EOF

# 4. Corrigir método startSlideshowViewer com fullscreen
echo "🔧 Corrigindo método startSlideshowViewer..."
cat > /tmp/fix_startSlideshowViewer.js << 'EOF'
    // Iniciar viewer do slideshow
    startSlideshowViewer() {
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
    }

    // Entrar em fullscreen
    enterFullscreen() {
        console.log('🖥️ Entrando em fullscreen...');
        
        const viewer = document.getElementById('slideshow-viewer');
        if (!viewer) return;

        // Tentar diferentes métodos de fullscreen
        if (viewer.requestFullscreen) {
            viewer.requestFullscreen().catch(err => {
                console.warn('Erro ao entrar em fullscreen:', err);
            });
        } else if (viewer.webkitRequestFullscreen) {
            viewer.webkitRequestFullscreen();
        } else if (viewer.mozRequestFullScreen) {
            viewer.mozRequestFullScreen();
        } else if (viewer.msRequestFullscreen) {
            viewer.msRequestFullscreen();
        } else {
            console.warn('Fullscreen não suportado neste navegador');
        }
    }

    // Sair do fullscreen
    exitFullscreen() {
        console.log('🖥️ Saindo do fullscreen...');
        
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
EOF

# 5. Aplicar correções no app.js
echo "🔧 Aplicando correções no app.js..."
python3 -c "
import re

# Ler arquivo
with open('src/public/app.js', 'r') as f:
    content = f.read()

# Ler correções
with open('/tmp/fix_slideshow_complete.js', 'r') as f:
    updateSlideDisplay = f.read()

with open('/tmp/fix_startSlideshowViewer.js', 'r') as f:
    startSlideshowViewer = f.read()

# Substituir updateSlideDisplay
pattern1 = r'async updateSlideDisplay\(\) \{[^}]*\}'
if re.search(pattern1, content, re.DOTALL):
    content = re.sub(pattern1, updateSlideDisplay, content, flags=re.DOTALL)
    print('✅ updateSlideDisplay substituído')
else:
    print('❌ updateSlideDisplay não encontrado')

# Substituir startSlideshowViewer
pattern2 = r'startSlideshowViewer\(\) \{[^}]*\}'
if re.search(pattern2, content, re.DOTALL):
    content = re.sub(pattern2, startSlideshowViewer, content, flags=re.DOTALL)
    print('✅ startSlideshowViewer substituído')
else:
    print('❌ startSlideshowViewer não encontrado')

# Salvar arquivo
with open('src/public/app.js', 'w') as f:
    f.write(content)

print('✅ Correções aplicadas no app.js')
"

# 6. Remover limitação de 50 imagens
echo "🔧 Removendo limitação de 50 imagens..."
sed -i '/const maxImages = 50/d' src/routes/fileOperations.js
sed -i '/const limitedImages = images\.slice(0, maxImages)/d' src/routes/fileOperations.js
sed -i '/if (images\.length > maxImages)/d' src/routes/fileOperations.js
sed -i '/logger\.warn.*limitando/d' src/routes/fileOperations.js
sed -i '/}/d' src/routes/fileOperations.js

# Substituir retorno da API
sed -i 's/images: limitedImages,/images: images,/' src/routes/fileOperations.js
sed -i 's/totalCount: limitedImages\.length,/totalCount: images.length,/' src/routes/fileOperations.js
sed -i 's/limited: images\.length > maxImages/limited: false/' src/routes/fileOperations.js

echo "✅ Limitação de 50 imagens removida"

# 7. Adicionar CSS para fullscreen
echo "🔧 Adicionando CSS para fullscreen..."
cat >> src/public/styles.css << 'EOF'

/* Slideshow Fullscreen */
.slideshow-viewer:-webkit-full-screen {
    background: #000;
    width: 100vw;
    height: 100vh;
}

.slideshow-viewer:-moz-full-screen {
    background: #000;
    width: 100vw;
    height: 100vh;
}

.slideshow-viewer:fullscreen {
    background: #000;
    width: 100vw;
    height: 100vh;
}

.slideshow-viewer:-webkit-full-screen .slideshow-content {
    height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
}

.slideshow-viewer:-moz-full-screen .slideshow-content {
    height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
}

.slideshow-viewer:fullscreen .slideshow-content {
    height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
}

.slideshow-viewer:-webkit-full-screen .slideshow-image-container {
    max-width: 100vw;
    max-height: 100vh;
}

.slideshow-viewer:-moz-full-screen .slideshow-image-container {
    max-width: 100vw;
    max-height: 100vh;
}

.slideshow-viewer:fullscreen .slideshow-image-container {
    max-width: 100vw;
    max-height: 100vh;
}

.slideshow-viewer:-webkit-full-screen #slideshow-image {
    max-width: 100vw;
    max-height: 100vh;
    object-fit: contain;
}

.slideshow-viewer:-moz-full-screen #slideshow-image {
    max-width: 100vw;
    max-height: 100vh;
    object-fit: contain;
}

.slideshow-viewer:fullscreen #slideshow-image {
    max-width: 100vw;
    max-height: 100vh;
    object-fit: contain;
}
EOF

echo "✅ CSS para fullscreen adicionado"

# 8. Instalar dependências
echo "📦 Instalando dependências..."
npm install

# 9. Iniciar DePara
echo "▶️ Iniciando DePara..."
npm start &

# 10. Aguardar inicialização
echo "⏳ Aguardando inicialização..."
sleep 5

# 11. Verificar status
echo "✅ Verificando status..."
if curl -s http://localhost:3000/api/health > /dev/null; then
    echo "✅ DePara funcionando!"
    echo "🌐 Acesse: http://localhost:3000"
    echo "🎬 Teste o slideshow agora!"
    echo "📋 O slideshow deve entrar em fullscreen automaticamente"
    echo "📋 As imagens devem carregar e exibir corretamente"
else
    echo "❌ Erro na inicialização"
    echo "📋 Verifique os logs: tail -f logs/depara.log"
fi

echo "🎉 Correção completa do slideshow concluída!"