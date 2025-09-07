#!/bin/bash

# Script para forçar correção do slideshow no Raspberry Pi
echo "🔧 Forçando correção do slideshow..."

# 1. Parar DePara
echo "⏹️ Parando DePara..."
sudo pkill -f "node.*main.js" 2>/dev/null || true
sleep 3

# 2. Navegar para diretório
cd ~/DePara

# 3. Forçar atualização
echo "📥 Forçando atualização..."
git fetch origin
git reset --hard origin/main

# 4. Verificar se as correções estão aplicadas
echo "🔍 Verificando correções..."

# Verificar se a limitação foi removida
if grep -q "Usar todas as imagens encontradas" src/routes/fileOperations.js; then
    echo "✅ Limitação de 50 imagens removida"
else
    echo "❌ Limitação ainda existe - aplicando correção manual..."
    
    # Aplicar correção manual
    sed -i 's/const maxImages = 50;.*//' src/routes/fileOperations.js
    sed -i 's/const limitedImages = images\.slice(0, maxImages);.*//' src/routes/fileOperations.js
    sed -i 's/if (images\.length > maxImages) {.*//' src/routes/fileOperations.js
    sed -i 's/logger\.warn.*limitando.*//' src/routes/fileOperations.js
    sed -i 's/}.*//' src/routes/fileOperations.js
    
    # Substituir o retorno da API
    sed -i 's/images: limitedImages,/images: images,/' src/routes/fileOperations.js
    sed -i 's/totalCount: limitedImages\.length,/totalCount: images.length,/' src/routes/fileOperations.js
    sed -i 's/limited: images\.length > maxImages/limited: false/' src/routes/fileOperations.js
    
    echo "✅ Correção manual aplicada"
fi

# 5. Verificar método updateSlideDisplay
if grep -q "console.log.*Atualizando exibição do slide" src/public/app.js; then
    echo "✅ Método updateSlideDisplay corrigido"
else
    echo "❌ Método updateSlideDisplay não corrigido - aplicando correção manual..."
    
    # Aplicar correção manual do updateSlideDisplay
    cat > /tmp/updateSlideDisplay.js << 'EOF'
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
    }
EOF
    
    # Substituir o método no arquivo
    python3 -c "
import re

# Ler arquivo
with open('src/public/app.js', 'r') as f:
    content = f.read()

# Ler novo método
with open('/tmp/updateSlideDisplay.js', 'r') as f:
    new_method = f.read()

# Substituir método
pattern = r'async updateSlideDisplay\(\) \{[^}]*\}'
content = re.sub(pattern, new_method, content, flags=re.DOTALL)

# Salvar arquivo
with open('src/public/app.js', 'w') as f:
    f.write(content)

print('✅ Método updateSlideDisplay substituído')
"
    
    echo "✅ Correção manual do updateSlideDisplay aplicada"
fi

# 6. Instalar dependências
echo "📦 Instalando dependências..."
npm install

# 7. Iniciar DePara
echo "▶️ Iniciando DePara..."
npm start &

# 8. Aguardar inicialização
echo "⏳ Aguardando inicialização..."
sleep 5

# 9. Verificar status
echo "✅ Verificando status..."
if curl -s http://localhost:3000/api/health > /dev/null; then
    echo "✅ DePara funcionando!"
    echo "🌐 Acesse: http://localhost:3000"
    echo "🎬 Teste o slideshow agora!"
else
    echo "❌ Erro na inicialização"
    echo "📋 Verifique os logs: tail -f logs/depara.log"
fi

echo "🎉 Correção forçada concluída!"
