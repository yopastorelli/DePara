#!/bin/bash

# Script de debug profundo do slideshow
echo "🔍 Investigação profunda do carregamento infinito..."

cd ~/DePara

# 1. Parar DePara
echo "⏹️ Parando DePara..."
sudo pkill -f "node.*main.js" 2>/dev/null || true
sleep 2

# 2. Atualizar código
echo "📥 Atualizando código..."
git pull origin main

# 3. Criar script de debug completo
echo "🔧 Criando script de debug completo..."
cat > /home/yo/DePara/debug-slideshow-deep.js << 'EOF'
// Script de debug profundo do slideshow
console.log('🔍 Iniciando debug profundo do slideshow...');

// Aguardar DeParaUI estar disponível
function waitForDeParaUI() {
    return new Promise((resolve) => {
        const check = () => {
            if (typeof window.deParaUI !== 'undefined') {
                resolve();
            } else {
                setTimeout(check, 100);
            }
        };
        check();
    });
}

async function debugSlideshowDeep() {
    await waitForDeParaUI();
    
    console.log('✅ DeParaUI encontrada');
    
    // 1. Debug do método updateSlideDisplay
    console.log('🔧 Corrigindo método updateSlideDisplay com debug completo...');
    
    window.deParaUI.updateSlideDisplay = async function() {
        console.log('🖼️ ===== INÍCIO updateSlideDisplay =====');
        console.log('📊 slideshowImages.length:', this.slideshowImages.length);
        console.log('📊 currentSlideIndex:', this.currentSlideIndex);
        
        const imageElement = document.getElementById('slideshow-image');
        const counterElement = document.getElementById('slideshow-counter');
        const filenameElement = document.getElementById('slideshow-filename');
        const loadingElement = document.getElementById('slideshow-loading');
        const errorElement = document.getElementById('slideshow-error');

        console.log('🔍 Elementos encontrados:');
        console.log('  - imageElement:', !!imageElement);
        console.log('  - counterElement:', !!counterElement);
        console.log('  - filenameElement:', !!filenameElement);
        console.log('  - loadingElement:', !!loadingElement);
        console.log('  - errorElement:', !!errorElement);

        if (this.slideshowImages.length === 0) {
            console.log('❌ Nenhuma imagem carregada');
            if (loadingElement) loadingElement.style.display = 'none';
            if (errorElement) errorElement.style.display = 'block';
            console.log('🖼️ ===== FIM updateSlideDisplay (sem imagens) =====');
            return;
        }

        const currentImage = this.slideshowImages[this.currentSlideIndex];
        console.log('📸 Imagem atual:', currentImage);

        // Atualizar contador e nome do arquivo
        if (counterElement) {
            counterElement.textContent = `${this.currentSlideIndex + 1} / ${this.slideshowImages.length}`;
        }
        if (filenameElement) {
            filenameElement.textContent = currentImage.name;
        }
        
        // Atualizar caminho completo da imagem no rodapé
        const pathElement = document.getElementById('slideshow-path');
        if (pathElement) {
            pathElement.textContent = currentImage.path;
        }

        // Construir URL da imagem
        const imageUrl = `/api/files/image/${encodeURIComponent(currentImage.path)}`;
        console.log('🔗 URL da imagem:', imageUrl);

        // Mostrar loading
        if (loadingElement) {
            loadingElement.style.display = 'block';
            console.log('⏳ Loading exibido');
        }
        if (imageElement) {
            imageElement.style.display = 'none';
        }
        if (errorElement) {
            errorElement.style.display = 'none';
        }

        // Carregar imagem diretamente
        console.log('🔄 Iniciando carregamento da imagem...');
        const img = new Image();
        
        img.onload = () => {
            console.log('✅ Imagem carregada com sucesso:', imageUrl);
            if (loadingElement) {
                loadingElement.style.display = 'none';
                console.log('⏳ Loading ocultado');
            }
            if (imageElement) {
                imageElement.src = imageUrl;
                imageElement.style.display = 'block';
                console.log('🖼️ Imagem exibida');
            }
            if (errorElement) {
                errorElement.style.display = 'none';
            }
            
            // Pré-carregar próxima imagem
            this.preloadNextImage();
            console.log('🖼️ ===== FIM updateSlideDisplay (sucesso) =====');
        };
        
        img.onerror = (error) => {
            console.error('❌ Erro ao carregar imagem:', error);
            console.error('❌ URL que falhou:', imageUrl);
            if (loadingElement) {
                loadingElement.style.display = 'none';
            }
            if (imageElement) {
                imageElement.style.display = 'none';
            }
            if (errorElement) {
                errorElement.style.display = 'block';
            }
            console.log('🖼️ ===== FIM updateSlideDisplay (erro) =====');
        };
        
        console.log('🔄 Definindo src da imagem...');
        img.src = imageUrl;
    };
    
    // 2. Debug do método loadSlideshowImages
    console.log('🔧 Corrigindo método loadSlideshowImages com debug completo...');
    
    window.deParaUI.loadSlideshowImages = async function(folderPath, extensions, recursive, interval) {
        console.log('🔍 ===== INÍCIO loadSlideshowImages =====');
        console.log('📁 folderPath:', folderPath);
        console.log('📁 extensions:', extensions);
        console.log('📁 recursive:', recursive);
        console.log('📁 interval:', interval);
        
        try {
            console.log('🔍 Iniciando carregamento de imagens...');
            this.showToast('🔍 Procurando imagens...', 'info');

            // Preparar extensões para a API
            const formattedExtensions = extensions.map(ext => ext.startsWith('.') ? ext : '.' + ext);
            console.log('📁 formattedExtensions:', formattedExtensions);

            console.log('📡 Enviando requisição para API...');
            const response = await fetch('/api/files/list-images', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    folderPath,
                    extensions: formattedExtensions,
                    recursive
                })
            });

            console.log('📡 Resposta recebida:', response.status, response.statusText);

            if (!response.ok) {
                throw new Error(`Erro HTTP: ${response.status} ${response.statusText}`);
            }

            const result = await response.json();
            console.log('📊 Resultado da API:', result);

            if (!result.success) {
                throw new Error(result.error?.message || 'Erro ao listar imagens');
            }

            this.slideshowImages = result.data.images;
            this.slideshowInterval = interval * 1000;

            console.log('📊 slideshowImages carregadas:', this.slideshowImages.length);
            console.log('📊 Primeiras 3 imagens:', this.slideshowImages.slice(0, 3));

            if (this.slideshowImages.length === 0) {
                this.showToast('Nenhuma imagem encontrada na pasta', 'warning');
                console.log('🔍 ===== FIM loadSlideshowImages (sem imagens) =====');
                return;
            }

            // Aplicar modo aleatório se configurado
            if (this.slideshowConfig.random) {
                this.shuffleArray(this.slideshowImages);
                console.log('🎲 Imagens embaralhadas para ordem aleatória');
            }

            // Limpar cache de pré-carregamento
            this.preloadedImages.clear();

            const modeText = this.slideshowConfig.random ? ' (ordem aleatória)' : ' (ordem sequencial)';
            this.showToast(`✅ ${this.slideshowImages.length} imagens encontradas${modeText}`, 'success');
            
            console.log('🎬 Iniciando viewer do slideshow...');
            this.startSlideshowViewer();
            console.log('🔍 ===== FIM loadSlideshowImages (sucesso) =====');

        } catch (error) {
            console.error('❌ Erro ao carregar imagens:', error);
            this.showToast('Erro ao carregar imagens: ' + error.message, 'error');
            console.log('🔍 ===== FIM loadSlideshowImages (erro) =====');
        }
    };
    
    // 3. Debug do método startSlideshowViewer
    console.log('🔧 Corrigindo método startSlideshowViewer com debug...');
    
    window.deParaUI.startSlideshowViewer = function() {
        console.log('🎬 ===== INÍCIO startSlideshowViewer =====');
        console.log('📊 slideshowImages.length:', this.slideshowImages.length);
        
        // Mostrar viewer
        const viewer = document.getElementById('slideshow-viewer');
        if (viewer) {
            viewer.style.display = 'flex';
            console.log('✅ Viewer exibido');
        } else {
            console.error('❌ Viewer não encontrado!');
        }
        
        this.currentSlideIndex = 0;
        this.slideshowPlaying = true;

        // Entrar em fullscreen automaticamente
        this.enterFullscreen();

        console.log('🔄 Chamando updateSlideDisplay...');
        this.updateSlideDisplay();
        
        console.log('🔄 Chamando startAutoPlay...');
        this.startAutoPlay();
        
        console.log('🎬 ===== FIM startSlideshowViewer =====');
    };
    
    // 4. Adicionar método shuffleArray se não existir
    if (!window.deParaUI.shuffleArray) {
        window.deParaUI.shuffleArray = function(array) {
            for (let i = array.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [array[i], array[j]] = [array[j], array[i]];
            }
            return array;
        };
        console.log('🔧 Método shuffleArray adicionado');
    }
    
    console.log('✅ Debug completo aplicado!');
    console.log('📋 Métodos corrigidos:');
    console.log('  - updateSlideDisplay (com logs detalhados)');
    console.log('  - loadSlideshowImages (com logs detalhados)');
    console.log('  - startSlideshowViewer (com logs detalhados)');
    console.log('🎬 Teste o slideshow agora e verifique o console!');
}

// Executar debug
debugSlideshowDeep().catch(console.error);
EOF

echo "✅ Script de debug criado!"
echo "🌐 Acesse: http://localhost:3000"
echo "💡 Cole o conteúdo do arquivo debug-slideshow-deep.js no console do navegador"
echo "🔍 Isso vai mostrar exatamente onde está o problema no carregamento!"

# 4. Instalar dependências
echo "📦 Instalando dependências..."
npm install

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
    echo "🎬 Teste o slideshow e verifique o console para logs detalhados!"
else
    echo "❌ Erro na inicialização"
    echo "📋 Verifique os logs: tail -f logs/depara.log"
fi

echo "🎉 Debug profundo configurado!"
