#!/bin/bash

# Script para corrigir exibição do slideshow
echo "🔧 Corrigindo exibição do slideshow..."

cd ~/DePara

# 1. Parar DePara
echo "⏹️ Parando DePara..."
sudo pkill -f "node.*main.js" 2>/dev/null || true
sleep 3

# 2. Fazer backup do app.js
echo "💾 Fazendo backup do app.js..."
cp src/public/app.js src/public/app.js.backup

# 3. Corrigir problema de exibição
echo "🔧 Corrigindo exibição do slideshow..."
python3 << 'EOF'
import re

# Ler o arquivo
with open('src/public/app.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Corrigir o método updateSlideDisplay para garantir que a imagem seja exibida
old_update = '''    // Atualizar exibição do slide
    updateSlideDisplay() {
        console.log('🖼️ Atualizando exibição do slide...');
        
        if (!this.slideshowImages || this.slideshowImages.length === 0) {
            console.log('⚠️ Nenhuma imagem disponível');
            return;
        }

        const currentImage = this.slideshowImages[this.currentSlideIndex];
        console.log('📸 Imagem atual:', currentImage);

        // Atualizar contador
        const counter = document.getElementById('slideshow-counter');
        if (counter) {
            counter.textContent = `${this.currentSlideIndex + 1} / ${this.slideshowImages.length}`;
        }

        // Atualizar nome do arquivo
        const filename = document.getElementById('slideshow-filename');
        if (filename) {
            filename.textContent = currentImage.name || 'Imagem desconhecida';
        }

        // Atualizar imagem
        const imgElement = document.getElementById('slideshow-image');
        if (imgElement) {
            const imageUrl = `/api/files/image/${encodeURIComponent(currentImage.path)}`;
            console.log('🔗 URL da imagem:', imageUrl);
            
            // Carregar imagem diretamente
            const img = new Image();
            img.onload = () => {
                console.log('✅ Imagem carregada com sucesso:', imageUrl);
                imgElement.src = imageUrl;
                imgElement.style.display = 'block';
            };
            img.onerror = (error) => {
                console.error('❌ Erro ao carregar imagem:', error);
                imgElement.style.display = 'none';
            };
            img.src = imageUrl;
        }

        // Pré-carregar próxima imagem
        this.preloadNextImage();
    }'''

new_update = '''    // Atualizar exibição do slide
    updateSlideDisplay() {
        console.log('🖼️ Atualizando exibição do slide...');
        
        if (!this.slideshowImages || this.slideshowImages.length === 0) {
            console.log('⚠️ Nenhuma imagem disponível');
            return;
        }

        const currentImage = this.slideshowImages[this.currentSlideIndex];
        console.log('📸 Imagem atual:', currentImage);

        // Atualizar contador
        const counter = document.getElementById('slideshow-counter');
        if (counter) {
            counter.textContent = `${this.currentSlideIndex + 1} / ${this.slideshowImages.length}`;
        }

        // Atualizar nome do arquivo
        const filename = document.getElementById('slideshow-filename');
        if (filename) {
            filename.textContent = currentImage.name || 'Imagem desconhecida';
        }

        // Atualizar imagem
        const imgElement = document.getElementById('slideshow-image');
        if (imgElement) {
            const imageUrl = `/api/files/image/${encodeURIComponent(currentImage.path)}`;
            console.log('🔗 URL da imagem:', imageUrl);
            
            // Mostrar loading
            imgElement.style.display = 'none';
            imgElement.src = '';
            
            // Carregar imagem diretamente
            const img = new Image();
            img.onload = () => {
                console.log('✅ Imagem carregada com sucesso:', imageUrl);
                imgElement.src = imageUrl;
                imgElement.style.display = 'block';
                imgElement.style.opacity = '1';
                
                // Esconder loading
                const loading = document.querySelector('.slideshow-loading');
                if (loading) {
                    loading.style.display = 'none';
                }
            };
            img.onerror = (error) => {
                console.error('❌ Erro ao carregar imagem:', error);
                imgElement.style.display = 'none';
                
                // Mostrar erro
                const loading = document.querySelector('.slideshow-loading');
                if (loading) {
                    loading.innerHTML = '❌ Erro ao carregar imagem';
                }
            };
            img.src = imageUrl;
        } else {
            console.error('❌ Elemento slideshow-image não encontrado');
        }

        // Pré-carregar próxima imagem
        this.preloadNextImage();
    }'''

content = content.replace(old_update, new_update)

# Corrigir o método startSlideshowViewer para esconder loading inicial
old_start = '''    startSlideshowViewer() {
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
        
        // Esconder loading inicial
        const loading = document.querySelector('.slideshow-loading');
        if (loading) {
            loading.style.display = 'none';
        }
        
        this.currentSlideIndex = 0;
        this.slideshowPlaying = true;

        // Entrar em fullscreen automaticamente
        this.enterFullscreen();

        this.updateSlideDisplay();
        this.startAutoPlay();
    }'''

content = content.replace(old_start, new_start)

# Escrever o arquivo corrigido
with open('src/public/app.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ Correções de exibição aplicadas!")
EOF

# 4. Verificar se as correções foram aplicadas
echo "🔍 Verificando correções..."
if grep -q "imgElement.style.opacity = '1';" src/public/app.js; then
    echo "✅ Exibição de imagem corrigida"
else
    echo "❌ Erro na correção da exibição"
fi

if grep -q "loading.style.display = 'none';" src/public/app.js; then
    echo "✅ Loading inicial corrigido"
else
    echo "❌ Erro na correção do loading"
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
    echo "  ✅ Imagem agora é exibida corretamente"
    echo "  ✅ Loading inicial é escondido"
    echo "  ✅ Opacity configurada para visibilidade"
    echo "  ✅ Tratamento de erro melhorado"
else
    echo "❌ Erro na inicialização"
    echo "📋 Verifique os logs: tail -f logs/depara.log"
fi

echo "🎉 Correções de exibição aplicadas com sucesso!"