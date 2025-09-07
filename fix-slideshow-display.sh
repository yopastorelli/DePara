#!/bin/bash

# Script para corrigir exibição do slideshow e remover limitação
echo "🔧 Corrigindo exibição do slideshow..."

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

# 3. Criar script de correção
echo "📝 Criando script de correção..."
cat > /home/yo/DePara/fix-slideshow-display.js << 'EOF'
// Script para corrigir exibição do slideshow
console.log('🔧 Corrigindo exibição do slideshow...');

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

async function fixSlideshowDisplay() {
    await waitForDeParaUI();
    
    console.log('✅ DeParaUI encontrada');
    
    // 1. Corrigir método updateSlideDisplay
    window.deParaUI.updateSlideDisplay = async function() {
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

        try {
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
            
        } catch (error) {
            console.error('❌ Erro ao carregar imagem:', error);
            loadingElement.style.display = 'none';
            imageElement.style.display = 'none';
            errorElement.style.display = 'block';
        }
    };
    
    console.log('🔧 Método updateSlideDisplay corrigido');
    
    // 2. Corrigir método loadSlideshowImages para remover limitação
    window.deParaUI.loadSlideshowImages = async function(folderPath, extensions, recursive, interval) {
        try {
            console.log('🔍 Iniciando carregamento de imagens...');
            this.showToast('🔍 Procurando imagens...', 'info');

            // Preparar extensões para a API
            const formattedExtensions = extensions.map(ext => ext.startsWith('.') ? ext : '.' + ext);

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

            // Usar todas as imagens (remover limitação)
            this.slideshowImages = result.data.images;
            this.slideshowInterval = interval * 1000;

            if (this.slideshowImages.length === 0) {
                this.showToast('Nenhuma imagem encontrada na pasta', 'warning');
                return;
            }

            // Aplicar modo aleatório se configurado
            if (this.slideshowConfig.random) {
                this.shuffleArray(this.slideshowImages);
                console.log('🎲 Imagens embaralhadas');
            }

            // Limpar cache de pré-carregamento
            this.preloadedImages.clear();

            const modeText = this.slideshowConfig.random ? ' (aleatório)' : ' (sequencial)';
            this.showToast(`✅ ${this.slideshowImages.length} imagens carregadas${modeText}`, 'success');
            
            console.log('🎬 Iniciando viewer do slideshow...');
            this.startSlideshowViewer();

        } catch (error) {
            console.error('❌ Erro ao carregar imagens:', error);
            this.showToast('Erro ao carregar imagens: ' + error.message, 'error');
        }
    };
    
    console.log('🔧 Método loadSlideshowImages corrigido (sem limitação)');
    
    // 3. Adicionar método shuffleArray se não existir
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
    
    // 4. Testar correções
    console.log('🧪 Testando correções...');
    
    // Testar abertura do modal
    window.deParaUI.showSlideshowModal();
    
    setTimeout(() => {
        const modal = document.getElementById('slideshow-config-modal');
        if (modal && modal.style.display !== 'none') {
            console.log('✅ Modal do slideshow funcionando');
            
            // Fechar modal
            window.deParaUI.closeSlideshowModal();
        } else {
            console.error('❌ Modal do slideshow não está funcionando');
        }
    }, 1000);
    
    console.log('🎉 Correções aplicadas!');
    console.log('📋 Problemas corrigidos:');
    console.log('  - Exibição de imagens funcionando');
    console.log('  - Limitação de 50 imagens removida');
    console.log('  - Logs detalhados para debug');
    console.log('  - Carregamento direto das imagens');
}

// Executar correções
fixSlideshowDisplay().catch(console.error);
EOF

echo "✅ Script de correção criado!"
echo "🌐 Acesse: http://localhost:3000"
echo "💡 Cole o conteúdo do arquivo fix-slideshow-display.js no console do navegador"
echo "🔧 Isso vai corrigir a exibição das imagens e remover a limitação!"
