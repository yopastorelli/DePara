#!/bin/bash

# Script para corrigir bug do pré-carregamento
echo "🔧 Corrigindo bug do pré-carregamento..."

cd ~/DePara

# 1. Parar DePara
echo "⏹️ Parando DePara..."
sudo pkill -f "node.*main.js" 2>/dev/null || true
sleep 2

# 2. Atualizar código
echo "📥 Atualizando código..."
git pull origin main

# 3. Corrigir método preloadImage
echo "🔧 Corrigindo método preloadImage..."
python3 -c "
import re

# Ler arquivo
with open('src/public/app.js', 'r') as f:
    content = f.read()

# Método preloadImage corrigido
preloadImage = '''    // Pré-carregar imagem
    preloadImage(imagePath) {
        return new Promise((resolve, reject) => {
            // Se imagePath for um objeto, extrair o path
            let actualPath = imagePath;
            if (typeof imagePath === 'object' && imagePath.path) {
                actualPath = imagePath.path;
            }
            
            if (this.preloadedImages.has(actualPath)) {
                resolve(this.preloadedImages.get(actualPath));
                return;
            }

            const img = new Image();
            img.onload = () => {
                this.preloadedImages.set(actualPath, img);
                console.log('🖼️ Imagem pré-carregada:', actualPath);
                resolve(img);
            };
            img.onerror = () => {
                console.warn('⚠️ Erro ao pré-carregar imagem:', actualPath);
                reject(new Error('Erro ao carregar imagem'));
            };
            img.src = actualPath;
        });
    }'''

# Substituir método preloadImage
pattern = r'preloadImage\(imagePath\) \{[^}]*\}'
if re.search(pattern, content, re.DOTALL):
    content = re.sub(pattern, preloadImage, content, flags=re.DOTALL)
    print('✅ preloadImage substituído')
else:
    print('❌ preloadImage não encontrado')

# Método preloadNextImage corrigido
preloadNextImage = '''    // Pré-carregar próxima imagem se habilitado
    async preloadNextImage() {
        if (!this.slideshowConfig.preload || this.slideshowImages.length <= 1) {
            return;
        }
        
        // Limitar pré-carregamento para apenas 1 imagem (próxima)
        if (this.preloadedImages.size >= 1) {
            return; // Máximo 1 imagem pré-carregada
        }
        
        const nextIndex = (this.currentSlideIndex + 1) % this.slideshowImages.length;
        const nextImage = this.slideshowImages[nextIndex];
        
        // Construir URL correta da imagem
        const imageUrl = \`/api/files/image/\${encodeURIComponent(nextImage.path)}\`;
        
        try {
            await this.preloadImage(imageUrl);
        } catch (error) {
            console.warn('Erro ao pré-carregar próxima imagem:', error);
        }
    }'''

# Substituir método preloadNextImage
pattern2 = r'preloadNextImage\(\) \{[^}]*\}'
if re.search(pattern2, content, re.DOTALL):
    content = re.sub(pattern2, preloadNextImage, content, flags=re.DOTALL)
    print('✅ preloadNextImage substituído')
else:
    print('❌ preloadNextImage não encontrado')

# Salvar arquivo
with open('src/public/app.js', 'w') as f:
    f.write(content)

print('✅ Correções aplicadas no app.js')
"

# 4. Corrigir problema de múltiplas instâncias
echo "🔧 Corrigindo problema de múltiplas instâncias..."
python3 -c "
import re

# Ler arquivo
with open('src/public/app.js', 'r') as f:
    content = f.read()

# Método startSlideshowFromModal corrigido
startSlideshowFromModal = '''    // Iniciar slideshow a partir do modal
    async startSlideshowFromModal() {
        // Verificar se já está rodando
        if (this.slideshowImages && this.slideshowImages.length > 0) {
            console.log('⚠️ Slideshow já está rodando, fechando primeiro...');
            this.closeSlideshowViewer();
            // Aguardar um pouco para garantir que fechou
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        const folderPath = document.getElementById('slideshow-folder-path').value.trim();

        if (!folderPath) {
            this.showToast('Selecione uma pasta com imagens', 'error');
            return;
        }

        // Aplicar configurações do modal
        this.applySlideshowConfigFromModal();

        // Fechar modal de configuração
        this.closeSlideshowModal();

        // Iniciar carregamento das imagens
        await this.loadSlideshowImages(folderPath, this.slideshowConfig.extensions, this.slideshowConfig.recursive, this.slideshowConfig.interval);
    }'''

# Substituir método startSlideshowFromModal
pattern3 = r'startSlideshowFromModal\(\) \{[^}]*\}'
if re.search(pattern3, content, re.DOTALL):
    content = re.sub(pattern3, startSlideshowFromModal, content, flags=re.DOTALL)
    print('✅ startSlideshowFromModal substituído')
else:
    print('❌ startSlideshowFromModal não encontrado')

# Salvar arquivo
with open('src/public/app.js', 'w') as f:
    f.write(content)

print('✅ Correções de múltiplas instâncias aplicadas')
"

# 5. Instalar dependências
echo "📦 Instalando dependências..."
npm install

# 6. Iniciar DePara
echo "▶️ Iniciando DePara..."
npm start &

# 7. Aguardar inicialização
echo "⏳ Aguardando inicialização..."
sleep 5

# 8. Verificar status
echo "✅ Verificando status..."
if curl -s http://localhost:3000/api/health > /dev/null; then
    echo "✅ DePara funcionando!"
    echo "🌐 Acesse: http://localhost:3000"
    echo "🎬 Teste o slideshow agora!"
    echo "📋 O pré-carregamento deve funcionar corretamente"
else
    echo "❌ Erro na inicialização"
    echo "📋 Verifique os logs: tail -f logs/depara.log"
fi

echo "🎉 Bug do pré-carregamento corrigido!"
