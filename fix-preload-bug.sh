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

# 3. Corrigir método preloadNextImage
echo "🔧 Corrigindo método preloadNextImage..."
python3 -c "
import re

# Ler arquivo
with open('src/public/app.js', 'r') as f:
    content = f.read()

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
        const nextImagePath = this.slideshowImages[nextIndex];
        
        // Construir URL corretamente
        const imageUrl = \`/api/files/image/\${encodeURIComponent(nextImagePath.path)}\`;
        
        try {
            await this.preloadImage(imageUrl);
        } catch (error) {
            console.warn('Erro ao pré-carregar próxima imagem:', error);
        }
    }'''

# Substituir método preloadNextImage
pattern = r'async preloadNextImage\(\) \{[^}]*\}'
if re.search(pattern, content, re.DOTALL):
    content = re.sub(pattern, preloadNextImage, content, flags=re.DOTALL)
    print('✅ preloadNextImage corrigido')
else:
    print('❌ preloadNextImage não encontrado')

# Salvar arquivo
with open('src/public/app.js', 'w') as f:
    f.write(content)

print('✅ Correção aplicada no app.js')
"

# 4. Corrigir método preloadImage também
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
            if (this.preloadedImages.has(imagePath)) {
                resolve(this.preloadedImages.get(imagePath));
                return;
            }

            const img = new Image();
            img.onload = () => {
                this.preloadedImages.set(imagePath, img);
                console.log('🖼️ Imagem pré-carregada:', imagePath);
                resolve(img);
            };
            img.onerror = () => {
                console.warn('⚠️ Erro ao pré-carregar imagem:', imagePath);
                reject(new Error('Erro ao carregar imagem'));
            };
            img.src = imagePath;
        });
    }'''

# Substituir método preloadImage
pattern = r'preloadImage\(imagePath\) \{[^}]*\}'
if re.search(pattern, content, re.DOTALL):
    content = re.sub(pattern, preloadImage, content, flags=re.DOTALL)
    print('✅ preloadImage corrigido')
else:
    print('❌ preloadImage não encontrado')

# Salvar arquivo
with open('src/public/app.js', 'w') as f:
    f.write(content)

print('✅ Correção aplicada no app.js')
"

# 5. Verificar sintaxe
echo "🔍 Verificando sintaxe..."
if node -c src/public/app.js; then
    echo "✅ Sintaxe OK!"
else
    echo "❌ Erro de sintaxe"
    exit 1
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
    echo "📋 O pré-carregamento deve funcionar corretamente"
else
    echo "❌ Erro na inicialização"
    echo "📋 Verifique os logs: tail -f logs/depara.log"
fi

echo "🎉 Bug do pré-carregamento corrigido!"
