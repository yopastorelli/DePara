#!/bin/bash

# Script para corrigir performance do slideshow
# Autor: yopastorelli
# Versão: 1.0.0

echo "⚡ Corrigindo performance do slideshow..."

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

# 3. Criar script de correção de performance
echo "📝 Criando script de correção de performance..."
cat > /home/yo/DePara/fix-slideshow-performance.js << 'EOF'
// Script para corrigir performance do slideshow
console.log('⚡ Corrigindo performance do slideshow...');

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

async function fixSlideshowPerformance() {
    await waitForDeParaUI();
    
    console.log('✅ DeParaUI encontrada');
    
    // 1. Sobrescrever método loadSlideshowImages para limitar imagens
    const originalLoadSlideshowImages = window.deParaUI.loadSlideshowImages;
    
    window.deParaUI.loadSlideshowImages = async function(folderPath, extensions, recursive, interval) {
        try {
            this.showToast('🔍 Procurando imagens...', 'info');

            // Preparar extensões para a API
            const formattedExtensions = extensions.map(ext => ext.startsWith('.') ? ext : '.' + ext);

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

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error?.message || 'Erro ao listar imagens');
            }

            // LIMITAR NÚMERO DE IMAGENS PARA PERFORMANCE
            const maxImages = 100; // Máximo 100 imagens
            let images = result.data.images;
            
            if (images.length > maxImages) {
                console.log(`⚠️ Limitando imagens de ${images.length} para ${maxImages} para melhor performance`);
                images = images.slice(0, maxImages);
                this.showToast(`⚠️ Limitado a ${maxImages} imagens para melhor performance`, 'warning');
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
                console.log('🎲 Imagens embaralhadas para ordem aleatória');
            }

            // Limpar cache de pré-carregamento
            this.preloadedImages.clear();

            const modeText = this.slideshowConfig.random ? ' (ordem aleatória)' : ' (ordem sequencial)';
            this.showToast(`✅ ${this.slideshowImages.length} imagens carregadas${modeText}`, 'success');
            this.startSlideshowViewer();

        } catch (error) {
            console.error('Erro ao carregar imagens:', error);
            this.showToast('Erro ao carregar imagens: ' + error.message, 'error');
        }
    };
    
    console.log('🔧 Método loadSlideshowImages otimizado');
    
    // 2. Adicionar método para embaralhar array
    window.deParaUI.shuffleArray = function(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    };
    
    console.log('🔧 Método shuffleArray adicionado');
    
    // 3. Otimizar pré-carregamento
    const originalPreloadNextImage = window.deParaUI.preloadNextImage;
    
    window.deParaUI.preloadNextImage = async function() {
        if (!this.slideshowConfig.preload || this.slideshowImages.length <= 1) {
            return;
        }

        // Limitar pré-carregamento para evitar sobrecarga
        if (this.preloadedImages.size >= 5) {
            return; // Máximo 5 imagens pré-carregadas
        }

        const nextIndex = (this.currentSlideIndex + 1) % this.slideshowImages.length;
        const nextImagePath = this.slideshowImages[nextIndex];

        try {
            await this.preloadImage(nextImagePath);
        } catch (error) {
            console.warn('Erro ao pré-carregar próxima imagem:', error);
        }
    };
    
    console.log('🔧 Método preloadNextImage otimizado');
    
    // 4. Testar com pasta limitada
    console.log('🧪 Testando com pasta limitada...');
    
    const testFolder = '/mnt';
    console.log('📁 Testando pasta:', testFolder);
    
    try {
        // Configurar slideshow
        window.deParaUI.slideshowConfig = {
            interval: 5,
            random: false,
            preload: true,
            extensions: ['.jpg', '.jpeg', '.png', '.gif', '.bmp'],
            recursive: true
        };
        
        // Carregar imagens (agora limitado)
        await window.deParaUI.loadSlideshowImages(
            testFolder,
            ['.jpg', '.jpeg', '.png', '.gif', '.bmp'],
            true,
            5
        );
        
        console.log('✅ Slideshow otimizado configurado!');
        console.log('📸 Imagens carregadas:', window.deParaUI.slideshowImages.length);
        
    } catch (error) {
        console.error('❌ Erro ao testar slideshow otimizado:', error);
    }
    
    console.log('🎉 Performance do slideshow corrigida!');
}

// Executar correção
fixSlideshowPerformance().catch(console.error);
EOF

echo "✅ Script de correção de performance criado!"
echo "🌐 Acesse: http://localhost:3000"
echo "💡 Cole o conteúdo do arquivo fix-slideshow-performance.js no console do navegador"
echo "⚡ Isso vai limitar as imagens e otimizar a performance!"
