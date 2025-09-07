#!/bin/bash

# Script para otimização final do slideshow
# Autor: yopastorelli
# Versão: 1.0.0

echo "⚡ Otimização final do slideshow..."

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

# 3. Criar script de otimização final
echo "📝 Criando script de otimização final..."
cat > /home/yo/DePara/optimize-slideshow-final.js << 'EOF'
// Script para otimização final do slideshow
console.log('⚡ Otimização final do slideshow...');

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

async function optimizeSlideshowFinal() {
    await waitForDeParaUI();
    
    console.log('✅ DeParaUI encontrada');
    
    // 1. Otimizar pré-carregamento para apenas 1 imagem
    const originalPreloadNextImage = window.deParaUI.preloadNextImage;
    
    window.deParaUI.preloadNextImage = async function() {
        if (!this.slideshowConfig.preload || this.slideshowImages.length <= 1) {
            return;
        }

        // Apenas 1 imagem pré-carregada (próxima)
        if (this.preloadedImages.size >= 1) {
            return;
        }

        const nextIndex = (this.currentSlideIndex + 1) % this.slideshowImages.length;
        const nextImagePath = this.slideshowImages[nextIndex];

        try {
            await this.preloadImage(nextImagePath);
            console.log('🖼️ Próxima imagem pré-carregada');
        } catch (error) {
            console.warn('Erro ao pré-carregar próxima imagem:', error);
        }
    };
    
    console.log('🔧 Pré-carregamento otimizado para 1 imagem');
    
    // 2. Limitar carregamento de imagens para 50
    const originalLoadSlideshowImages = window.deParaUI.loadSlideshowImages;
    
    window.deParaUI.loadSlideshowImages = async function(folderPath, extensions, recursive, interval) {
        try {
            this.showToast('🔍 Procurando imagens...', 'info');

            const formattedExtensions = extensions.map(ext => ext.startsWith('.') ? ext : '.' + ext);

            const response = await fetch('/api/files/list-images', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    folderPath,
                    extensions: formattedExtensions,
                    recursive
                })
            });

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error?.message || 'Erro ao listar imagens');
            }

            // Limitar a 50 imagens para performance
            let images = result.data.images;
            if (images.length > 50) {
                images = images.slice(0, 50);
                this.showToast(`⚠️ Limitado a 50 imagens para melhor performance`, 'warning');
            }

            this.slideshowImages = images;
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
            this.startSlideshowViewer();

        } catch (error) {
            console.error('Erro ao carregar imagens:', error);
            this.showToast('Erro ao carregar imagens: ' + error.message, 'error');
        }
    };
    
    console.log('🔧 Carregamento limitado a 50 imagens');
    
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
    
    // 4. Testar otimização
    console.log('🧪 Testando otimização...');
    
    const testFolder = '/mnt';
    console.log('📁 Testando pasta:', testFolder);
    
    try {
        // Configurar slideshow otimizado
        window.deParaUI.slideshowConfig = {
            interval: 5,
            random: false,
            preload: true,
            extensions: ['.jpg', '.jpeg', '.png', '.gif', '.bmp'],
            recursive: true
        };
        
        // Carregar imagens (limitado a 50)
        await window.deParaUI.loadSlideshowImages(
            testFolder,
            ['.jpg', '.jpeg', '.png', '.gif', '.bmp'],
            true,
            5
        );
        
        console.log('✅ Slideshow otimizado configurado!');
        console.log('📸 Imagens carregadas:', window.deParaUI.slideshowImages.length);
        console.log('💾 Pré-carregamento: 1 imagem');
        
    } catch (error) {
        console.error('❌ Erro ao testar slideshow otimizado:', error);
    }
    
    console.log('🎉 Otimização final concluída!');
    console.log('📊 Resumo:');
    console.log('  - Máximo 50 imagens carregadas');
    console.log('  - Apenas 1 imagem pré-carregada');
    console.log('  - Performance otimizada');
}

// Executar otimização
optimizeSlideshowFinal().catch(console.error);
EOF

echo "✅ Script de otimização final criado!"
echo "🌐 Acesse: http://localhost:3000"
echo "💡 Cole o conteúdo do arquivo optimize-slideshow-final.js no console do navegador"
echo "⚡ Isso vai otimizar para apenas 1 imagem pré-carregada!"
