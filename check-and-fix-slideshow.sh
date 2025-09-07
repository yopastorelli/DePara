#!/bin/bash

# Script para verificar e corrigir slideshow
echo "🔍 Verificando e corrigindo slideshow..."

cd ~/DePara

# 1. Verificar se a limitação ainda existe
echo "🔍 Verificando limitação de 50 imagens..."
if grep -q "maxImages = 50" src/routes/fileOperations.js; then
    echo "❌ Limitação de 50 imagens ainda existe!"
    
    # Remover limitação
    echo "🔧 Removendo limitação..."
    sed -i '/const maxImages = 50/d' src/routes/fileOperations.js
    sed -i '/const limitedImages = images\.slice(0, maxImages)/d' src/routes/fileOperations.js
    sed -i '/if (images\.length > maxImages)/d' src/routes/fileOperations.js
    sed -i '/logger\.warn.*limitando/d' src/routes/fileOperations.js
    sed -i '/}/d' src/routes/fileOperations.js
    
    # Substituir retorno da API
    sed -i 's/images: limitedImages,/images: images,/' src/routes/fileOperations.js
    sed -i 's/totalCount: limitedImages\.length,/totalCount: images.length,/' src/routes/fileOperations.js
    sed -i 's/limited: images\.length > maxImages/limited: false/' src/routes/fileOperations.js
    
    echo "✅ Limitação removida!"
else
    echo "✅ Limitação já foi removida"
fi

# 2. Verificar método updateSlideDisplay
echo "🔍 Verificando método updateSlideDisplay..."
if grep -q "console.log.*Atualizando exibição do slide" src/public/app.js; then
    echo "✅ Método updateSlideDisplay já corrigido"
else
    echo "❌ Método updateSlideDisplay precisa ser corrigido!"
    echo "🔧 Aplicando correção..."
    
    # Criar arquivo temporário com o método correto
    cat > /tmp/fix_updateSlideDisplay.js << 'EOF'
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
with open('/tmp/fix_updateSlideDisplay.js', 'r') as f:
    new_method = f.read()

# Encontrar e substituir método
pattern = r'async updateSlideDisplay\(\) \{[^}]*\}'
if re.search(pattern, content, re.DOTALL):
    content = re.sub(pattern, new_method, content, flags=re.DOTALL)
    print('✅ Método updateSlideDisplay substituído')
else:
    print('❌ Método updateSlideDisplay não encontrado')
    # Adicionar método se não existir
    content += '\n' + new_method + '\n'
    print('✅ Método updateSlideDisplay adicionado')

# Salvar arquivo
with open('src/public/app.js', 'w') as f:
    f.write(content)
"
    
    echo "✅ Método updateSlideDisplay corrigido!"
fi

# 3. Parar e reiniciar DePara
echo "🔄 Reiniciando DePara..."
sudo pkill -f "node.*main.js" 2>/dev/null || true
sleep 2

# 4. Iniciar DePara
echo "▶️ Iniciando DePara..."
npm start &

# 5. Aguardar inicialização
echo "⏳ Aguardando inicialização..."
sleep 5

# 6. Verificar status
echo "✅ Verificando status..."
if curl -s http://localhost:3000/api/health > /dev/null; then
    echo "✅ DePara funcionando!"
    echo "🌐 Acesse: http://localhost:3000"
    echo "🎬 Teste o slideshow agora!"
    echo "📋 Verifique o console do navegador para logs detalhados"
else
    echo "❌ Erro na inicialização"
    echo "📋 Verifique os logs: tail -f logs/depara.log"
fi

echo "🎉 Verificação e correção concluída!"
