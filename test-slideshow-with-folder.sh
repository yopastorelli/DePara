#!/bin/bash

# Script para testar slideshow com pasta específica
# Autor: yopastorelli
# Versão: 1.0.0

echo "🎬 Testando slideshow com pasta específica..."

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

# 3. Encontrar pasta com imagens
echo "🔍 Procurando pasta com imagens..."
PICTURES_FOLDER=""

# Tentar pastas comuns
for folder in "/home/yo/Pictures" "/home/yo/Imagens" "/home/yo/Downloads" "/media" "/mnt"; do
    if [ -d "$folder" ]; then
        # Contar imagens na pasta
        IMAGE_COUNT=$(find "$folder" -type f \( -iname "*.jpg" -o -iname "*.jpeg" -o -iname "*.png" -o -iname "*.gif" -o -iname "*.bmp" \) 2>/dev/null | wc -l)
        if [ "$IMAGE_COUNT" -gt 0 ]; then
            PICTURES_FOLDER="$folder"
            echo "✅ Pasta encontrada: $folder ($IMAGE_COUNT imagens)"
            break
        fi
    fi
done

if [ -z "$PICTURES_FOLDER" ]; then
    echo "❌ Nenhuma pasta com imagens encontrada"
    echo "💡 Crie uma pasta com imagens ou especifique o caminho manualmente"
    exit 1
fi

# 4. Criar script de teste
echo "📝 Criando script de teste..."
cat > /home/yo/DePara/test-slideshow-folder.js << EOF
// Script para testar slideshow com pasta específica
console.log('🎬 Testando slideshow com pasta específica...');

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

async function testSlideshowWithFolder() {
    await waitForDeParaUI();
    
    console.log('✅ DeParaUI encontrada');
    
    const testFolder = '$PICTURES_FOLDER';
    console.log('📁 Testando pasta:', testFolder);
    
    // 1. Testar API diretamente
    console.log('🧪 Testando API diretamente...');
    
    try {
        const response = await fetch('/api/files/list-images', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                folderPath: testFolder,
                extensions: ['.jpg', '.jpeg', '.png', '.gif', '.bmp'],
                recursive: true
            })
        });
        
        console.log('📡 Resposta da API:', response.status, response.statusText);
        
        if (response.ok) {
            const result = await response.json();
            console.log('📊 Resultado da API:', result);
            
            if (result.success && result.data.images.length > 0) {
                console.log('✅ API funcionando! Imagens encontradas:', result.data.images.length);
                
                // 2. Testar carregamento de imagem
                console.log('🖼️ Testando carregamento de primeira imagem...');
                const firstImage = result.data.images[0];
                const imageUrl = \`/api/files/image/\${encodeURIComponent(firstImage.path)}\`;
                
                console.log('🔗 URL da imagem:', imageUrl);
                
                const imgResponse = await fetch(imageUrl);
                console.log('📡 Resposta da imagem:', imgResponse.status, imgResponse.statusText);
                
                if (imgResponse.ok) {
                    console.log('✅ Imagem carregada com sucesso!');
                    
                    // 3. Testar slideshow completo
                    console.log('🎬 Testando slideshow completo...');
                    
                    // Configurar slideshow
                    window.deParaUI.slideshowConfig = {
                        interval: 5,
                        random: false,
                        preload: true,
                        extensions: ['.jpg', '.jpeg', '.png', '.gif', '.bmp'],
                        recursive: true
                    };
                    
                    // Carregar imagens
                    await window.deParaUI.loadSlideshowImages(
                        testFolder,
                        ['.jpg', '.jpeg', '.png', '.gif', '.bmp'],
                        true,
                        5
                    );
                    
                    console.log('✅ Slideshow configurado com sucesso!');
                    console.log('📸 Imagens carregadas:', window.deParaUI.slideshowImages.length);
                    
                    // Iniciar slideshow
                    window.deParaUI.startSlideshowViewer();
                    console.log('🎬 Slideshow iniciado!');
                    
                } else {
                    console.error('❌ Erro ao carregar imagem:', imgResponse.status, imgResponse.statusText);
                }
                
            } else {
                console.error('❌ Nenhuma imagem encontrada na pasta');
            }
        } else {
            console.error('❌ Erro HTTP:', response.status, response.statusText);
        }
        
    } catch (error) {
        console.error('❌ Erro na requisição:', error);
    }
    
    console.log('🎉 Teste concluído!');
}

// Executar teste
testSlideshowWithFolder().catch(console.error);
EOF

echo "✅ Script de teste criado!"
echo "🌐 Acesse: http://localhost:3000"
echo "💡 Cole o conteúdo do arquivo test-slideshow-folder.js no console do navegador"
echo "🎬 Isso vai testar o slideshow com a pasta: $PICTURES_FOLDER"
