#!/bin/bash

# Script para debug do carregamento de imagens
# Autor: yopastorelli
# Versão: 1.0.0

echo "🔍 Debug do carregamento de imagens..."

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

# 3. Criar script de debug
echo "📝 Criando script de debug..."
cat > /home/yo/DePara/debug-image-loading.js << 'EOF'
// Script para debug do carregamento de imagens
console.log('🔍 Debug do carregamento de imagens...');

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

async function debugImageLoading() {
    await waitForDeParaUI();
    
    console.log('✅ DeParaUI encontrada');
    
    // 1. Testar rota da API
    console.log('🧪 Testando rota da API...');
    
    const testPath = '/home/yo/Pictures';
    console.log('📁 Testando pasta:', testPath);
    
    try {
        const response = await fetch('/api/files/list-images', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                folderPath: testPath,
                extensions: ['.jpg', '.jpeg', '.png', '.gif', '.bmp'],
                recursive: true
            })
        });
        
        console.log('📡 Resposta da API:', response.status, response.statusText);
        
        if (response.ok) {
            const result = await response.json();
            console.log('📊 Resultado da API:', result);
            
            if (result.success) {
                console.log('✅ API funcionando!');
                console.log('📸 Imagens encontradas:', result.data.images.length);
                console.log('📁 Pasta:', result.data.folderPath);
                
                if (result.data.images.length > 0) {
                    console.log('🖼️ Primeiras 3 imagens:');
                    result.data.images.slice(0, 3).forEach((img, index) => {
                        console.log(`  ${index + 1}. ${img.name} (${img.path})`);
                    });
                } else {
                    console.log('⚠️ Nenhuma imagem encontrada na pasta de teste');
                }
            } else {
                console.error('❌ API retornou erro:', result.error);
            }
        } else {
            console.error('❌ Erro HTTP:', response.status, response.statusText);
            const errorText = await response.text();
            console.error('📄 Detalhes do erro:', errorText);
        }
        
    } catch (error) {
        console.error('❌ Erro na requisição:', error);
    }
    
    // 2. Testar carregamento de imagem individual
    console.log('🖼️ Testando carregamento de imagem individual...');
    
    try {
        const testImagePath = '/home/yo/Pictures/test.jpg';
        const imageUrl = `/api/files/image/${encodeURIComponent(testImagePath)}`;
        
        console.log('🔗 URL da imagem:', imageUrl);
        
        const imgResponse = await fetch(imageUrl);
        console.log('📡 Resposta da imagem:', imgResponse.status, imgResponse.statusText);
        
        if (imgResponse.ok) {
            console.log('✅ Imagem carregada com sucesso!');
        } else {
            console.error('❌ Erro ao carregar imagem:', imgResponse.status, imgResponse.statusText);
        }
        
    } catch (error) {
        console.error('❌ Erro ao testar imagem:', error);
    }
    
    // 3. Testar método loadSlideshowImages
    console.log('🎬 Testando método loadSlideshowImages...');
    
    try {
        await window.deParaUI.loadSlideshowImages(
            '/home/yo/Pictures',
            ['.jpg', '.jpeg', '.png', '.gif', '.bmp'],
            true,
            5
        );
        
        console.log('✅ loadSlideshowImages executado com sucesso!');
        console.log('📸 Imagens carregadas:', window.deParaUI.slideshowImages.length);
        
    } catch (error) {
        console.error('❌ Erro no loadSlideshowImages:', error);
    }
    
    console.log('🎉 Debug concluído!');
}

// Executar debug
debugImageLoading().catch(console.error);
EOF

echo "✅ Script de debug criado!"
echo "🌐 Acesse: http://localhost:3000"
echo "💡 Cole o conteúdo do arquivo debug-image-loading.js no console do navegador"
echo "🔍 Isso vai mostrar exatamente onde está o problema no carregamento!"
